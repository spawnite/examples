import {
    BufferAttribute,
    BufferGeometry,
    Vector3,
    type SkinnedMesh,
} from "@spawnite/engine/three";

//  The patch her face is painted on, shaped to the front of her head as a
//  decal is: each point of it stands a hair's breadth off her skin in its
//  direction from the middle of her head, so the paint neither sinks into
//  her cheeks nor floats off her brow. Built once per model and shared.

/** A patch's spread: radians round her head either side of her nose, and
 *  down from straight up at its top and bottom edges. */
export type PatchSpan = {
    phiSpread: number;
    thetaTop: number;
    thetaBottom: number;
};

/** The painted face's patch, its canvas laid on it by angle. */
export const paintedSpan: PatchSpan = {
    phiSpread: 0.75,
    thetaTop: 1.05,
    thetaBottom: 2.2,
};
/** Metres the paint stands off her skin. */
const lift = 0.004;
/** Points across and down the patch, and the bins her head is sorted into
 *  to find her skin in each direction. */
const across = 40;
const down = 34;
const binsAcross = 96;
const binsDown = 80;

const built = new WeakMap<BufferGeometry, Map<string, BufferGeometry>>();

/** A face patch for `skinned`, in the head mount's frame: world metres
 *  from her head bone, Y-up, facing +z. `middle` is the middle of her head
 *  there, `toMount` turns a point of the model's own geometry into that
 *  frame, and `fallback` is her head's half-sizes, for a direction with no
 *  skin behind it. It covers `span`; its texture lies on it by angle, or,
 *  given `project`, where that puts each point, from its place across and
 *  up from her head's middle. Kept by `name`, once per model. */
export function facePatch(
    skinned: SkinnedMesh,
    headBone: number,
    middle: Vector3,
    fallback: Vector3,
    toMount: (x: number, y: number, z: number, into: Vector3) => Vector3,
    name = "painted",
    span: PatchSpan = paintedSpan,
    project?: (across: number, up: number) => [number, number],
) {
    let byName = built.get(skinned.geometry);
    if (!byName) {
        byName = new Map();
        built.set(skinned.geometry, byName);
    }
    const found = byName.get(name);
    if (found) return found;
    const {
        phiSpread: facePhiSpread,
        thetaTop: faceThetaTop,
        thetaBottom: faceThetaBottom,
    } = span;

    const { position, skinIndex, skinWeight } = skinned.geometry.attributes;
    const phiStart = Math.PI / 2 - facePhiSpread;
    const phiLength = facePhiSpread * 2;
    const thetaLength = faceThetaBottom - faceThetaTop;
    //  The farthest skin from her head's middle in each direction.
    const reach = new Float32Array(binsAcross * binsDown);
    const point = new Vector3();
    for (let vertex = 0; vertex < position.count; vertex++) {
        let weight = 0;
        for (let k = 0; k < 4; k++)
            if (skinIndex.getComponent(vertex, k) === headBone)
                weight += skinWeight.getComponent(vertex, k);
        if (weight < 0.5) continue;
        toMount(
            position.getX(vertex),
            position.getY(vertex),
            position.getZ(vertex),
            point,
        ).sub(middle);
        const r = point.length();
        const theta = Math.acos(point.y / r);
        const phi = Math.atan2(point.z, -point.x);
        const u = (phi - phiStart) / phiLength;
        const v = (theta - faceThetaTop) / thetaLength;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const bin =
            Math.floor(v * binsDown) * binsAcross + Math.floor(u * binsAcross);
        reach[bin] = Math.max(reach[bin], r);
    }

    //  The skin in a direction: the farthest in its bin and the bins round
    //  it, so a bin a triangle's corners missed still has skin.
    const skinAt = (u: number, v: number) => {
        const bu = Math.min(binsAcross - 1, Math.floor(u * binsAcross));
        const bv = Math.min(binsDown - 1, Math.floor(v * binsDown));
        let best = 0;
        for (let dv = -1; dv <= 1; dv++)
            for (let du = -1; du <= 1; du++) {
                const nu = bu + du;
                const nv = bv + dv;
                if (nu < 0 || nv < 0 || nu >= binsAcross || nv >= binsDown)
                    continue;
                best = Math.max(best, reach[nv * binsAcross + nu]);
            }
        return best;
    };

    const positions = new Float32Array((across + 1) * (down + 1) * 3);
    const uvs = new Float32Array((across + 1) * (down + 1) * 2);
    const direction = new Vector3();
    for (let j = 0; j <= down; j++) {
        const v = j / down;
        const theta = faceThetaTop + v * thetaLength;
        for (let i = 0; i <= across; i++) {
            const u = i / across;
            const phi = phiStart + u * phiLength;
            direction.set(
                -Math.cos(phi) * Math.sin(theta),
                Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
            );
            let r = skinAt(u, v);
            if (r === 0) {
                //  No skin this way: her head's own shape.
                r =
                    1 /
                    Math.sqrt(
                        (direction.x / fallback.x) ** 2 +
                            (direction.y / fallback.y) ** 2 +
                            (direction.z / fallback.z) ** 2,
                    );
            }
            const at = (j * (across + 1) + i) * 3;
            positions[at] = middle.x + direction.x * (r + lift);
            positions[at + 1] = middle.y + direction.y * (r + lift);
            positions[at + 2] = middle.z + direction.z * (r + lift);
            const [textureU, textureV] = project
                ? project(direction.x * r, direction.y * r)
                : [u, 1 - v];
            uvs[(j * (across + 1) + i) * 2] = textureU;
            uvs[(j * (across + 1) + i) * 2 + 1] = textureV;
        }
    }
    const indices: number[] = [];
    for (let j = 0; j < down; j++)
        for (let i = 0; i < across; i++) {
            const a = j * (across + 1) + i;
            const b = a + 1;
            const c = a + across + 1;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    byName.set(name, geometry);
    return geometry;
}
