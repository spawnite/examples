import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait } from "koota/react";
import { useMemo, useRef } from "react";
import {
    Authority,
    Ground,
    Hero,
    Jump,
    Transform,
    useHeadless,
} from "@spawnite/engine";
import { WardenTrait } from "../siege/traits";
import {
    advanceFootWalk,
    createFootWalk,
    FootSurface,
    readFootSurface,
} from "./footfalls";
import { playSound, Sound } from "./sounds";

/** The sound of a foot on each surface. */
const footSounds: Record<FootSurface, Sound> = {
    [FootSurface.Grass]: Sound.StepGrass,
    [FootSurface.Path]: Sound.StepPath,
    [FootSurface.Paving]: Sound.StepPaving,
};

/** Her own footsteps, one each stride she covers, on the grass, the packed
 *  earth or the stones under her feet; none while she is down or in the
 *  air. */
export function Footsteps() {
    const headless = useHeadless();
    const hero = useQueryFirst(Hero, Authority);
    const down = useTrait(hero, WardenTrait)?.down ?? false;
    const ground = useTrait(useQueryFirst(Ground), Ground)?.surface;
    //  Read in the frame, which a trait's change does not rebuild.
    const downRef = useRef(down);
    downRef.current = down;
    const walk = useMemo(createFootWalk, [hero]);

    useFrame(() => {
        const position = hero?.get(Transform);
        if (headless || !position) return;
        //  The walk counts on in the air, so her stride stays in step, but a
        //  foot in the air strikes nothing.
        if (!advanceFootWalk(walk, position) || downRef.current) return;
        if (!(hero?.get(Jump)?.grounded ?? true)) return;
        playSound(footSounds[readFootSurface(position, ground)]);
    });

    return null;
}
