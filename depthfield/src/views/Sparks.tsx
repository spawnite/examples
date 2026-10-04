import { Color } from "three";
import { useParticles } from "@spawnite/engine";
import { SparksTrait as SparksEvent } from "../rules/traits";
import { liftNeon } from "./neon";
import { readSparkEffect, sparkHeight } from "./sparkEffect";
import { useEventRecords } from "./useEventRecords";

//  Written in place for each burst.
const color = new Color();

/** Plays each burst of sparks the rules throw. */
export function Sparks() {
    const particles = useParticles();

    useEventRecords(
        SparksEvent,
        (entity) => entity.get(SparksEvent)?.list,
        (burst) => {
            particles.spawn(readSparkEffect(), {
                at: { x: burst.x, y: sparkHeight, z: burst.z },
                color: liftNeon(burst.color, color),
                count: burst.count,
            });
        },
    );

    return null;
}
