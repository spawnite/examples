import { trait } from "koota";
import type { Behaviour } from "@spawnite/engine";
import { RunContext } from "@spawnite/engine";

/** What a monster is: the spawn slot it came from, what it is worth, the
 *  area it roams, where it spawned, and its temper. */
export const MonsterTrait = trait({
    slot: 0,
    xp: 0,
    damage: 0,
    radius: 0.4,
    speed: 1,
    areaX: 0,
    areaZ: 0,
    areaRadius: 5,
    /** Where it spawned, which it walks back to after a chase. */
    homeX: 0,
    homeZ: 0,
    aggressive: false,
    aggroRange: 5,
    /** A boss: it casts skills, and no hit knocks it back. */
    boss: false,
});

/** A boss's skills in flight, which the boss system writes each step. */
export const BossStateTrait = trait({
    /** Seconds until it may start its next skill. */
    cooldown: 2,
    /** Seconds it stands still to cast what it just started: the whole of
     *  the attack's warning, then its strike as the attack goes off. */
    casting: 0,
    /** The warning's seconds, and the way it faces while it casts. */
    castLength: 0,
    castX: 0,
    castZ: 1,
    /** Seconds until a telegraphed dash sets off, and the dash's way and
     *  length; negative while no dash waits. */
    dashIn: -1,
    dashX: 0,
    dashZ: 0,
    dashLength: 0,
    /** Seconds the dash has left to run. */
    dashing: 0,
});

export const MonsterBehaviour: Behaviour<typeof MonsterTrait> = {
    trait: MonsterTrait,
    runsOn: RunContext.Server,
    source: "src/monsters/traits.ts",
    description:
        "A monster of the wilds: worth experience; roams its area, hunts the hero when angered, and walks home when it gives up.",
};

/** Seconds of a monster's attack: the wind-up it telegraphs, the moment its
 *  lunge lands, and the whole attack until it can move again. */
export const attackWindup = 0.4;
export const attackLands = 0.5;
export const attackLength = 0.75;

export enum MonsterMode {
    /** Wandering its area. */
    Roam,
    /** After the hero, and lunging at her. */
    Hunt,
    /** Walking back to where it spawned, deaf to the hero on the way. */
    Return,
}

/** What a monster is doing, which the combat systems write each step. */
export const MonsterStateTrait = trait({
    /** Seconds its hit flash has left. */
    flash: 0,
    /** Metres a second it is knocked back at, and for how long. */
    knockX: 0,
    knockZ: 0,
    knockSeconds: 0,
    /** Seconds until it can start another attack. */
    attackCooldown: 0,
    /** Seconds into its current attack; negative while it is not attacking. */
    attack: -1,
    /** The way its attack lunges, fixed as the wind-up starts. */
    lungeX: 0,
    lungeZ: 0,
    /** Roaming its area, hunting the hero, or walking home from a chase. */
    mode: MonsterMode.Roam as MonsterMode,
    /** Where the current chase began, which it gives up past twice its
     *  aggro range. */
    chaseX: 0,
    chaseZ: 0,
    /** Where it wanders to while nothing is near, inside its area. */
    wanderX: 0,
    wanderZ: 0,
    wanderSeconds: 0,
    /** Poison and a burn from her gear: each its damage a second and the
     *  seconds it has left; and the seconds until they next bite. */
    poison: 0,
    poisonLeft: 0,
    burn: 0,
    burnLeft: 0,
    afflictTick: 0,
});
