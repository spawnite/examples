import { MeshBasicMaterial, PlaneGeometry } from "three";
import { readShadowTexture } from "../glowTexture";

//  The soft dark patch under each monster that sets it on the ground: one
//  quad and one material every monster shares.

let geometry: PlaneGeometry | undefined;
let material: MeshBasicMaterial | undefined;

/** A unit quad, made on first use. */
export function readShadowGeometry() {
    geometry ??= new PlaneGeometry(1, 1);
    return geometry;
}

/** The shared material, made on first use: a module a test imports draws
 *  no canvas. */
export function readShadowMaterial() {
    material ??= new MeshBasicMaterial({
        map: readShadowTexture(),
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    return material;
}
