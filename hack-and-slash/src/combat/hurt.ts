import { HealthTrait, TransformTrait } from "@spawnite/engine";
import type { Entity, World } from "koota";
import { deriveHero, loseXpOnDefeat, useProgress } from "../hero/progress";
import { shakeCamera } from "../view/cameraFx";
import { useBattle } from "./battle";
import { FloatKind, FloatTextTrait, HeroCombatTrait } from "./traits";

/** Takes `amount`, less her armor, off the hero. At zero she is defeated
 *  rather than reaped: she keeps a sliver of health, and the page shows
 *  the defeat. A monster's lunge and a boss's skills both hurt her here. */
export function hurtHero(world: World, hero: Entity, amount: number) {
    const health = hero.get(HealthTrait);
    const at = hero.get(TransformTrait);
    if (!health || !at || useBattle.getState().defeated) return;
    //  Nothing touches her mid-dodge.
    if ((hero.get(HeroCombatTrait)?.dodge ?? 0) > 0) {
        world.spawn(
            FloatTextTrait({
                x: at.x,
                y: at.y + 1.6,
                z: at.z,
                text: "Dodge",
                kind: FloatKind.Loot,
            }),
        );
        return;
    }
    const { armor } = deriveHero(useProgress.getState());
    const taken = Math.max(1, amount - armor);
    const left = health.current - taken;
    hero.set(HealthTrait, { current: Math.max(1, left) });
    hero.set(HeroCombatTrait, { flash: 0.2 });
    shakeCamera(0.2);
    world.spawn(
        FloatTextTrait({
            x: at.x,
            y: at.y + 1.6,
            z: at.z,
            amount: taken,
            kind: FloatKind.Hurt,
        }),
    );
    if (left <= 0)
        useBattle.setState({ defeated: true, xpLost: loseXpOnDefeat() });
}
