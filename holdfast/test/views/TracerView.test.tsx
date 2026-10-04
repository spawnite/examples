import { act, create } from "@react-three/test-renderer";
import { WorldProvider } from "koota/react";
import { act as reactAct } from "react";
import { CylinderGeometry, Group, Mesh, Object3D, Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    createGameWorld,
    mountHeadlessScene,
    NetworkEntitiesTrait,
    NetworkIdTrait,
    ShotResultsTrait,
    TransformTrait,
    useRoom,
} from "@spawnite/engine";
import { GunId } from "../../src/siege/guns";
import { MonsterKind, MonsterTrait, WardenTrait } from "../../src/siege/traits";
import { TracerView } from "../../src/views/TracerView";
import { takeKnock } from "../../src/views/monsters/knockback";
import { LatePoses } from "../../src/views/warden/latePoses";
import {
    findMuzzle,
    holdMuzzle,
    settleMuzzle,
} from "../../src/views/warden/muzzles";
import { readShotLook } from "../../src/weapons/looks";
import { keepThree } from "./readThree";

//  The room streams each shot's weapon with its hits, so a hit on a
//  monster pushes it back as far as the gun that fired is heavy, on every
//  page, her own shots and her teammates' alike.

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
    useRoom.setState({ heroId: null });
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

it("pushes each monster a shot hit by the heaviest gun that hit it", async () => {
    const world = createGameWorld();
    world.add(NetworkEntitiesTrait, ShotResultsTrait);
    const spawnHusk = (id: string) => {
        const husk = world.spawn(
            NetworkIdTrait({ id }),
            MonsterTrait({ kind: MonsterKind.Husk }),
            TransformTrait(new Vector3(0, 0, -8)),
        );
        world.get(NetworkEntitiesTrait)?.set(id, husk);
        return husk;
    };
    const railed = spawnHusk("31");
    const both = spawnHusk("32");
    const bolted = spawnHusk("33");
    //  Her own shots: her page drew their lines as she fired.
    useRoom.setState({ heroId: "18" });
    const renderer = await create(
        <WorldProvider world={world}>
            <TracerView />
        </WorldProvider>,
    );

    await act(async () => {
        world.set(ShotResultsTrait, {
            results: [
                {
                    shooter: "18",
                    weapon: GunId.Blaster,
                    origin: [0, 1, 0],
                    end: [0, 1, -8],
                    hits: [
                        { target: "32", damage: 9 },
                        { target: "33", damage: 9 },
                    ],
                },
                {
                    shooter: "18",
                    weapon: GunId.Rail,
                    origin: [0, 1, 0],
                    end: [0, 1, -70],
                    hits: [
                        { target: "31", damage: 55 },
                        { target: "32", damage: 55 },
                    ],
                },
            ],
        });
    });

    expect(takeKnock(railed)).toEqual(readShotLook(GunId.Rail).knock);
    //  The heaviest of its hits since its last push.
    expect(takeKnock(both)).toEqual(readShotLook(GunId.Rail).knock);
    expect(takeKnock(bolted)).toEqual(readShotLook(GunId.Blaster).knock);
    await renderer.unmount();
    world.destroy();
});

//  A teammate's bolt lives on the canvas's clock, which holds with the
//  page: a held page, or a replay held on a moment, keeps it drawn however
//  long the wall clock runs, and it goes once the clock has run its life.

it("keeps a teammate's bolt while the canvas's clock holds, and clears it once its life has run", async () => {
    vi.useFakeTimers();
    const world = createGameWorld();
    world.add(NetworkEntitiesTrait, ShotResultsTrait);
    useRoom.setState({ heroId: "18" });
    const { element: three, readThree } = keepThree();
    const renderer = await create(
        <WorldProvider world={world}>
            {three}
            <TracerView />
        </WorldProvider>,
    );
    const { clock } = readThree();
    clock.autoStart = false;
    clock.running = false;
    const countBolts = () =>
        renderer.scene.findAll(
            (node) =>
                node.instance instanceof Mesh &&
                node.instance.geometry instanceof CylinderGeometry &&
                node.instance.geometry.parameters.radiusTop === 0.025,
        ).length;

    await act(async () => {
        world.set(ShotResultsTrait, {
            results: [
                {
                    shooter: "19",
                    weapon: GunId.Blaster,
                    origin: [0, 1, 0],
                    end: [0, 1, -8],
                    hits: [],
                },
            ],
        });
    });
    expect(countBolts()).toBe(1);

    //  Held: five seconds on the wall clock, none on the canvas's.
    await act(async () => {
        vi.advanceTimersByTime(5000);
    });
    await act(async () => renderer.advanceFrames(1, 0));
    expect(countBolts()).toBe(1);

    //  The canvas's clock runs past a bolt's life.
    clock.elapsedTime += 1;
    await act(async () => renderer.advanceFrames(1, 1));
    expect(countBolts()).toBe(0);

    await renderer.unmount();
    world.destroy();
});

//  The room mounts the scene headless and runs no frame, so a bolt it drew
//  would never go: every shot of the night would stay mounted in the room.

it("draws no bolt headless, however many shots the room streams", async () => {
    const world = createGameWorld();
    world.add(NetworkEntitiesTrait, ShotResultsTrait);
    useRoom.setState({ heroId: "18" });
    const { element: three, readThree } = keepThree();
    const game = await mountHeadlessScene(
        () => (
            <>
                {three}
                <TracerView />
            </>
        ),
        world,
    );

    for (let shot = 0; shot < 100; shot++)
        await reactAct(async () => {
            world.set(ShotResultsTrait, {
                results: [
                    {
                        shooter: "19",
                        weapon: GunId.Blaster,
                        origin: [0, 1, 0],
                        end: [0, 1, -8 - shot],
                        hits: [],
                    },
                ],
            });
        });

    let meshes = 0;
    readThree().scene.traverse((node) => {
        if (node instanceof Mesh) meshes++;
    });
    expect(meshes).toBe(0);
    await game.unmount();
    world.destroy();
});

//  A teammate's bolt starts at her barrel as this page draws it, for as
//  long as it shows, while she runs; a shooter this page holds no warden
//  for yet has no barrel, so her bolt starts where the room says.

/** A teammate's place with her barrel, settled as her hold draws it. */
function holdTeammateBarrel(hue: number) {
    const place = new Group();
    place.position.set(3, 0, -2);
    const muzzle = new Object3D();
    muzzle.position.set(0.3, 1.2, -0.6);
    place.add(muzzle);
    const release = holdMuzzle(hue, muzzle);
    place.updateMatrixWorld(true);
    settleMuzzle(hue, place);
    return { place, release };
}

/** A teammate's place, and the room's id for the warden who fires. */
interface StreamedShot {
    place: Group;
    shooter: string;
}

/** Mounts this page's tracers beside `place`, streams one blaster shot
 *  from `shooter`, and returns a draw and the bolt's start as drawn. */
async function streamShot(
    world: ReturnType<typeof createGameWorld>,
    { place, shooter }: StreamedShot,
) {
    useRoom.setState({ heroId: "18" });
    const { element: three, readThree } = keepThree();
    const renderer = await create(
        <WorldProvider world={world}>
            {three}
            <LatePoses />
            <primitive object={place} />
            <TracerView />
        </WorldProvider>,
    );
    await act(async () => {
        world.set(ShotResultsTrait, {
            results: [
                {
                    shooter,
                    weapon: GunId.Blaster,
                    origin: [0, 1, 0],
                    end: [0, 1, -30],
                    hits: [],
                },
            ],
        });
    });
    const [core] = renderer.scene
        .findAll(
            (node) =>
                node.instance instanceof Mesh &&
                node.instance.geometry instanceof CylinderGeometry &&
                node.instance.geometry.parameters.radiusTop === 0.025,
        )
        .map((node) => node.instance as Mesh);
    const draw = async () => {
        await act(async () => renderer.advanceFrames(1, 1 / 60));
        const { gl, scene, camera } = readThree();
        gl.render(scene, camera);
    };
    //  The core runs along its own y, from -0.5 at the start.
    const readStart = () => core.localToWorld(new Vector3(0, -0.5, 0));
    return { renderer, draw, readStart };
}

it("keeps a teammate's bolt at her barrel while she strafes", async () => {
    const world = createGameWorld();
    world.add(NetworkEntitiesTrait, ShotResultsTrait);
    const teammate = world.spawn(
        NetworkIdTrait({ id: "19" }),
        WardenTrait({ hue: 1 }),
    );
    world.get(NetworkEntitiesTrait)?.set("19", teammate);
    const { place, release } = holdTeammateBarrel(1);
    const shot = await streamShot(world, { place, shooter: "19" });

    place.position.x -= 0.6;
    await shot.draw();

    const barrel = new Vector3();
    expect(findMuzzle(1, barrel)).toBe(true);
    expect(shot.readStart().distanceTo(barrel)).toBeLessThan(1e-6);
    await shot.renderer.unmount();
    release();
    world.destroy();
});

it("starts a bolt where the room says when this page holds no warden for its shooter", async () => {
    const world = createGameWorld();
    world.add(NetworkEntitiesTrait, ShotResultsTrait);
    //  Another warden's barrel, drawn under the first hue.
    const { place, release } = holdTeammateBarrel(0);
    const shot = await streamShot(world, { place, shooter: "20" });

    place.position.x -= 0.6;
    await shot.draw();

    expect(shot.readStart().distanceTo(new Vector3(0, 1, 0))).toBeLessThan(
        1e-6,
    );
    await shot.renderer.unmount();
    release();
    world.destroy();
});
