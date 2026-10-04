import { useMemo } from "react";
import { Particles } from "@spawnite/engine";
import { readSparkEffect } from "./sparkEffect";

/** The field's particles, holding every effect a view here plays. */
export function FieldParticles() {
    const effects = useMemo(() => [readSparkEffect()], []);
    return <Particles effects={effects} />;
}
