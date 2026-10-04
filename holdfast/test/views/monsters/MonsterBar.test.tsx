import { act, create } from "@react-three/test-renderer";
import { MathUtils, Matrix4, Quaternion, Vector3, type Camera } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    MarkKind,
    readMarkMeshes,
    touchMarks,
    writeMarks,
} from "../../../src/views/monsters/marks";
import { MonsterBar } from "../../../src/views/monsters/MonsterBar";
import { keepThree } from "../readThree";

//  A hurt monster's bar faces the camera from every side, however the
//  monster turns: a player beside a monster reads its bar, not its edge.
//  Each check reads the copies the marks layer draws, as a page does.

const mounted: Awaited<ReturnType<typeof create>>[] = [];

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(async () => {
    //  Unmounted, each bar takes its marks off the shared layers.
    for (const renderer of mounted.splice(0)) await renderer.unmount();
    touchMarks();
    writeMarks();
    vi.unstubAllGlobals();
});

interface BarOptions {
    current: number;
    /** Degrees the monster is turned about y. */
    turn?: number;
}

/** The copy the bar's layer of `kind` draws, as position, rotation and
 *  scale, or none where it draws no copy. */
function readDrawnCopy(kind: MarkKind) {
    const layer = readMarkMeshes().find(({ name }) => name.includes(kind));
    if (!layer || layer.count === 0) return undefined;
    const matrix = new Matrix4();
    layer.getMatrixAt(0, matrix);
    const copy = {
        at: new Vector3(),
        turn: new Quaternion(),
        scale: new Vector3(),
    };
    matrix.decompose(copy.at, copy.turn, copy.scale);
    return copy;
}

async function mountBar({ current, turn = 90 }: BarOptions) {
    const { element, readThree } = keepThree();
    const renderer = await create(
        <>
            {element}
            <group rotation-y={MathUtils.degToRad(turn)}>
                <MonsterBar
                    height={2}
                    width={1.2}
                    current={current}
                    maximum={100}
                />
            </group>
        </>,
    );
    mounted.push(renderer);
    /** Stands the camera at `position`, looking at the bar, runs a frame
     *  and writes the marks as the frame's draw does. */
    const placeCamera = async (position: Vector3) => {
        const { camera, scene } = readThree();
        camera.position.copy(position);
        camera.lookAt(0, 2, 0);
        camera.updateMatrixWorld();
        await act(() => renderer.advanceFrames(1, 1 / 60));
        readMarkMeshes();
        scene.updateMatrixWorld();
        touchMarks();
        writeMarks();
    };
    return { readThree, placeCamera };
}

/** Degrees between a drawn copy's rotation and the camera's. */
function measureFacingError(turn: Quaternion, camera: Camera) {
    return MathUtils.radToDeg(
        turn.angleTo(camera.getWorldQuaternion(new Quaternion())),
    );
}

it.each([0, 90, 225])(
    "faces a monster's bar to the camera from the front, the side and behind, the monster turned %i degrees",
    async (turn) => {
        const { placeCamera, readThree } = await mountBar({
            current: 40,
            turn,
        });

        for (const side of [
            new Vector3(0, 4, 8),
            new Vector3(8, 4, 0),
            new Vector3(-5, 4, -6),
        ]) {
            await placeCamera(side);
            const { camera } = readThree();
            for (const kind of [MarkKind.BarBack, MarkKind.BarFill]) {
                const copy = readDrawnCopy(kind);
                expect(copy, `${kind} drawn`).toBeDefined();
                if (copy)
                    expect(measureFacingError(copy.turn, camera)).toBeLessThan(
                        0.01,
                    );
            }
        }
    },
);

it("stands the bar over the monster, filled to its share of health", async () => {
    const { placeCamera } = await mountBar({ current: 25 });
    await placeCamera(new Vector3(0, 4, 8));

    const back = readDrawnCopy(MarkKind.BarBack);
    const fill = readDrawnCopy(MarkKind.BarFill);
    expect(back?.at.y).toBeCloseTo(2);
    expect(back?.scale.x).toBeCloseTo(1.2);
    expect(fill?.scale.x).toBeCloseTo(0.3);
    //  The fill starts at the bar's left end: its middle stands left of
    //  the bar's, along the bar's own x.
    const along = fill?.at
        .clone()
        .sub(back?.at ?? new Vector3())
        .applyQuaternion(back?.turn.clone().invert() ?? new Quaternion());
    expect(along?.x).toBeCloseTo(-0.45);
});

it.each([
    [100, false],
    [60, true],
    [0, false],
])("draws the bar at %i health of 100: %s", async (current, drawn) => {
    const { placeCamera } = await mountBar({ current });
    await placeCamera(new Vector3(0, 4, 8));

    expect(readDrawnCopy(MarkKind.BarBack) !== undefined).toBe(drawn);
    expect(readDrawnCopy(MarkKind.BarFill) !== undefined).toBe(drawn);
});
