import { useFrame } from "@react-three/fiber";
import { useHas, useQueryFirst, useTrait } from "koota/react";
import { useMemo, useRef } from "react";
import {
    AuthorityTrait,
    GroundTrait,
    HeroTrait,
    JumpTrait,
    TransformTrait,
    useHeadless,
} from "@spawnite/engine";
import {
    advanceFootWalk,
    createFootWalk,
    FootSurface,
    readFootSurface,
} from "./footfalls";
import { playSound, Sound } from "./sounds";
import { LifeMachine } from "../siege/life";

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
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const down = useHas(hero, LifeMachine.is.down);
    const ground = useTrait(useQueryFirst(GroundTrait), GroundTrait)?.surface;
    //  Read in the frame, which a trait's change does not rebuild.
    const downRef = useRef(down);
    downRef.current = down;
    const walk = useMemo(createFootWalk, [hero]);

    useFrame(() => {
        const position = hero?.get(TransformTrait);
        if (headless || !position) return;
        //  The walk counts on in the air, so her stride stays in step, but a
        //  foot in the air strikes nothing.
        if (!advanceFootWalk(walk, position) || downRef.current) return;
        if (!(hero?.get(JumpTrait)?.grounded ?? true)) return;
        playSound(footSounds[readFootSurface(position, ground)]);
    });

    return null;
}
