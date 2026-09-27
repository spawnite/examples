import { trait, type Entity } from "koota";
import { registerTrait } from "@spawnite/engine/core";

//  The siege's own traits. Each is registered under a name, so the dump
//  carries it and the room streams it to every page: the room writes them,
//  and a page only reads them.

/** Where a run stands. */
export enum SiegePhase {
    /** No run yet: the wardens in the room take their places. */
    Waiting = "waiting",
    /** Between waves: the countdown to the next. */
    Breather = "breather",
    /** A wave is spawning or still standing. */
    Fight = "fight",
    /** Every warden is down: the run's end screen. */
    Over = "over",
}

/** The run as the room works it, on the siege's one entity: the phase,
 *  the wave, and what its spawner counts down. The room's alone: its
 *  timers change every step, so pages read `SiegeTrait`, what of it they
 *  draw, which the room sets only when that changes. */
export const SiegeState = trait({
    phase: SiegePhase.Waiting,
    /** The wave being fought, or during a breather the last one cleared. */
    wave: 0,
    /** Seconds left of a breather, or of the wait for the wardens once one
     *  has taken her place. */
    secondsLeft: 0,
    /** Monsters of this wave not spawned yet. */
    toSpawn: 0,
    /** Seconds until the next batch spawns. */
    spawnSeconds: 0,
    /** The random draws' state, so a run replays from its seed. */
    seed: 1,
    /** The furthest wave any run in this room reached. */
    best: 0,
    /** Bosses of this wave not spawned yet, which rise before the rest. */
    bosses: 0,
});

/** The run as every page draws it: the phase, the wave, the whole seconds
 *  of the countdown, the monsters still to come, and the room's best. */
export const SiegeTrait = trait({
    phase: SiegePhase.Waiting,
    wave: 0,
    secondsLeft: 0,
    toSpawn: 0,
    best: 0,
});

/** Where the next coin lands: its own draws, apart from the siege's, on
 *  the world, since where a coin lands never changes what a wave sends. */
export const CoinScatter = trait({ seed: 7 });

/** A hero's part in the run: her health, which the game keeps rather than
 *  the engine's, whether she is down, her colour among the wardens, and the
 *  monsters she has killed. */
export const WardenTrait = trait({
    health: 100,
    maximum: 100,
    /** Out of the fight until a teammate gets her up or the wave is held. */
    down: false,
    /** Seconds a standing teammate has stood over her while she is down. */
    reviveSeconds: 0,
    /** Whether she has taken her place for the next run: pressed Play, or
     *  asked to go again on the end screen. */
    ready: false,
    /** The cards she is offered this breather; none outside one. */
    offer: (): string[] => [],
    /** The card she took this breather; empty until she takes one. */
    taken: "",
    /** Every card she has taken this run, in the order she took them. */
    cards: (): string[] => [],
    /** Her colour among the wardens, in join order. */
    hue: 0,
    kills: 0,
    /** Coin earned below a whole one, which the next coin tops up. */
    coinRemainder: 0,
});

/** How a warden walks and jumps when she is up: her movement as the room
 *  spawned her, whose speed her speed stat scales. The room's alone. */
export const Stride = trait({ speed: 0, jumpHeight: 0 });

/** The wardens still on their feet, on the world, gathered once a step for
 *  every system that looks for one. The room's alone. */
export const StandingWardens = trait((): Entity[] => []);

/** Shots a warden may fire now, which grow at her rate of fire up to a
 *  burst. The room's alone: it changes every step and no page reads it, so
 *  it is not streamed. */
export const ShotCredit = trait({ shots: 0 });

/** The kinds of the Hollow. */
export enum MonsterKind {
    /** The shambling many. */
    Husk = "husk",
    /** Small and fast. */
    Skitter = "skitter",
    /** Slow, huge, and hits hard. */
    Brute = "brute",
    /** Keeps its distance and spits a slow bolt. */
    Spitter = "spitter",
    /** The boss of every fifth wave: slams the ground round it. */
    Colossus = "colossus",
}

/** What makes a monster an elite, each drawn in its own colour. */
export enum EliteModifier {
    None = "none",
    /** Walks faster. */
    Swift = "swift",
    /** Takes more to bring down. */
    Armoured = "armoured",
    /** Bursts into two skitters when it falls. */
    Splitting = "splitting",
}

/** A monster of the Hollow: what it is, how fast it walks and hard it
 *  hits, and how many times it has struck, so a page can draw each blow. */
export const MonsterTrait = trait({
    kind: MonsterKind.Husk,
    speed: 3,
    damage: 10,
    strikes: 0,
    elite: EliteModifier.None,
});

/** A colossus's slam as every page draws it: whether it is winding up,
 *  where the blow lands and how far it reaches, and how many it has
 *  landed, so a page shows each. */
export const SlamTrait = trait({
    winding: false,
    x: 0,
    z: 0,
    radius: 0,
    slams: 0,
});

/** Seconds left of a colossus's wind-up, and until it may wind up again.
 *  The room's alone: pages draw the wind-up from `SlamTrait`. */
export const SlamClock = trait({ windUp: 0, cooldown: 0 });

/** Seconds until a spitter may spit again. The room's alone. */
export const Spit = trait({ cooldown: 0 });

/** A spitter's bolt in flight, drawn where the stream puts it. */
export const BoltTrait = trait({ size: 0.35 });

/** A bolt's flight: metres a second along each axis, the health it takes
 *  from the warden it meets, and seconds before it fades. The room's
 *  alone. */
export const BoltFlight = trait({
    x: 0,
    y: 0,
    z: 0,
    damage: 0,
    seconds: 0,
});

/** Seconds until a monster may strike again. The room's alone: it changes
 *  every step and a page draws the strikes, not the wait. */
export const Claws = trait({ cooldown: 0 });

/** Seconds left of her breath after a blow, in which no monster strikes
 *  her. The room's alone: it changes every step, and a page shows the
 *  blow, not the wait. */
export const Mercy = trait({ seconds: 0 });

/** What an effect entity shows while it lives. */
export enum BurstKind {
    /** A monster falling. */
    Death = "death",
    /** A monster rising from the ground. */
    Rift = "rift",
    /** A warden getting up. */
    Revive = "revive",
}

/** A short effect every page draws at the entity's place: its kind, the
 *  monster it belongs to where it is one's, and its size in metres. */
export const BurstTrait = trait({
    kind: BurstKind.Death,
    monster: MonsterKind.Husk,
    size: 1,
});

/** A coin on the ground, worth `value` to the warden who reaches it.
 *  `fading` once it is about to go, so a page can blink it. */
export const CoinTrait = trait({ value: 1, fading: false });

/** Seconds before the room takes an entity away: a burst, a coin.
 *  The room's alone, so a count that changes every step is not streamed. */
export const Lifetime = trait({ seconds: 0 });

registerTrait("siege", SiegeTrait);
registerTrait("warden", WardenTrait);
registerTrait("monster", MonsterTrait);
registerTrait("coin", CoinTrait);
registerTrait("slam", SlamTrait);
registerTrait("bolt", BoltTrait);
registerTrait("burst", BurstTrait);
