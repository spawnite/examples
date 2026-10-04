import { trait, type Entity } from "koota";
import { defineEventTrait, defineTrait, states } from "@spawnite/engine/core";

//  The siege's own traits. Each is defined under a name, so the dump
//  carries it. One with no option the room streams to every page: the room
//  writes it, and a page only reads it. One that is `roomOnly` stays on
//  the room, and a page's system that read it would throw in development.

/** Why a run ended, as the room decided it: none while the run goes on. */
export enum EndCause {
    None = "",
    /** Every warden whose player is connected was down at once, with
     *  nobody standing to get the others up. */
    EveryoneDown = "everyone-down",
    /** A warden alone went down again with her self-revive spent. */
    FellAlone = "fell-alone",
}

/** A wave with a name, which changes what it sends; plain for the rest. */
export enum WaveName {
    Plain = "",
    /** Skitters, and more of them. */
    Swarm = "swarm",
    /** Brutes alone: fewer, and each a fight. */
    Brutes = "brutes",
    /** Mostly spitters, keeping their distance. */
    SpitterRain = "spitter-rain",
    /** A flood of weak husks, more standing at once than any other wave. */
    Horde = "horde",
}

/** The run as the room works it, on the siege's one entity beside its
 *  phase machine: the wave, and what its spawner counts down. The room's
 *  alone: its timers change every step, so pages read `SiegeTrait`, what
 *  of it they draw, which the room sets only when that changes. */
export const SiegeStateTrait = defineTrait(
    "siegeState",
    {
        /** The wave being fought, or during a breather the last one cleared. */
        wave: 0,
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
        /** Monsters the wave planned for the wardens in the room, which a
         *  warden joining mid-wave raises. */
        planned: 0,
        /** Seconds the ready wardens have waited on the rest. */
        waitedSeconds: 0,
        /** Whether a ready warden asked to start without the rest. */
        startAsked: false,
        /** The seed the night's named waves are drawn from, drawn afresh for
         *  each run. */
        nightSeed: 1,
        /** Whether the run went on past dawn, where waves keep climbing. */
        endless: false,
        /** Why the run ended, set on its last fall and kept until the next
         *  run starts. */
        cause: EndCause.None,
        /** The waves the run has held, Endless's among them: the wave being
         *  fought is not held yet. */
        held: 0,
    },
    { roomOnly: true },
);

/** The run as every page draws it beside the phase, which pages read from
 *  the phase machine's tags: the wave, the whole seconds
 *  of the countdown, the monsters still to come, the room's best, whether
 *  the ready wardens may start without the rest, the name of the wave
 *  being fought or during a breather the one coming next, whether the
 *  run went on past dawn, and why it ended, from its last fall on. */
export const SiegeTrait = defineTrait("siege", {
    wave: 0,
    secondsLeft: 0,
    toSpawn: 0,
    best: 0,
    startWithout: false,
    named: WaveName.Plain,
    endless: false,
    cause: EndCause.None,
});

/** How rare a card is, which its frame shows and, from the elements on,
 *  how big its step is. */
export enum Rarity {
    Common = "common",
    Rare = "rare",
    Epic = "epic",
}

/** One card of an offer: which, and at what rarity. */
export interface CardOffer {
    card: string;
    rarity: Rarity;
}

/** A hero's part in the run: her health, which the game keeps rather than
 *  the engine's, her colour among the wardens, and the monsters she has
 *  killed. Whether she is down, sheltered or ready is her machines', in
 *  `life.ts`. */
export const WardenTrait = defineTrait("warden", {
    health: 100,
    maximum: 100,
    /** The cards she is offered this breather; none outside one. */
    offer: (): CardOffer[] => [],
    /** The card she took this breather; empty until she takes one. */
    taken: "",
    /** Every card she has taken this run, in the order she took them. */
    cards: (): string[] => [],
    /** Her colour among the wardens, in join order. */
    hue: 0,
    kills: 0,
    /** Coin earned below a whole one, which the next coin tops up. */
    coinRemainder: 0,
    /** Cards still hers to take for the breathers she missed, the one
     *  offered now among them: a warden who joined a running run. */
    catchUp: 0,
    /** Whether she may get herself up once while she holds the circle
     *  alone: one each boss cycle. */
    selfRevive: true,
    /** Rerolls of her offer she has paid for this breather, which make
     *  the next dearer. */
    rerolls: 0,
    /** The cards of this offer she bought after her free one. */
    bought: (): string[] => [],
});

/** The gun from the fire's rack a warden holds, its upgrade tier, from 0
 *  to 3, and how many guns and tiers she has bought this run, so a page
 *  tells a purchase from a new run handing her the blaster back. Every page
 *  draws it in her hand and fires it on her trigger. */
export const WardenGunTrait = defineTrait("gun", {
    gun: "blaster",
    tier: 0,
    bought: 0,
});

/** The fire as every page draws it, on the siege: its level, which the
 *  wardens raise by feeding it coins, the coins fed toward the next, and
 *  what the next costs. */
export const FireTrait = defineTrait("fire", { level: 0, fuel: 0, next: 0 });

/** One warden's share of a monster's coins as it dies: to whom, from where
 *  it fell, and the whole coins her wallet took. */
export interface CoinBurst {
    to: Entity | null;
    x: number;
    y: number;
    z: number;
    coins: number;
}

/** On the siege the step a monster's coins go to the wardens: a burst for
 *  each warden who took a whole coin, which each page draws as coins that
 *  pop from the monster and fly to her. */
export const CoinBurstsTrait = defineEventTrait(
    "coins",
    (): { bursts: CoinBurst[] } => ({ bursts: [] }),
    { entities: ["bursts.to"] },
);

/** What a warden earned and spent this run, and what she bought. The
 *  room's alone: a run's timeline reads it. */
export const LedgerTrait = defineTrait(
    "ledger",
    {
        earned: 0,
        spent: 0,
        rerolls: 0,
        guns: 0,
        upgrades: 0,
        /** Cards she bought from an offer, after her free one. */
        cards: 0,
        /** Coins she fed the fire. */
        fed: 0,
    },
    { roomOnly: true },
);

/** The runs a career remembers it counted, newest last. */
export const recentRunsKept = 8;

/** A player's career across runs, on her warden: the XP she has earned,
 *  the runs she played, the nights she won, and the night seeds of the
 *  last `recentRunsKept` runs counted, so a run she joins again, even
 *  after runs in other rooms, is not counted twice; her save keeps these.
 *  `runXp` is the XP this run added, which the end screens show and the
 *  save leaves out. Her level is worked out from `xp` and never kept. */
export const CareerTrait = defineTrait("career", {
    xp: 0,
    runs: 0,
    dawns: 0,
    recentRuns: (): number[] => [],
    runXp: 0,
});

/** What of this run a warden's career already has: the waves held before
 *  she came, the XP added so far, and whether its dawn is counted. A
 *  warden with none was not in the run. The room's alone. */
export const CareerRunTrait = defineTrait(
    "careerRun",
    {
        fromWave: 0,
        credited: 0,
        dawned: false,
    },
    { roomOnly: true },
);

/** What a warden did this run that the awards name: the damage she dealt,
 *  the teammates she got up, and the seconds she stood alone with every
 *  teammate down. The room's alone. */
export const DeedsTrait = defineTrait(
    "deeds",
    { damage: 0, revives: 0, aloneSeconds: 0 },
    { roomOnly: true },
);

/** An award at a run's end. */
export enum AwardKind {
    /** The pair who made the most reactions together. */
    BestDuo = "best-duo",
    MostRevives = "most-revives",
    TopDamage = "top-damage",
    /** The warden who stood alone longest, every teammate down. */
    LastStanding = "last-standing",
    /** The reaction a pair made most, with its count. */
    TopReaction = "top-reaction",
}

/** A warden an award names: their name and their colour. */
export interface AwardedWarden {
    name: string;
    hue: number;
}

/** One award: which, the wardens it names, what it counts, and the
 *  reaction where it names one. The wardens are records, not a list of
 *  colours beside a list of names: the dump reads a list of two or three
 *  numbers back as a vector. */
export interface Award {
    kind: AwardKind;
    wardens: AwardedWarden[];
    value: number;
    reaction: string;
}

/** The run's awards, on the siege: set as dawn breaks or the run ends,
 *  and cleared as the next starts. */
export const AwardsTrait = defineTrait("awards", (): { list: Award[] } => ({
    list: [],
}));

/** A warden standing in the ring by the fire, as the last step found her:
 *  stepping in readies her and stepping out unreadies her. The room's
 *  alone. */
export const InRingTrait = defineTrait("inRing", undefined, { roomOnly: true });

/** A warden the siege has not welcomed yet: the room spawned her since
 *  its last step. The room's alone. */
export const NewcomerTrait = defineTrait("newcomer", undefined, {
    roomOnly: true,
});

/** How a warden walks and jumps when she is up: her movement as the room
 *  spawned her, whose speed her speed stat scales. The room's alone. */
export const StrideTrait = defineTrait(
    "stride",
    { speed: 0, jumpHeight: 0 },
    { roomOnly: true },
);

/** The wardens still on their feet whose player is connected, on the
 *  world, gathered once a step for every system that looks for one. The
 *  room's alone, and a plain Koota trait: a list gathered again each step
 *  is no state a dump or a checkpoint keeps. */
export const StandingWardensTrait = trait((): Entity[] => []);

/** The standing wardens a monster may chase and hurt, gathered with them:
 *  none sheltered. The room's alone, and plain as they are. */
export const TargetWardensTrait = trait((): Entity[] => []);

/** Shots a warden may fire now, which grow at her rate of fire up to a
 *  burst. The room's alone: it changes every step and no page reads it, so
 *  it is not streamed. */
export const ShotCreditTrait = defineTrait(
    "shotCredit",
    { shots: 0 },
    { roomOnly: true },
);

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
 *  hits, how many times it has struck, so a page can draw each blow, and
 *  how large it stands. */
export const MonsterTrait = defineTrait("monster", {
    kind: MonsterKind.Husk,
    speed: 3,
    damage: 10,
    strikes: 0,
    elite: EliteModifier.None,
    /** Times its kind's size it stands: the night's last colossus stands
     *  larger. */
    size: 1,
});

/** A colossus's slam as every page draws it: whether it is winding up,
 *  where the blow lands and how far it reaches, how many it has landed,
 *  so a page shows each, and the room's step its wind-up began on, so a
 *  page that joins or seeks mid-wind-up fills the ring as far as the
 *  blow has come. */
export const SlamTrait = defineTrait("slam", {
    winding: false,
    x: 0,
    z: 0,
    radius: 0,
    slams: 0,
    /** Set as the wind-up begins, and moved on by the steps a freeze held
     *  it, so it changes once a wind-up rather than every step. */
    windUpStep: 0,
});

/** On a monster while it is frozen: it walks, strikes, spits and slams
 *  nothing, and its slam's and spit's waits hold where they stand. The
 *  room streams it: a page steps the monster's machines too, and holds
 *  their waits by it as the room does. */
export const FrozenTrait = defineTrait("frozen");

/** On the siege's entity and on every warden while no warden's player is
 *  connected: the run's phase and each warden's shelter hold where they
 *  stand until a player comes back. The room streams it: a page steps
 *  those machines too, and holds them by it as the room does. */
export const UnattendedTrait = defineTrait("unattended");

/** A colossus's slam: `ready` until a warden comes within its reach,
 *  `winding` up for `windUp` seconds, `landing` once the wind-up has run
 *  out, which its step lands, then `cooling` for `cooldown` seconds. Pages
 *  draw the wind-up from `SlamTrait`. */
export const SlamMachine = states({
    id: "slamming",
    description:
        "A colossus's slam: ready, winding up, landing, then cooling down.",
    initial: "ready",
    context: { windUp: 0, cooldown: 0 },
    heldBy: [FrozenTrait],
    states: {
        ready: { on: { WIND: "winding" } },
        winding: {
            wait: { seconds: ({ context }) => context.windUp, then: "landing" },
        },
        landing: { on: { LANDED: "cooling" } },
        cooling: {
            wait: { seconds: ({ context }) => context.cooldown, then: "ready" },
        },
    },
});

/** A spitter's spit: `cooling` for `cooldown` seconds after it rises and
 *  after each bolt, then `ready` to spit at a warden it sees. */
export const SpitMachine = states({
    id: "spitting",
    description: "A spitter's spit: cooling down, then ready to spit.",
    initial: "ready",
    heldBy: [FrozenTrait],
    context: { cooldown: 0 },
    states: {
        ready: { on: { SPAT: "cooling" } },
        cooling: {
            wait: { seconds: ({ context }) => context.cooldown, then: "ready" },
        },
    },
});

/** Whether a spitter sees the warden it spits at, with nothing that stops
 *  a shot between them. The room's alone. */
export const SpitTrait = defineTrait(
    "spit",
    { sees: false },
    { roomOnly: true },
);

/** Where a monster stood when it last moved a metre, and the seconds it
 *  has stood off from every warden since. The room's alone. */
export const StandstillTrait = defineTrait(
    "standstill",
    { x: 0, z: 0, seconds: 0 },
    { roomOnly: true },
);

/** A spitter's bolt in flight, drawn where the stream puts it. */
export const BoltTrait = defineTrait("bolt", { size: 0.35 });

/** A bolt's flight: metres a second along each axis, the health it takes
 *  from the warden it meets, and seconds before it fades. The room's
 *  alone. */
export const BoltFlightTrait = defineTrait(
    "boltFlight",
    {
        x: 0,
        y: 0,
        z: 0,
        damage: 0,
        seconds: 0,
    },
    { roomOnly: true },
);

/** Seconds until a monster may strike again. The room's alone: it changes
 *  every step and a page draws the strikes, not the wait. */
export const ClawsTrait = defineTrait(
    "claws",
    { cooldown: 0 },
    { roomOnly: true },
);

/** Seconds left of her breath after a blow, in which no monster strikes
 *  her. The room's alone: it changes every step, and a page shows the
 *  blow, not the wait. */
export const MercyTrait = defineTrait(
    "mercy",
    { seconds: 0 },
    { roomOnly: true },
);

/** Seconds left of the grace after she gets up from a fall, in which no
 *  claw, bolt or slam hurts her. The room's alone, as her breath is. */
export const RiseGraceTrait = defineTrait(
    "riseGrace",
    { seconds: 0 },
    { roomOnly: true },
);

/** What an effect entity shows while it lives. */
export enum BurstKind {
    /** A monster falling. */
    Death = "death",
    /** A monster rising from the ground. */
    Rift = "rift",
    /** A warden getting up. */
    Revive = "revive",
    /** A monster the room took back, off the field or held still: it
     *  sinks into a rift and rises again with the wave's next batch. */
    Recall = "recall",
}

/** A short effect every page draws at the entity's place: its kind, the
 *  monster it belongs to where it is one's, its size in metres, and for a
 *  recall the id the stream names its monster by, so a page sinks that
 *  body and no other. */
export const BurstTrait = defineTrait("burst", {
    kind: BurstKind.Death,
    monster: MonsterKind.Husk,
    size: 1,
    monsterId: "",
});

/** Seconds before the room takes an entity away: a burst.
 *  The room's alone, so a count that changes every step is not streamed. */
export const LifetimeTrait = defineTrait(
    "lifetime",
    { seconds: 0 },
    { roomOnly: true },
);

/** The elements a warden holds, her first and, once the night deepens,
 *  her second, each at its level from 1 to 3 and with the points its
 *  element cards have filled its line with: an empty name and 0 for none.
 *  Every page draws them on her badge and her lines. */
export const WardenElementsTrait = defineTrait("elements", {
    first: "",
    firstLevel: 0,
    firstPoints: 0,
    second: "",
    secondLevel: 0,
    secondPoints: 0,
});

/** A monster's elements as the room works them: its burn and chill, each
 *  from 0 to full at 1, who last added to each and the seconds since, its
 *  freeze, its mark and who built it, and the rest after a reaction spent
 *  it. */
export interface AfflictionState {
    burn: number;
    burnBy: Entity | null;
    /** Seconds since the last Ember hit. */
    burnIdle: number;
    /** Seconds until the burn next ticks. */
    burnTick: number;
    /** Health its ticks took since its number was last shown, and seconds
     *  until it is shown again. */
    burnTaken: number;
    burnShowSeconds: number;
    chill: number;
    chillBy: Entity | null;
    chillIdle: number;
    /** Seconds left of its freeze: 0 while it moves. */
    frozenSeconds: number;
    frozenBy: Entity | null;
    /** The mark it wears, or an empty name for none. */
    mark: string;
    markBy: Entity | null;
    markSeconds: number;
    /** Seconds it has worn its mark. */
    markAge: number;
    /** Seconds before it may wear a mark or react again. */
    restSeconds: number;
    /** The share of its speed the steam clouds it stands in take. */
    steamSlow: number;
}

/** A monster's elements. The room's alone: pages draw `ElementLookTrait`. */
export const AfflictionsTrait = defineTrait(
    "afflictions",
    (): AfflictionState => ({
        burn: 0,
        burnBy: null,
        burnIdle: 0,
        burnTick: 0,
        burnTaken: 0,
        burnShowSeconds: 0,
        chill: 0,
        chillBy: null,
        chillIdle: 0,
        frozenSeconds: 0,
        frozenBy: null,
        mark: "",
        markBy: null,
        markSeconds: 0,
        markAge: 0,
        restSeconds: 0,
        steamSlow: 0,
    }),
    { roomOnly: true, entities: ["burnBy", "chillBy", "frozenBy", "markBy"] },
);

/** A monster's elements as every page draws them: its burn and chill in
 *  steps from 0 to `lookSteps`, whether it is frozen, its mark, whether a
 *  reaction left it resting, and the colour of the warden behind each, by
 *  her hue, or -1 for none. The room sets it only where it changed. */
export const ElementLookTrait = defineTrait("element", {
    burn: 0,
    chill: 0,
    frozen: false,
    mark: "",
    resting: false,
    burnHue: -1,
    chillHue: -1,
    markHue: -1,
});

/** Steps a monster's burn and chill are drawn in: fine enough to see each
 *  rise, coarse enough that a fading one is set a few times a second. */
export const lookSteps = 8;

/** A warden's Storm as the room keeps it for Thunderhead: seconds since
 *  her last Storm hit, the monster it struck and where it stood, and
 *  seconds until her next bolt may fall. The room's alone. */
export interface StormFiring {
    idleSeconds: number;
    target: Entity | null;
    x: number;
    y: number;
    z: number;
    boltSeconds: number;
}

export const FiringTrait = defineTrait(
    "firing",
    (): StormFiring => ({
        idleSeconds: Infinity,
        target: null,
        x: 0,
        y: 0,
        z: 0,
        boltSeconds: 0,
    }),
    { roomOnly: true, entities: ["target"] },
);

/** A steam cloud every page draws where it stands: how far it reaches,
 *  and how many times a reaction inside it has renewed it, so a page draws
 *  it for its full seconds again. */
export const SteamTrait = defineTrait("steam", { radius: 3.5, renewals: 0 });

/** A steam cloud as the room works it: the warden whose hit set it off,
 *  to whom its burn counts, and seconds until its burn next ticks. The
 *  room's alone: its `LifetimeTrait` takes it away. */
export interface SteamState {
    by: Entity | null;
    tickSeconds: number;
}

export const SteamClockTrait = defineTrait(
    "steamClock",
    (): SteamState => ({
        by: null,
        tickSeconds: 0,
    }),
    { roomOnly: true, entities: ["by"] },
);

/** What an element's moment draws, on every page. */
export enum StrikeKind {
    /** Storm's arc from monster to monster. */
    Arc = "arc",
    /** Storm on frozen: lightning through the frozen near it. */
    ChainShock = "chain-shock",
    /** Storm on blazing: an explosion. */
    Blast = "blast",
    /** Ember on frozen, Frost on blazing: a cloud rises. */
    SteamCloud = "steam-cloud",
    /** Storm's capstone: a bolt from the sky. */
    Thunderhead = "thunderhead",
    /** Ember's capstone: a monster at full burn erupts. */
    Meltdown = "meltdown",
    /** Frost's capstone: a frozen monster bursts as it dies. */
    Shatter = "shatter",
    /** The scattergun's upgrade: a pellet bouncing from monster to
     *  monster. */
    Ricochet = "ricochet",
    /** A burn's ticks over the last second, summed into one number. */
    Burn = "burn",
}

/** One element's moment: what, the warden whose hit made it, the one who
 *  built the mark a reaction spent, the times this pair has made this
 *  reaction this run, the health a burn took, and its points in metres,
 *  three numbers each: an arc's path, or the one place a burst stands. */
export interface Strike {
    kind: StrikeKind;
    by: Entity | null;
    with: Entity | null;
    count: number;
    amount: number;
    points: number[];
}

/** On the siege the step an element's moment happens: each in the order
 *  they happened. An event the room sends and each page draws, so no
 *  entity is spawned and streamed for a moment over in half a second. */
export const ElementStrikesTrait = defineEventTrait(
    "strikes",
    (): { strikes: Strike[] } => ({ strikes: [] }),
    { entities: ["strikes.by", "strikes.with"] },
);

/** The reactions each pair of wardens made this run, by the pair's hues,
 *  lowest first, and the reaction, such as `"0-2:chain-shock"`; one
 *  warden's own reaction names her hue twice. A page reads a reaction's
 *  repeats from it. */
export const ReactionTallyTrait = defineTrait(
    "reactions",
    (): { counts: Record<string, number> } => ({
        counts: {},
    }),
);

/** What a run's timeline counts that the siege keeps nowhere else, as
 *  totals that only grow: the seconds its monsters stood, all of them and
 *  the colossi alone; each kind's kills and the greatest health of those
 *  killed; the health the wardens' blows would take, an invulnerable
 *  warden's too, in all and by the kind that struck; and each time a teammate got a warden up, or she got
 *  herself up. */
export interface RunTotals {
    monsterSeconds: number;
    colossusSeconds: number;
    kills: Partial<Record<MonsterKind, number>>;
    felled: Partial<Record<MonsterKind, number>>;
    hurt: number;
    hurtBy: Partial<Record<MonsterKind, number>>;
    revives: number;
    selfRevives: number;
}

/** The run's totals on the siege. The room's alone. */
export const RunTallyTrait = defineTrait(
    "runTally",
    (): RunTotals => ({
        monsterSeconds: 0,
        colossusSeconds: 0,
        kills: {},
        felled: {},
        hurt: 0,
        hurtBy: {},
        revives: 0,
        selfRevives: 0,
    }),
    { roomOnly: true },
);
