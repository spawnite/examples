// @vitest-environment node
import {
    Bone,
    Box3,
    BoxGeometry,
    BufferGeometry,
    Float32BufferAttribute,
    Group,
    Mesh,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute,
    Vector3,
    type Object3D,
} from "three";
import { expect, it } from "vitest";
import { buildRide, buildRig } from "../../src/components/RiderModel";
import { RideId, riderScale, rides } from "../../src/ride/riders";

//  Each ride's model as a box of its file's size, in metres across, up and
//  along, as `spawnite model check` measures it: the fit reads the bounds
//  alone.
const rideSizes: Record<RideId, [number, number, number]> = {
    [RideId.Toboggan]: [0.361, 0.227, 0.979],
    [RideId.Donut]: [0.979, 0.406, 0.972],
    [RideId.Tin]: [0.69, 0.447, 0.981],
    [RideId.Bathtub]: [0.98, 0.616, 0.617],
};

function makeRide(id: RideId) {
    return new Group().add(new Mesh(new BoxGeometry(...rideSizes[id])));
}

/** Gives every vertex of `geometry` wholly to bone `bone`. */
function skinTo(geometry: BufferGeometry, bone: number) {
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute(
        "skinIndex",
        new Uint16BufferAttribute(new Uint16Array(count * 4).fill(bone), 4),
    );
    geometry.setAttribute(
        "skinWeight",
        new Float32BufferAttribute(
            Array.from({ length: count }, () => [1, 0, 0, 0]).flat(),
            4,
        ),
    );
    return geometry;
}

/** A metre-tall skinned rider standing on its soles at the origin, its legs
 *  named as the riders' skeletons name them: a body from 0.45 m up on the
 *  hips, and a foot under each ankle, 0.1 m over the sole, reaching ahead
 *  of it as a real foot does, so its sole is not under the bone. */
function makeRider() {
    const hips = new Bone();
    hips.name = "Hips";
    hips.position.y = 0.5;
    const bones = [hips];
    const model = new Group().add(hips);
    const skins = [
        new SkinnedMesh(
            skinTo(new BoxGeometry(0.7, 0.55, 0.6).translate(0, 0.725, 0), 0),
        ),
    ];
    for (const side of ["L", "R"]) {
        const thigh = new Bone();
        thigh.name = `${side}_Thigh`;
        thigh.position.x = side === "L" ? 0.15 : -0.15;
        const calf = new Bone();
        calf.name = `${side}_Calf`;
        calf.position.y = -0.2;
        const foot = new Bone();
        foot.name = `${side}_Foot`;
        foot.position.y = -0.2;
        hips.add(thigh.add(calf.add(foot)));
        bones.push(thigh, calf, foot);
        const sole = new BoxGeometry(0.15, 0.1, 0.25).translate(
            thigh.position.x,
            0.05,
            0.075,
        );
        skins.push(new SkinnedMesh(skinTo(sole, bones.length - 1)));
    }
    const skeleton = new Skeleton(bones);
    for (const skin of skins) {
        model.add(skin);
        skin.bind(skeleton);
    }
    return model;
}

function build(id: RideId) {
    const look = rides[id];
    const ride = buildRide(makeRide(id), look);
    const rig = buildRig(makeRider(), {
        fit: { url: "", scale: 1 },
        ride: look,
        seat: ride.seat,
    });
    const scene = new Group().add(ride.model, rig.body);
    /** The posed skin's bounds, measured from its deformed vertices. */
    const readSkin = () => {
        scene.updateMatrixWorld(true);
        return new Box3().setFromObject(rig.body, true);
    };
    return { ride, rig, scene, readSkin };
}

/** The middle of the skin's vertices that lie lowest now, by index, so the
 *  same points can be read again after the body moves. */
function findSole(scene: Object3D) {
    scene.updateMatrixWorld(true);
    const points: { skin: SkinnedMesh; index: number; at: Vector3 }[] = [];
    scene.traverse((part) => {
        if (!(part instanceof SkinnedMesh)) return;
        const count = part.geometry.getAttribute("position").count;
        for (let index = 0; index < count; index++)
            points.push({
                skin: part,
                index,
                at: part
                    .getVertexPosition(index, new Vector3())
                    .applyMatrix4(part.matrixWorld),
            });
    });
    const lowest = Math.min(...points.map(({ at }) => at.y));
    const sole = points.filter(({ at }) => at.y < lowest + 0.001);
    return () => {
        scene.updateMatrixWorld(true);
        return sole
            .reduce(
                (sum, { skin, index }) =>
                    sum.add(
                        skin
                            .getVertexPosition(index, new Vector3())
                            .applyMatrix4(skin.matrixWorld),
                    ),
                new Vector3(),
            )
            .divideScalar(sole.length);
    };
}

it.each(Object.values(RideId))(
    "rests the %s on the snow, and the rider's folded skin on its seat",
    (id) => {
        const { ride, scene, readSkin } = build(id);
        scene.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(ride.model);

        expect(bounds.min.y).toBeCloseTo(0, 2);
        expect(ride.seat).toBeGreaterThan(0);
        expect(ride.seat).toBeLessThanOrEqual(bounds.max.y);
        expect(readSkin().min.y).toBeCloseTo(ride.seat, 3);
    },
);

it("draws the toboggan 1.6 m long", () => {
    const { ride, scene } = build(RideId.Toboggan);
    scene.updateMatrixWorld(true);
    const length = new Box3()
        .setFromObject(ride.model)
        .getSize(new Vector3()).z;

    expect(length * riderScale).toBeCloseTo(1.6, 2);
});

it("keeps a seated rider's soles where they touch the seat while the body squashes and pitches", () => {
    const { ride, rig, scene } = build(RideId.Toboggan);
    const readSole = findSole(scene);
    const resting = readSole();
    expect(resting.y).toBeCloseTo(ride.seat, 3);

    rig.body.scale.set(1.2, 0.8, 1.2);
    rig.body.rotation.x = 0.3;
    rig.body.rotation.z = 0.2;

    const posed = readSole();
    expect(posed.distanceTo(resting)).toBeLessThan(0.001);
});
