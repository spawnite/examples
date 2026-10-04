import records from "@spawnite/assets/avatars.json";
import chifa from "@spawnite/assets/avatars/chifa.vrm?url";
import fris from "@spawnite/assets/avatars/fris.vrm?url";
import {
    extendVrmLoader,
    listMotionUrls,
    useModel,
    type VrmBody,
} from "@spawnite/engine";

//  The wardens' bodies: the two avatars the platform ships, worn in turn by
//  join order.
//  JSON types a bone name as a plain string.
const shipped = records as Record<"fris" | "chifa", Omit<VrmBody, "model">>;
const bodies: VrmBody[] = [
    { ...shipped.fris, model: fris },
    { ...shipped.chifa, model: chifa },
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
    //  In the list shapes the engine's VrmView and HeroAnimationView read,
    //  since the loader's cache keys on the whole list.
    for (const hue of [0, 1])
        useModel.preload([createWardenBody(hue).model], extendVrmLoader);
    useModel.preload(listMotionUrls(), extendVrmLoader);
}
