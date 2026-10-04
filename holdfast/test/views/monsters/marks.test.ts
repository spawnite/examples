import { Group, Matrix4, Object3D, Scene, Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import {
    createMark,
    hideMarks,
    MarkKind,
    readMarkMeshes,
    showMarks,
    touchMarks,
    writeMarks,
    type Mark,
} from "../../../src/views/monsters/marks";

//  Every monster's marks of one kind draw as one instanced mesh: a copy at
//  each shown mark's world matrix, in its own colour, and none for a mark
//  hidden, or off the scene.

const shown: Mark[] = [];

function show(...marks: Mark[]) {
    showMarks(marks);
    shown.push(...marks);
}

afterEach(() => {
    hideMarks(shown.splice(0));
    touchMarks();
    writeMarks();
});

function readLayer(kind: MarkKind) {
    const mesh = readMarkMeshes().find(({ name }) => name.includes(kind));
    if (!mesh) throw new Error(`No layer draws ${kind}.`);
    return mesh;
}

function readCopy(kind: MarkKind, index: number) {
    const matrix = new Matrix4();
    readLayer(kind).getMatrixAt(index, matrix);
    return new Vector3().setFromMatrixPosition(matrix);
}

it("draws each shown mark once, at its world place, in one draw for its kind", () => {
    const scene = new Scene();
    const monster = new Group();
    monster.position.set(4, 0, -2);
    scene.add(monster);
    const near = createMark(MarkKind.Shadow);
    near.object.position.set(0, 0.03, 0);
    const far = createMark(MarkKind.Shadow);
    far.object.position.set(10, 0.03, 0);
    monster.add(near.object);
    scene.add(far.object);
    show(near, far);
    readMarkMeshes();
    scene.updateMatrixWorld();

    writeMarks();

    expect(readLayer(MarkKind.Shadow).count).toBe(2);
    expect(readCopy(MarkKind.Shadow, 0).toArray()).toEqual([
        4,
        Math.fround(0.03),
        -2,
    ]);
    expect(readCopy(MarkKind.Shadow, 1).toArray()).toEqual([
        10,
        Math.fround(0.03),
        0,
    ]);
    expect(readLayer(MarkKind.Glow).count).toBe(0);
});

it("draws no mark that is hidden, held by something hidden, or off the scene", () => {
    const scene = new Scene();
    const bar = new Group();
    scene.add(bar);
    const back = createMark(MarkKind.BarBack);
    bar.add(back.object);
    const loose = createMark(MarkKind.BarBack);
    const hidden = createMark(MarkKind.BarBack);
    hidden.object.visible = false;
    scene.add(hidden.object);
    show(back, loose, hidden);
    readMarkMeshes();
    scene.updateMatrixWorld();

    writeMarks();
    expect(readLayer(MarkKind.BarBack).count).toBe(1);

    bar.visible = false;
    touchMarks();
    writeMarks();
    expect(readLayer(MarkKind.BarBack).count).toBe(0);
});

it("draws each mark in its own colour", () => {
    const scene = new Scene();
    const red = createMark(MarkKind.Glow);
    red.color.setRGB(2, 0.2, 0.1);
    const blue = createMark(MarkKind.Glow);
    blue.color.setRGB(0.1, 0.4, 2);
    scene.add(red.object, blue.object);
    show(red, blue);
    readMarkMeshes();
    scene.updateMatrixWorld();

    writeMarks();

    const layer = readLayer(MarkKind.Glow);
    const colors = layer.instanceColor?.array.slice(0, 6);
    expect(Array.from(colors ?? [])).toEqual(
        [2, 0.2, 0.1, 0.1, 0.4, 2].map(Math.fround),
    );
});

it("stops drawing a mark once hidden, and draws the next frame's places", () => {
    const scene = new Scene();
    const ring = createMark(MarkKind.Warning);
    scene.add(ring.object);
    show(ring);
    readMarkMeshes();
    scene.updateMatrixWorld();
    writeMarks();
    expect(readLayer(MarkKind.Warning).count).toBe(1);

    //  A frame that moves it and draws twice writes it on the first.
    ring.object.position.x = 3;
    scene.updateMatrixWorld();
    touchMarks();
    writeMarks();
    ring.object.position.x = 5;
    scene.updateMatrixWorld();
    writeMarks();
    expect(readCopy(MarkKind.Warning, 0).x).toBe(3);

    hideMarks([ring]);
    writeMarks();
    expect(readLayer(MarkKind.Warning).count).toBe(0);
});

//  Between waves no monster stands, and a frame uploads nothing for them;
//  a layer with marks uploads the copies it draws and no more.
it("uploads a layer's copies only while it draws some, and only those", () => {
    const scene = new Scene();
    const layer = readLayer(MarkKind.BarFill);
    touchMarks();
    writeMarks();
    const idle = layer.instanceMatrix.version;
    touchMarks();
    writeMarks();
    expect(layer.instanceMatrix.version).toBe(idle);

    const fill = createMark(MarkKind.BarFill);
    scene.add(fill.object);
    show(fill);
    scene.updateMatrixWorld();
    writeMarks();
    expect(layer.instanceMatrix.version).toBeGreaterThan(idle);
    expect(layer.instanceMatrix.updateRanges).toEqual([
        { start: 0, count: 16 },
    ]);

    //  The frame it goes, its copy goes too.
    hideMarks([fill]);
    writeMarks();
    expect(layer.count).toBe(0);
    const gone = layer.instanceMatrix.version;
    touchMarks();
    writeMarks();
    expect(layer.instanceMatrix.version).toBe(gone);
});

it("makes room for more marks than a layer holds", () => {
    const scene = new Scene();
    const horde = Array.from({ length: 150 }, (_, index) => {
        const mark = createMark(MarkKind.Shadow, new Object3D());
        mark.object.position.x = index;
        scene.add(mark.object);
        return mark;
    });
    show(...horde);
    const layer = readLayer(MarkKind.Shadow);
    scene.updateMatrixWorld();

    writeMarks();

    expect(layer.instanceMatrix.count).toBeGreaterThanOrEqual(150);
    expect(layer.count).toBe(150);
    expect(readCopy(MarkKind.Shadow, 149).x).toBe(149);
});
