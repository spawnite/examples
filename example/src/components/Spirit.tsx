import { useEffect, useMemo } from "react";
import type { Material } from "three";
import { Player, type PlayerProps } from "@spawnite/engine";
import { makeSpiritGlowMaterial } from "../materials/spiritGlow";
import "../models";

/** The player, as the void spirit: its rigged model playing its idle,
 *  walk, run and jump, in its glowing material. */
export function Spirit(props: Omit<PlayerProps, "model" | "material">) {
    //  The Player leaves what it is handed to the game, so the materials
    //  this mount makes go when it does.
    const { material, made } = useMemo(() => {
        const made: Material[] = [];
        const material = (original: Material) => {
            const glow = makeSpiritGlowMaterial(original);
            made.push(glow);
            return glow;
        };
        return { material, made };
    }, []);
    useEffect(
        () => () => {
            for (const each of made) each.dispose();
        },
        [made],
    );
    return <Player model="spirit-void" material={material} {...props} />;
}
