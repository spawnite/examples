import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useQueryFirst } from "koota/react";
import { Vector3, type Mesh } from "three";
import {
    InstancedModel,
    RefTrait,
    registerModel,
    type InstancePlacement,
    type Track,
} from "@spawnite/engine";
import post from "@spawnite/assets/models/sled/sling-post-wood.glb?url";
import { palette } from "../palette";
import { spawnDistance } from "../ride/rider";
import { isAiming, pullMaximum, SlingTrait } from "../ride/sling";

const postModel = "sling-post";
registerModel(postModel, post);

/** Metres outside the aim's reach each post stands: half a rider, so a
 *  full aim stops against the fork. */
const postClearance = 0.5;
/** Metres above the snow the band is strung: the rider's middle, and the
 *  middle of the post model, which is a metre tall about its origin. */
const bandHeight = 0.5;
const bandGauge = 0.09;

interface SlingPostsProps {
    track: Track;
    aimSpan: number;
}

//  Written in place, once a frame.
const anchor = new Vector3();

/** The point `lateral` across the start line, at the band's height. */
function readBandPoint(track: Track, lateral: number) {
    const point = track.pointAt(spawnDistance, lateral);
    point.y += bandHeight;
    return point;
}

/** The slingshot's look: two posts either side of the start line and a
 *  band strung between them through the rider, drawn back with the pull.
 *  Once the sling fires the band snaps straight across. Drawn only. */
export function SlingPosts({ track, aimSpan }: SlingPostsProps) {
    //  Found again when the rider changes, not with a query every frame.
    const rider = useQueryFirst(SlingTrait, RefTrait);
    const { tips, posts } = useMemo(() => {
        const tips = [1, -1].map((side) =>
            readBandPoint(track, side * (aimSpan + postClearance)),
        );
        return {
            tips,
            //  Each post's foot on the snow under its tip.
            posts: tips.map(({ x, y, z }): InstancePlacement => ({
                position: [x, y - bandHeight, z],
                //  White, so the batch shares the tinted forest's program.
                tint: 0xffffff,
            })),
        };
    }, [track, aimSpan]);
    const bandRefs = useRef<(Mesh | null)[]>([]);

    useFrame(() => {
        const sling = rider?.get(SlingTrait);
        const object = rider?.get(RefTrait)?.object;
        const drawn = rider && isAiming(rider) && sling && object;
        //  The rider faces negative z, so its pull is back along positive z.
        if (drawn)
            anchor
                .set(0, 0, sling.charge * pullMaximum)
                .applyQuaternion(object.quaternion)
                .add(object.position);
        for (let index = 0; index < tips.length; index++) {
            const band = bandRefs.current[index];
            if (!band) continue;
            //  Straight, one piece spans the posts: a draw fewer in each
            //  pass for the rest of the run.
            band.visible = !!drawn || index === 0;
            if (!band.visible) continue;
            const tip = tips[index];
            const end = drawn ? anchor : tips[1];
            band.position.addVectors(tip, end).multiplyScalar(0.5);
            band.lookAt(end);
            band.scale.set(
                bandGauge,
                bandGauge,
                Math.max(0.01, tip.distanceTo(end)),
            );
        }
    });

    return (
        <>
            <Suspense fallback={null}>
                <InstancedModel model={postModel} placements={posts} />
            </Suspense>
            {tips.map((tip, index) => (
                <mesh
                    key={index}
                    ref={(mesh) => {
                        bandRefs.current[index] = mesh;
                    }}
                    castShadow
                >
                    <boxGeometry />
                    <meshStandardMaterial color={palette.band} />
                </mesh>
            ))}
        </>
    );
}
