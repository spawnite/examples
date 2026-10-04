import { Suspense, useMemo } from "react";
import { Clone } from "@react-three/drei";
import {
    Entity,
    Spin,
    TrackTrigger,
    useHeadless,
    useModel,
    type Track,
} from "@spawnite/engine";
import coin from "@spawnite/assets/models/sled/coin.glb?url";
import {
    coinFloat,
    CourseKind,
    readCourseRegion,
    type CourseSpot,
} from "../ride/course";
import { Course } from "./Course";

/** Radians a second: the spin says it is there to take. */
const spinSpeed = 3;

interface CoinProps {
    track: Track;
    spot: CourseSpot;
}

/** A coin floating at the sled's middle over its spot, spinning. The
 *  rider who enters it takes it into its wallet, and it leaves the world. */
export function Coin({ track, spot }: CoinProps) {
    const position = useMemo(() => {
        const point = track.pointAt(spot.at, spot.side);
        point.y += coinFloat + (spot.lift ?? 0);
        return point;
    }, [track, spot]);
    //  Headless there is no page to draw it on, so no model loads.
    const headless = useHeadless();
    return (
        <Entity name="Coin" position={position.toArray()}>
            <TrackTrigger
                track={track}
                {...readCourseRegion(CourseKind.Coin, spot, track)}
            />
            <Course kind={CourseKind.Coin} />
            <Spin speed={spinSpeed} />
            {!headless && (
                <Suspense fallback={null}>
                    <CoinModel />
                </Suspense>
            )}
        </Entity>
    );
}

function CoinModel() {
    return <Clone object={useModel(coin).scene} castShadow />;
}
