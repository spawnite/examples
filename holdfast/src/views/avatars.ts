import chifa from "@game/assets/avatars/chifa.vrm?url";
import fris from "@game/assets/avatars/fris.vrm?url";
import { useGLTF } from "@react-three/drei";
import { extendVrmLoader, MOTION_URLS, type VrmBody } from "@spawnite/engine";

//  The wardens' bodies: the two avatars the platform ships, worn in turn by
//  join order. Their tuning is the mmorpg's (games/mmorpg/src/avatars.ts),
//  where each was fitted to the engine's clips.

const bodies: VrmBody[] = [
    {
        model: fris,
        scale: 1,
        armSpread: {
            left: { out: 0.27, forward: 0.06 },
            right: { out: 0.1, forward: 0 },
        },
        armColliders: {
            radii: { upperArm: 0.06, lowerArm: 0.055, hand: 0.045 },
            bonePrefix: "Skirt_",
        },
    },
    {
        model: chifa,
        scale: 1,
        armSpread: {
            left: { out: 0, forward: 0 },
            right: { out: 0, forward: 0 },
        },
        armColliders: {
            radii: { upperArm: 0.06, lowerArm: 0.025, hand: 0.045 },
            bonePrefix: "Cape",
        },
    },
];

/** The body a warden of `hue` wears. Its address carries the hue as a
 *  fragment, which the fetch ignores and the loader's cache keys on, so two
 *  wardens in one body each get a VRM of their own: the loader hands one
 *  live VRM per address. */
export function createWardenBody(hue: number): VrmBody {
    const body = bodies[hue % bodies.length];
    return { ...body, model: `${body.model}#warden-${hue}` };
}

/** Starts fetching the first two wardens' bodies and every clip while the
 *  page shows its menu, so a run opens on bodies rather than on nothing. */
export function preloadWardenBodies() {
    for (const hue of [0, 1])
        useGLTF.preload(
            createWardenBody(hue).model,
            false,
            false,
            extendVrmLoader,
        );
    useGLTF.preload(MOTION_URLS, false, false, extendVrmLoader);
}
