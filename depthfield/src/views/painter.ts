import {
    CircleGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    RingGeometry,
    type BufferGeometry,
    type Camera,
} from "three";
import { u } from "../rules/data";
import type { Spot } from "../rules/field";
import { liftNeon, neonLift } from "./neon";

//  An immediate-mode painter for the shapes the source drew on its canvas
//  each frame: filled discs and rings on the ground, lanes, beams, and
//  bars and glows that face the camera. Each call takes a mesh from a pool
//  and places it; a frame's `begin` hands the pool back, and `end` hides
//  what the frame did not use. Each mesh has its own material, so each
//  shape keeps its own colour and fade. A solid shape's colour is lifted to
//  glow, and a faint fill keeps its own: a shot, a ring or a lane's edge
//  blooms, and the telegraph's wash under it stays a wash.

/** The ground's height a flat shape lies at, over the floor's grid. */
const groundLift = 0.06;

const disc = new CircleGeometry(1, 48);
const plane = new PlaneGeometry(1, 1);

//  Rings share a geometry per band width, as a share of the radius, to a
//  hundredth, and per arc, to a fiftieth of the turn.
const rings = new Map<string, RingGeometry>();

function readRing(widthShare: number, arcShare: number) {
    const band = Math.min(
        0.99,
        Math.max(0.01, Math.round(widthShare * 100) / 100),
    );
    const arc = Math.min(1, Math.max(0.02, Math.round(arcShare * 50) / 50));
    const key = `${band}:${arc}`;
    let ring = rings.get(key);
    if (!ring) {
        const turn = arc * Math.PI * 2;
        //  From the top, clockwise as seen from above.
        ring = new RingGeometry(1 - band, 1, 64, 1, Math.PI / 2 - turn, turn);
        rings.set(key, ring);
    }
    return ring;
}

/** How far a shape's colour is lifted toward the glow: not at all at
 *  two fifths opaque or less, fully when solid. */
function readLift(opacity: number) {
    const solid = Math.min(1, Math.max(0, (opacity - 0.4) / 0.5));
    return 1 + (neonLift - 1) * solid;
}

/** A shape's paint: its colour and how much of it shows. */
export interface Paint {
    color: string;
    opacity?: number;
}

interface Lane extends Paint {
    from: Spot;
    to: Spot;
    /** Metres across. */
    width: number;
    /** Metres above the ground; on it when left out. */
    height?: number;
}

interface Circle extends Paint {
    at: Spot;
    radius: number;
}

interface Ring extends Circle {
    /** Metres the ring's band spans. */
    width: number;
    /** The share of the turn drawn, from the top, clockwise; all of it
     *  when left out. */
    share?: number;
}

/** A telegraph on a circle: how near its strike is, 0 to 1. */
interface CircleTell extends Circle {
    charge: number;
}

interface Billboard extends Paint {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
}

export class Painter {
    readonly group = new Group();
    private pool: Mesh[] = [];
    private used = 0;
    private camera: Camera | null = null;

    begin(camera: Camera) {
        this.camera = camera;
        this.used = 0;
    }

    end() {
        for (let index = this.used; index < this.pool.length; index++)
            this.pool[index].visible = false;
    }

    private take(geometry: BufferGeometry, { color, opacity = 1 }: Paint) {
        let mesh = this.pool[this.used];
        if (!mesh) {
            mesh = new Mesh(
                geometry,
                new MeshBasicMaterial({
                    transparent: true,
                    depthWrite: false,
                    toneMapped: false,
                    side: DoubleSide,
                }),
            );
            mesh.renderOrder = 1;
            this.pool.push(mesh);
            this.group.add(mesh);
        }
        this.used++;
        mesh.geometry = geometry;
        mesh.visible = true;
        mesh.rotation.set(0, 0, 0, "XYZ");
        mesh.quaternion.identity();
        mesh.scale.set(1, 1, 1);
        const material = mesh.material as MeshBasicMaterial;
        liftNeon(color, material.color, readLift(opacity));
        material.opacity = opacity;
        return mesh;
    }

    /** A filled disc on the ground. */
    disc({ at, radius, ...paint }: Circle) {
        if (radius <= 0) return;
        const mesh = this.take(disc, paint);
        mesh.position.set(at.x, groundLift, at.z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.scale.set(radius, radius, 1);
    }

    /** A ring on the ground, or the arc of one. */
    ring({ at, radius, width, share = 1, ...paint }: Ring) {
        if (radius <= 0) return;
        const geometry = readRing(width / radius, share);
        const mesh = this.take(geometry, paint);
        mesh.position.set(at.x, groundLift + 0.001, at.z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.scale.set(radius, radius, 1);
    }

    /** A strike's telegraph on a circle: its outline, and a disc filling
     *  it as the strike nears, as an elite marks its rifts. */
    tellCircle({ at, radius, charge, color }: CircleTell) {
        this.disc({ at, radius: radius * charge, color, opacity: 0.6 });
        this.ring({ at, radius, width: u(2), color });
    }

    /** A band from one spot to another, flat, on the ground or above it. */
    lane({ from, to, width, height = 0, ...paint }: Lane) {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const length = Math.hypot(dx, dz);
        if (length <= 0) return;
        const mesh = this.take(plane, paint);
        mesh.position.set(
            (from.x + to.x) / 2,
            groundLift + height,
            (from.z + to.z) / 2,
        );
        //  Laid flat, then turned about the vertical to point along the lane.
        mesh.rotation.set(-Math.PI / 2, Math.atan2(-dz, dx), 0, "YXZ");
        mesh.scale.set(length, width, 1);
    }

    /** A flat rectangle facing the camera, its centre at (x, y, z). */
    billboard({ x, y, z, width, height, ...paint }: Billboard) {
        const mesh = this.take(plane, paint);
        mesh.position.set(x, y, z);
        if (this.camera) mesh.quaternion.copy(this.camera.quaternion);
        mesh.scale.set(width, height, 1);
        mesh.renderOrder = 2;
    }

    /** A round glow facing the camera. */
    glow({ x, y, z, width, ...paint }: Omit<Billboard, "height">) {
        const mesh = this.take(disc, paint);
        mesh.position.set(x, y, z);
        if (this.camera) mesh.quaternion.copy(this.camera.quaternion);
        mesh.scale.set(width, width, 1);
    }
}
