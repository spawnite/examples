import { VRM, VRMHumanBoneName, VRMHumanoid } from "@pixiv/three-vrm";
import { create } from "@react-three/test-renderer";
import { createWorld } from "koota";
import { WorldProvider } from "koota/react";
import { AuthorityTrait, RunContext } from "@spawnite/engine";
import { Bone, Group, MathUtils, Mesh, TorusGeometry, Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GunId, gunList } from "../../src/siege/guns";
import { WardenGunTrait } from "../../src/siege/traits";
import { WardenRig } from "../../src/views/WardenView";
import { LatePoses } from "../../src/views/warden/latePoses";
import { findMuzzle, findMuzzleAim } from "../../src/views/warden/muzzles";
import { keepThree } from "./readThree";

//  Her shots leave the barrel of the gun her hold draws, whichever gun from
//  the rack she holds: the gun names its barrel's end inside the sway it
//  breathes with, and her hold settles where it drew that end as it lays
//  her arms over the clips, just before each draw. Read after the clips
//  pose her arm again, the barrel is still where the draw put it.

//  The engine's model loader reads its files through fiber's: each gun's
//  model is an empty scene here, and its barrel rings are drawn round it.
vi.mock("@react-three/fiber", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@react-three/fiber")>()),
    useLoader: Object.assign(() => ({ scene: new Group() }), {
        preload: vi.fn(),
    }),
}));

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

/** A hue whose idle sway is well off zero on the first frames, so a
 *  muzzle outside the sway reads millimetres off the drawn barrel. */
const hue = 2;
const frameSeconds = 1 / 60;

/** A VRM 0.x body whose bones hang from each other as a real skeleton's
 *  do: hips, spine and chest, the arms off the chest, the right one along
 *  +x, the legs off the hips, and the neck and head. */
function createSkeletonVrm() {
    const createBone = (name: string, x = 0, y = 0) => {
        const bone = new Bone();
        bone.name = name;
        bone.position.set(x, y, 0);
        return bone;
    };
    const hips = createBone("hips", 0, 1);
    const spine = createBone("spine", 0, 0.1);
    const chest = createBone("chest", 0, 0.2);
    const neck = createBone("neck", 0, 0.2);
    const head = createBone("head", 0, 0.1);
    const upperArm = createBone("rightUpperArm", 0.15, 0.15);
    const lowerArm = createBone("rightLowerArm", 0.25);
    const hand = createBone("rightHand", 0.25);
    const leftUpperArm = createBone("leftUpperArm", -0.15, 0.15);
    const leftLowerArm = createBone("leftLowerArm", -0.25);
    const leftHand = createBone("leftHand", -0.25);
    const upperLeg = createBone("rightUpperLeg", 0.1, -0.05);
    const lowerLeg = createBone("rightLowerLeg", 0, -0.45);
    const foot = createBone("rightFoot", 0, -0.45);
    const leftUpperLeg = createBone("leftUpperLeg", -0.1, -0.05);
    const leftLowerLeg = createBone("leftLowerLeg", 0, -0.45);
    const leftFoot = createBone("leftFoot", 0, -0.45);
    hips.add(spine, upperLeg, leftUpperLeg);
    upperLeg.add(lowerLeg);
    lowerLeg.add(foot);
    leftUpperLeg.add(leftLowerLeg);
    leftLowerLeg.add(leftFoot);
    spine.add(chest);
    chest.add(neck, upperArm, leftUpperArm);
    neck.add(head);
    upperArm.add(lowerArm);
    lowerArm.add(hand);
    leftUpperArm.add(leftLowerArm);
    leftLowerArm.add(leftHand);
    const scene = new Group();
    scene.add(hips);
    const humanoid = new VRMHumanoid({
        hips: { node: hips },
        spine: { node: spine },
        chest: { node: chest },
        neck: { node: neck },
        head: { node: head },
        rightUpperArm: { node: upperArm },
        rightLowerArm: { node: lowerArm },
        rightHand: { node: hand },
        leftUpperArm: { node: leftUpperArm },
        leftLowerArm: { node: leftLowerArm },
        leftHand: { node: leftHand },
        rightUpperLeg: { node: upperLeg },
        rightLowerLeg: { node: lowerLeg },
        rightFoot: { node: foot },
        leftUpperLeg: { node: leftUpperLeg },
        leftLowerLeg: { node: leftLowerLeg },
        leftFoot: { node: leftFoot },
    });
    scene.add(humanoid.normalizedHumanBonesRoot);
    return new VRM({ scene, humanoid, meta: { metaVersion: "0" } });
}

/** Her place in the world, turned, with her body in it, holding `gun`
 *  in her hold over the scene's late poses. */
async function holdGun(gun: GunId, own = false) {
    const world = createWorld();
    const entity = world.spawn(WardenGunTrait({ gun, tier: 0 }));
    //  Her own page's warden aims where its camera looks.
    if (own) entity.add(AuthorityTrait({ context: RunContext.Client }));
    const vrm = createSkeletonVrm();
    const place = new Group();
    place.position.set(4, 0.5, -3);
    place.rotation.y = 0.6;
    place.add(vrm.scene);
    const { element: three, readThree } = keepThree();
    const renderer = await create(
        <WorldProvider world={world}>
            {three}
            <LatePoses />
            <primitive object={place}>
                <WardenRig
                    entity={entity}
                    vrm={vrm}
                    hue={hue}
                    down={false}
                    ground={undefined}
                />
            </primitive>
        </WorldProvider>,
    );
    /** Runs a frame's callbacks, then draws the scene. */
    const drawFrame = async () => {
        await renderer.advanceFrames(1, frameSeconds);
        const { gl, scene, camera } = readThree();
        gl.render(scene, camera);
    };
    return { renderer, vrm, world, drawFrame, readThree };
}

/** The centre of the gun's barrel rings, where they are drawn: its one
 *  barrel's end, or the point between a double barrel's. */
function readDrawnBarrel(renderer: Awaited<ReturnType<typeof create>>) {
    const rings = renderer.scene
        .findAll(
            (node) =>
                node.instance instanceof Mesh &&
                node.instance.geometry instanceof TorusGeometry &&
                node.instance.geometry.parameters.tube === 0.009,
        )
        .map((node) => node.instance as Mesh);
    const centre = new Vector3();
    for (const ring of rings)
        centre.add(new Vector3().setFromMatrixPosition(ring.matrixWorld));
    return { rings: rings.length, centre: centre.divideScalar(rings.length) };
}

/** Poses her right arm hanging at her side, as the clips hold it, and
 *  updates its world matrices, as the engine's frame loop does before the
 *  next draw. */
function poseClips(vrm: VRM) {
    vrm.humanoid
        .getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm)
        ?.rotation.set(-Math.PI / 2, 0, 0.4);
    vrm.humanoid.update();
    vrm.scene.updateWorldMatrix(true, true);
}

it.each(gunList)(
    "shoots from the %s's drawn barrel, after the clips pose her arm again",
    async (gun) => {
        const { renderer, vrm, world, drawFrame } = await holdGun(gun);
        for (let frame = 0; frame < 3; frame++) await drawFrame();
        const drawn = readDrawnBarrel(renderer);
        poseClips(vrm);

        const found = new Vector3();
        expect(drawn.rings).toBeGreaterThan(0);
        expect(findMuzzle(hue, found)).toBe(true);
        expect(found.distanceTo(drawn.centre)).toBeLessThan(1e-4);

        await renderer.unmount();
        world.destroy();
    },
);

//  Level, and the camera's stops: 80 degrees up at the sky and down at her
//  feet.
it.each([0, 80, -80])(
    "points her barrel along her own camera's look, %s degrees up",
    async (degrees) => {
        const { renderer, world, drawFrame, readThree } = await holdGun(
            GunId.Blaster,
            true,
        );
        const pitch = MathUtils.degToRad(degrees);
        const { camera, clock } = readThree();
        camera.rotation.set(pitch, 0, 0, "YXZ");
        camera.updateMatrixWorld();
        clock.autoStart = false;
        clock.running = false;
        await drawFrame();
        //  Past the gun's swing up into her hands, a third of a second on
        //  the canvas's clock.
        clock.elapsedTime += 1;
        for (let frame = 0; frame < 3; frame++) await drawFrame();

        const barrel = new Vector3();
        expect(findMuzzleAim(hue, barrel)).toBe(true);
        expect(Math.asin(barrel.y)).toBeCloseTo(pitch, 1);

        await renderer.unmount();
        world.destroy();
    },
);
