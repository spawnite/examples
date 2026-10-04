import { act, create } from "@react-three/test-renderer";
import { createWorld, type Entity } from "koota";
import {
    Bone,
    BoxGeometry,
    Float32BufferAttribute,
    Group,
    MeshStandardMaterial,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute,
    Vector3,
    type Object3D,
} from "three";
import { expect, it, vi } from "vitest";
import { TrackMoverTrait } from "@spawnite/engine/core";
import { RiderModel } from "../../src/components/RiderModel";
import { RigTrait } from "../../src/ride/rig";
import { RideId, RiderId } from "../../src/ride/riders";
import { SlingTrait } from "../../src/ride/sling";

//  A rider rigged as the five shipped riders are, in their seated frame:
//  +z forward, +x the rider's left, +y up. The bone frames copy the Tripo
//  biped's, read off each rider's skin in the browser with `spawnite play
//  eval`: each clavicle turned about z a little short of a right angle,
//  down its side, the upper arm on a further 0.77 rad, so a turn about the
//  arm's x swings the hand forward and one about its z lifts the left hand
//  and lowers the right; and the neck turned half about y, so the head's
//  x points to the rider's right. A box of skin rides each hand and the
//  head, and the torso rides the root.
const root = new Bone();
const bones = [root];
const skins: SkinnedMesh[] = [];

function addBone(name: string, parent: Bone, at: Vector3, turn: Vector3) {
    const bone = new Bone();
    bone.name = name;
    bone.position.copy(at);
    bone.rotation.setFromVector3(turn);
    parent.add(bone);
    bones.push(bone);
    return bone;
}

/** A box of skin at `at`, in the rider's frame, wholly on `bone`. */
function addSkin(name: string, bone: Bone, at: Vector3, size: number) {
    const box = new BoxGeometry(size, size, size).translate(at.x, at.y, at.z);
    const count = box.getAttribute("position").count;
    box.setAttribute(
        "skinIndex",
        new Uint16BufferAttribute(
            new Uint16Array(count * 4).fill(bones.indexOf(bone)),
            4,
        ),
    );
    box.setAttribute(
        "skinWeight",
        new Float32BufferAttribute(
            Array.from({ length: count }, () => [1, 0, 0, 0]).flat(),
            4,
        ),
    );
    const skin = new SkinnedMesh(box, new MeshStandardMaterial());
    skin.name = name;
    skins.push(skin);
}

const clavicleTurn = 1.48;
const upperarmTurn = 0.77;
for (const side of [1, -1]) {
    const prefix = side === 1 ? "L" : "R";
    const clavicle = addBone(
        `${prefix}_Clavicle`,
        root,
        new Vector3(side * 0.1, 0.75, 0),
        new Vector3(0, 0, -side * clavicleTurn),
    );
    const upperarm = addBone(
        `${prefix}_Upperarm`,
        clavicle,
        new Vector3(0, 0.1, 0),
        new Vector3(0, 0, -side * upperarmTurn),
    );
    root.updateMatrixWorld(true);
    //  The hand, 0.3 m down the arm.
    addSkin(
        `${prefix}_HandSkin`,
        upperarm,
        upperarm.localToWorld(new Vector3(0, 0.3, 0)),
        0.06,
    );
}
const neck = addBone(
    "NeckTwist02",
    root,
    new Vector3(0, 0.85, 0),
    new Vector3(0, Math.PI, 0),
);
const head = addBone("Head", neck, new Vector3(0, 0.05, 0), new Vector3());
//  The face, ahead of the head bone.
addSkin("HeadSkin", head, new Vector3(0, 1, 0.1), 0.1);
addSkin("TorsoSkin", root, new Vector3(0, 0.5, 0), 0.5);
const skeleton = new Skeleton(bones);
const rider = new Group().add(root, ...skins);
rider.updateMatrixWorld(true);
for (const skin of skins) skin.bind(skeleton);
//  The files face +x, which the rider's fit turns a quarter back.
const model = new Group().add(rider);
rider.rotation.y = Math.PI / 2;

//  The engine's model loader reads its files through fiber's.
vi.mock("@react-three/fiber", async (importOriginal) =>
    (await import("@spawnite/testing/fiber")).fakeLoader(
        importOriginal,
        () => ({ scene: model }),
    ),
);

/** The rider's own body under `holder`, the group the rig leans and
 *  squashes: the ride drawn from the same file shares the loaded
 *  skeleton. */
function findBody(holder: Object3D) {
    const bodies = holder.children.filter((child) => {
        let own = false;
        child.traverse((part) => {
            if (part instanceof SkinnedMesh && part.skeleton.bones[0] !== root)
                own = true;
        });
        return own;
    });
    expect(bodies).toHaveLength(1);
    return bodies[0];
}

/** The middle of the skin named `name`, deformed, in the body's own frame,
 *  so the body's lean and roll leave it where the limb put it. */
function readSkin(body: Object3D, name: string) {
    //  A skin's own update refreshes its bind inverse; updateWorldMatrix
    //  skips it.
    body.updateWorldMatrix(true, false);
    body.updateMatrixWorld(true);
    const skin = body.getObjectByName(name) as SkinnedMesh;
    const count = skin.geometry.getAttribute("position").count;
    const sum = new Vector3();
    for (let index = 0; index < count; index++)
        sum.add(
            skin
                .getVertexPosition(index, new Vector3())
                .applyMatrix4(skin.matrixWorld),
        );
    return body.worldToLocal(sum.divideScalar(count));
}

/** Each limb's skin, read now. */
function readLimbs(body: Object3D) {
    return {
        left: readSkin(body, "L_HandSkin"),
        right: readSkin(body, "R_HandSkin"),
        face: readSkin(body, "HeadSkin"),
    };
}

/** A rider at full speed, drawn on its own, and the step that reads its
 *  limbs after a change to its traits. */
async function draw() {
    const world = createWorld();
    const entity = world.spawn(
        RigTrait({ speed: 1 }),
        TrackMoverTrait,
        SlingTrait,
    );
    const renderer = await create(
        <group name="holder">
            <RiderModel
                entity={entity}
                rider={RiderId.Penguin}
                ride={RideId.Toboggan}
            />
        </group>,
    );
    const body = findBody(renderer.scene.instance.getObjectByName("holder")!);
    const pose = async (change?: (entity: Entity) => void) => {
        change?.(entity);
        await act(() => renderer.advanceFrames(1, 1 / 60));
        return readLimbs(body);
    };
    const before = await pose();
    const close = async () => {
        await renderer.unmount();
        world.destroy();
    };
    return { before, pose, close };
}

it("lifts both hands off the snow in the air", async () => {
    const { before, pose, close } = await draw();
    const after = await pose((entity) => entity.set(RigTrait, { air: 1 }));

    expect(after.left.y).toBeGreaterThan(before.left.y + 0.05);
    expect(after.right.y).toBeGreaterThan(before.right.y + 0.05);
    await close();
});

it("drops the inside hand back into a right turn, lifts the outside one and leads with the head", async () => {
    const { before, pose, close } = await draw();
    const after = await pose((entity) =>
        entity.set(TrackMoverTrait, { steer: 1 }),
    );

    //  Back is -z, and the rider's right is -x.
    expect(after.right.z).toBeLessThan(before.right.z - 0.03);
    expect(after.right.y).toBeLessThan(before.right.y - 0.05);
    expect(after.left.y).toBeGreaterThan(before.left.y + 0.03);
    expect(after.face.x).toBeLessThan(before.face.x - 0.02);
    await close();
});

it("reaches both hands forward on a full pull of the sling", async () => {
    const { before, pose, close } = await draw();
    const after = await pose((entity) => entity.set(SlingTrait, { charge: 1 }));

    expect(after.left.z).toBeGreaterThan(before.left.z + 0.03);
    expect(after.right.z).toBeGreaterThan(before.right.z + 0.03);
    await close();
});

it("poses one rider's skin, leaving another rider and the loaded model as they were", async () => {
    const world = createWorld();
    const flier = world.spawn(RigTrait, TrackMoverTrait);
    const renderer = await create(
        <>
            <group name="flier">
                <RiderModel
                    entity={flier}
                    rider={RiderId.Penguin}
                    ride={RideId.Toboggan}
                />
            </group>
            <group name="sitter">
                <RiderModel
                    entity={world.spawn(RigTrait)}
                    rider={RiderId.Penguin}
                    ride={RideId.Toboggan}
                />
            </group>
        </>,
    );
    const scene = renderer.scene.instance;
    const flying = findBody(scene.getObjectByName("flier")!);
    const sitting = findBody(scene.getObjectByName("sitter")!);
    const flyingSkin = flying.getObjectByName("TorsoSkin") as SkinnedMesh;
    expect(flyingSkin.geometry).toBe(skins.at(-1)!.geometry);
    expect(flyingSkin.castShadow && flyingSkin.receiveShadow).toBe(true);
    const loaded = bones.map((bone) => bone.rotation.toArray());

    await act(() => renderer.advanceFrames(1, 1 / 60));
    const flierBefore = readLimbs(flying);
    const sitterBefore = readLimbs(sitting);
    flier.set(RigTrait, { air: 1 });
    await act(() => renderer.advanceFrames(1, 1 / 60));

    expect(readLimbs(flying).left.y).toBeGreaterThan(flierBefore.left.y);
    expect(readLimbs(sitting)).toEqual(sitterBefore);
    expect(bones.map((bone) => bone.rotation.toArray())).toEqual(loaded);

    await renderer.unmount();
    world.destroy();
});
