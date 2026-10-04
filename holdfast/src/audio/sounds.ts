import { followVolume, VolumeChannel } from "@spawnite/engine";
import blast from "@spawnite/assets/sounds/holdfast/blast.mp3?url";
import card from "@spawnite/assets/sounds/holdfast/card.mp3?url";
import chainShock from "@spawnite/assets/sounds/holdfast/chain-shock.mp3?url";
import crit from "@spawnite/assets/sounds/holdfast/crit.mp3?url";
import coin from "@spawnite/assets/sounds/holdfast/holdfast-coin.mp3?url";
import down from "@spawnite/assets/sounds/holdfast/down.mp3?url";
import duskDrone from "@spawnite/assets/sounds/holdfast/dusk-drone.mp3?url";
import feed from "@spawnite/assets/sounds/holdfast/feed.mp3?url";
import fallOne from "@spawnite/assets/sounds/holdfast/fall-1.mp3?url";
import fallTwo from "@spawnite/assets/sounds/holdfast/fall-2.mp3?url";
import fallThree from "@spawnite/assets/sounds/holdfast/fall-3.mp3?url";
import fireCrackle from "@spawnite/assets/sounds/holdfast/fire-crackle.mp3?url";
import freeze from "@spawnite/assets/sounds/holdfast/freeze.mp3?url";
import hitOne from "@spawnite/assets/sounds/holdfast/hit-1.mp3?url";
import hitTwo from "@spawnite/assets/sounds/holdfast/hit-2.mp3?url";
import hurt from "@spawnite/assets/sounds/holdfast/hurt.mp3?url";
import meltdown from "@spawnite/assets/sounds/holdfast/meltdown.mp3?url";
import nightCrickets from "@spawnite/assets/sounds/holdfast/night-crickets.mp3?url";
import rackBuy from "@spawnite/assets/sounds/holdfast/rack-buy.mp3?url";
import rail from "@spawnite/assets/sounds/holdfast/rail-shot.mp3?url";
import refused from "@spawnite/assets/sounds/holdfast/refused.mp3?url";
import reroll from "@spawnite/assets/sounds/holdfast/reroll.mp3?url";
import revive from "@spawnite/assets/sounds/holdfast/revive.mp3?url";
import ricochet from "@spawnite/assets/sounds/holdfast/ricochet.mp3?url";
import rift from "@spawnite/assets/sounds/holdfast/rift.mp3?url";
import runOver from "@spawnite/assets/sounds/holdfast/run-over.mp3?url";
import scattergun from "@spawnite/assets/sounds/holdfast/scattergun-shot.mp3?url";
import shatter from "@spawnite/assets/sounds/holdfast/shatter.mp3?url";
import shotOne from "@spawnite/assets/sounds/holdfast/shot-1.mp3?url";
import shotTwo from "@spawnite/assets/sounds/holdfast/shot-2.mp3?url";
import stepGrassOne from "@spawnite/assets/sounds/holdfast/step-grass-1.mp3?url";
import stepGrassTwo from "@spawnite/assets/sounds/holdfast/step-grass-2.mp3?url";
import stepGrassThree from "@spawnite/assets/sounds/holdfast/step-grass-3.mp3?url";
import stepPathOne from "@spawnite/assets/sounds/holdfast/step-path-1.mp3?url";
import stepPathTwo from "@spawnite/assets/sounds/holdfast/step-path-2.mp3?url";
import stepPathThree from "@spawnite/assets/sounds/holdfast/step-path-3.mp3?url";
import stepPavingOne from "@spawnite/assets/sounds/holdfast/step-paving-1.mp3?url";
import stepPavingTwo from "@spawnite/assets/sounds/holdfast/step-paving-2.mp3?url";
import stepPavingThree from "@spawnite/assets/sounds/holdfast/step-paving-3.mp3?url";
import steam from "@spawnite/assets/sounds/holdfast/steam.mp3?url";
import thunder from "@spawnite/assets/sounds/holdfast/thunder.mp3?url";
import upgrade from "@spawnite/assets/sounds/holdfast/upgrade.mp3?url";
import waveHeld from "@spawnite/assets/sounds/holdfast/wave-held.mp3?url";
import waveStart from "@spawnite/assets/sounds/holdfast/wave-start.mp3?url";
import { AudioContext as ThreeAudioContext } from "three";
import { blendLoopSeam } from "./loops";
import {
    admitVoice,
    AmbienceLayerName,
    AmbienceMood,
    clampTier,
    createMixState,
    duckHoldSeconds,
    duckLevel,
    duckReleaseSeconds,
    readAllyPlay,
    readAmbienceLevel,
    readDuckLevel,
    readTierPitch,
    SoundTier,
} from "./mix";

//  The game's sounds: recorded files, each loaded once and played a little
//  higher or lower and louder or quieter each time, so a burst of shots
//  never repeats one sample. Until a file has loaded, and wherever one
//  fails to, a sound falls back to its recipe, synthesized on the page by
//  the Web Audio API. The files load as the page opens, so a cue that
//  sounds soon after Play, such as the first wave's horn, is already the
//  file's. The browser starts audio only after a gesture, so the context
//  resumes on each press, which the Play menu's click always is.

export enum Sound {
    Shot = "shot",
    /** The scattergun's pull: a heavy crunch. */
    Scattergun = "scattergun",
    /** The rail's shot: a large laser's crack over a low sweep. */
    Rail = "rail",
    /** A scattergun pellet bouncing off a monster: a ping of metal. */
    Ricochet = "ricochet",
    /** A gun bought at the rack: a latch closing over the coins. */
    RackBuy = "rackBuy",
    /** A gun raised a tier: a rising chime. */
    Upgrade = "upgrade",
    /** Coins thrown on the fire: a rush of flame. */
    Feed = "feed",
    /** The fire rising a level: the rush, lower, under a rising fifth. */
    FireRises = "fireRises",
    /** The card offer dealt again: cards flicking over. */
    Reroll = "reroll",
    /** A purchase the wallet cannot meet: a short buzz. */
    Refused = "refused",
    Hit = "hit",
    /** Her own shot killing: a dull, heavy knock under a short tick, the
     *  confirm Destiny and Apex play, under a weak spot's ding. */
    Kill = "kill",
    /** A hit on a weak spot: a bright ring of struck metal over the hit. */
    Crit = "crit",
    /** A monster falling: a soft thud of a body on the grass. The many
     *  deaths of a wave are the quietest sound of the fight. */
    Fall = "fall",
    /** A brute falling: the same thud, lower and heavier. */
    HeavyFall = "heavyFall",
    /** A colossus falling: a deep boom, a moment of its own. */
    ColossusFall = "colossusFall",
    Coin = "coin",
    Hurt = "hurt",
    Down = "down",
    Revive = "revive",
    WaveStart = "waveStart",
    /** A named wave or a colossus's rising: the wave's horn, lower, under
     *  a clash. */
    NamedWave = "namedWave",
    WaveHeld = "waveHeld",
    /** The night won: a rising major chord over the held wave's chime. */
    Dawn = "dawn",
    Card = "card",
    /** A common card turning face up as the offer is dealt: a short
     *  flick of a card, played a little higher for each after the first. */
    CardFlip = "cardFlip",
    /** A card she took landing in her panel: three quick notes rising. */
    CardLand = "cardLand",
    /** A rare card turning face up: the card's chime, higher, over two
     *  bright pings. */
    RareCard = "rareCard",
    /** An epic card gathering itself before it turns: plucks climbing
     *  faster and higher. */
    EpicCharge = "epicCharge",
    /** An epic card bursting face up: the held wave's chime, higher, under
     *  a bright major chord and a low thump. */
    EpicCard = "epicCard",
    RunOver = "runOver",
    Rift = "rift",
    StepGrass = "stepGrass",
    StepPath = "stepPath",
    StepPaving = "stepPaving",
    Heartbeat = "heartbeat",
    /** Storm's arc leaping from monster to monster: a short crackle. */
    Arc = "arc",
    /** A monster freezing solid: a crack of ice. */
    Freeze = "freeze",
    /** A monster catching full burn: a rush of flame. */
    Ignite = "ignite",
    /** A burn building on a monster: a short crackle, higher the more it
     *  holds. */
    Kindle = "kindle",
    /** Storm on frozen: an electric crack through the ice. */
    ChainShock = "chainShock",
    /** Storm on blazing: an explosion. */
    Blast = "blast",
    /** Ember on frozen, Frost on blazing: a hiss of steam. */
    Steam = "steam",
    /** Storm's capstone: thunder as the bolt falls. */
    Thunderhead = "thunderhead",
    /** Ember's capstone: a roar of fire. */
    Meltdown = "meltdown",
    /** Frost's capstone: ice bursting like glass. */
    Shatter = "shatter",
}

let context: AudioContext | undefined;
let master: GainNode | undefined;
/** The effects', the HUD's and the ambience's levels into `master`, each
 *  following the player's volume setting for it. */
let effects: GainNode | undefined;
let hud: GainNode | undefined;
let music: GainNode | undefined;
/** The crowd's sounds into `effects`, ducked under a moment. */
let crowd: GainNode | undefined;
/** The night's echo: a heavy shot's send, a dark repeat off the treeline,
 *  into `effects`. */
let echo: AudioNode | undefined;
let noise: AudioBuffer | undefined;
/** Which plays sound now, and when the last moment ducked the crowd. */
const mix = createMixState();
let momentAt: number | undefined;

/** Each file's decoded audio, by its URL, once it has loaded. */
const buffers = new Map<string, AudioBuffer>();

/** The page's audio, three's shared context, with its one master level and
 *  a limiter so a crowd of hits never clips. Undefined where the page has
 *  no Web Audio, as a test's jsdom has none. */
function readContext() {
    if (context) return context;
    if (typeof AudioContext === "undefined") return undefined;
    //  three's context, the one the engine's footsteps and Sound play on,
    //  so the page runs one context and any press wakes every sound.
    //  @types/three types it as three's wrapper class; what three returns
    //  is the browser's.
    context = ThreeAudioContext.getContext() as unknown as AudioContext;
    //  Whichever listener resumes it, the engine's or this file's.
    context.addEventListener("statechange", startAmbience);
    //  A limiter that touches only the peaks of a crowd of hits. The
    //  compressor's defaults would add about 6 dB of makeup gain to every
    //  sound under their -24 dB threshold, the ambience most of all.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    master = context.createGain();
    master.gain.value = 0.6;
    master.connect(limiter).connect(context.destination);
    effects = context.createGain();
    effects.connect(master);
    followVolume(effects, { channel: VolumeChannel.Effects });
    hud = context.createGain();
    hud.connect(master);
    followVolume(hud, { channel: VolumeChannel.Interface });
    crowd = context.createGain();
    crowd.connect(effects);
    echo = createEcho(context, effects);
    music = context.createGain();
    music.connect(master);
    followVolume(music, { channel: VolumeChannel.Music });
    //  A second of white noise, the source of every hiss and thump.
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index++)
        samples[index] = Math.random() * 2 - 1;
    loadFiles(context);
    return context;
}

/** Wakes the page's audio on a press, the gesture a browser asks for
 *  before it plays anything, and on each press after, as a tab the browser
 *  suspended needs. */
function wakeAudio() {
    void readContext()?.resume();
}

/** A band or low pass over a voice. */
interface VoiceFilter {
    type: BiquadFilterType;
    frequency: number;
}

/** One voice of a sound: an oscillator or the noise, with its own pitch
 *  glide, filter and envelope. */
interface Voice {
    type?: OscillatorType | "noise";
    /** Hertz at the start and at the end of the voice. */
    from?: number;
    to?: number;
    /** Seconds after the sound starts that the voice starts. */
    delay?: number;
    /** Seconds from its start to silence. */
    seconds: number;
    level: number;
    filter?: VoiceFilter;
}

/** A card's flick as it turns: a short high hiss over a click. */
const cardFlipVoices: Voice[] = [
    {
        type: "noise",
        seconds: 0.05,
        level: 0.16,
        filter: { type: "bandpass", frequency: 2600 },
    },
    { type: "triangle", from: 1400, to: 900, seconds: 0.04, level: 0.06 },
];

/** A taken card landing: G, B and D, a major chord rising quickly. */
const cardLandVoices: Voice[] = [784, 988, 1175].map((hertz, index) => ({
    type: "triangle" as const,
    from: hertz,
    to: hertz,
    delay: index * 0.06,
    seconds: 0.3 + index * 0.1,
    level: 0.12,
}));

/** The rare card's two pings over its chime. */
const rareCardVoices: Voice[] = [
    { type: "sine", from: 1568, to: 1568, seconds: 0.35, level: 0.12 },
    {
        type: "sine",
        from: 2093,
        to: 2093,
        delay: 0.07,
        seconds: 0.5,
        level: 0.1,
    },
];

/** The epic card's climb before it turns: a sweep under six plucks that
 *  come faster as they rise. */
const epicChargeVoices: Voice[] = [
    { type: "sine", from: 180, to: 720, seconds: 0.6, level: 0.1 },
    ...[392, 494, 587, 698, 784, 988].map((hertz, index) => ({
        type: "triangle" as const,
        from: hertz,
        to: hertz,
        delay: [0, 0.12, 0.22, 0.3, 0.37, 0.43][index],
        seconds: 0.14,
        level: 0.07 + index * 0.012,
    })),
];

/** The epic card's burst: a low thump, a C major chord struck up from the
 *  root, and a bright hiss. */
const epicCardVoices: Voice[] = [
    { type: "sine", from: 110, to: 45, seconds: 0.5, level: 0.35 },
    ...[1047, 1319, 1568, 2093].map((hertz, index) => ({
        type: "triangle" as const,
        from: hertz,
        to: hertz,
        delay: index * 0.045,
        seconds: 1.1 - index * 0.1,
        level: 0.11,
    })),
    {
        type: "noise",
        seconds: 0.35,
        level: 0.12,
        filter: { type: "highpass", frequency: 6000 },
    },
];

/** Each sound synthesized, played while its file loads or where it fails
 *  to. */
const recipes: Record<Sound, Voice[]> = {
    [Sound.Scattergun]: [
        { type: "sine", from: 140, to: 45, seconds: 0.25, level: 0.5 },
        {
            type: "noise",
            seconds: 0.22,
            level: 0.45,
            filter: { type: "lowpass", frequency: 1800 },
        },
    ],
    [Sound.Rail]: [
        { type: "sawtooth", from: 1600, to: 180, seconds: 0.35, level: 0.14 },
        { type: "sine", from: 220, to: 60, seconds: 0.4, level: 0.4 },
    ],
    [Sound.Ricochet]: [
        { type: "triangle", from: 3200, to: 2400, seconds: 0.1, level: 0.12 },
    ],
    [Sound.RackBuy]: [
        {
            type: "noise",
            seconds: 0.06,
            level: 0.3,
            filter: { type: "bandpass", frequency: 2200 },
        },
        {
            type: "sine",
            from: 1320,
            to: 1320,
            delay: 0.05,
            seconds: 0.1,
            level: 0.15,
        },
    ],
    [Sound.Upgrade]: [
        { type: "triangle", from: 523, to: 1047, seconds: 0.35, level: 0.2 },
        {
            type: "sine",
            from: 784,
            to: 1568,
            delay: 0.1,
            seconds: 0.35,
            level: 0.15,
        },
    ],
    [Sound.Feed]: [
        {
            type: "noise",
            seconds: 0.6,
            level: 0.3,
            filter: { type: "lowpass", frequency: 900 },
        },
    ],
    [Sound.FireRises]: [
        {
            type: "noise",
            seconds: 1,
            level: 0.4,
            filter: { type: "lowpass", frequency: 700 },
        },
        { type: "triangle", from: 392, to: 392, seconds: 0.4, level: 0.18 },
        {
            type: "triangle",
            from: 587,
            to: 587,
            delay: 0.15,
            seconds: 0.7,
            level: 0.18,
        },
    ],
    [Sound.Reroll]: [
        {
            type: "noise",
            seconds: 0.18,
            level: 0.15,
            filter: { type: "bandpass", frequency: 4000 },
        },
    ],
    [Sound.Refused]: [
        { type: "square", from: 180, to: 160, seconds: 0.18, level: 0.1 },
    ],
    [Sound.Arc]: [
        {
            type: "noise",
            seconds: 0.09,
            level: 0.22,
            filter: { type: "bandpass", frequency: 3800 },
        },
        { type: "square", from: 2400, to: 900, seconds: 0.05, level: 0.05 },
    ],
    [Sound.Freeze]: [
        { type: "triangle", from: 2600, to: 1800, seconds: 0.12, level: 0.15 },
        {
            type: "noise",
            seconds: 0.1,
            level: 0.2,
            filter: { type: "bandpass", frequency: 6000 },
        },
    ],
    [Sound.Ignite]: [
        {
            type: "noise",
            seconds: 0.35,
            level: 0.3,
            filter: { type: "lowpass", frequency: 900 },
        },
        { type: "sine", from: 90, to: 60, seconds: 0.3, level: 0.2 },
    ],
    [Sound.Kindle]: [
        {
            type: "noise",
            seconds: 0.08,
            level: 0.12,
            filter: { type: "bandpass", frequency: 2600 },
        },
    ],
    [Sound.ChainShock]: [
        {
            type: "noise",
            seconds: 0.25,
            level: 0.35,
            filter: { type: "bandpass", frequency: 3000 },
        },
        { type: "sawtooth", from: 1200, to: 200, seconds: 0.3, level: 0.15 },
    ],
    [Sound.Blast]: [
        { type: "sine", from: 120, to: 35, seconds: 0.6, level: 0.7 },
        {
            type: "noise",
            seconds: 0.5,
            level: 0.5,
            filter: { type: "lowpass", frequency: 900 },
        },
    ],
    [Sound.Steam]: [
        {
            type: "noise",
            seconds: 1.2,
            level: 0.18,
            filter: { type: "bandpass", frequency: 5000 },
        },
    ],
    [Sound.Thunderhead]: [
        {
            type: "noise",
            seconds: 0.12,
            level: 0.5,
            filter: { type: "bandpass", frequency: 2500 },
        },
        {
            type: "noise",
            seconds: 1.4,
            level: 0.6,
            filter: { type: "lowpass", frequency: 400 },
        },
    ],
    [Sound.Meltdown]: [
        {
            type: "noise",
            seconds: 1,
            level: 0.5,
            filter: { type: "lowpass", frequency: 700 },
        },
        { type: "sine", from: 80, to: 40, seconds: 0.8, level: 0.5 },
    ],
    [Sound.Shatter]: [
        {
            type: "noise",
            seconds: 0.3,
            level: 0.35,
            filter: { type: "bandpass", frequency: 7000 },
        },
        { type: "triangle", from: 3200, to: 2200, seconds: 0.2, level: 0.15 },
    ],
    [Sound.Shot]: [
        { type: "square", from: 900, to: 160, seconds: 0.08, level: 0.12 },
        {
            type: "noise",
            seconds: 0.06,
            level: 0.25,
            filter: { type: "bandpass", frequency: 2400 },
        },
    ],
    [Sound.Hit]: [
        { type: "triangle", from: 1500, to: 900, seconds: 0.04, level: 0.2 },
    ],
    [Sound.Kill]: [
        { type: "sine", from: 190, to: 62, seconds: 0.16, level: 0.42 },
        {
            type: "noise",
            seconds: 0.05,
            level: 0.3,
            filter: { type: "bandpass", frequency: 1600 },
        },
        {
            type: "triangle",
            from: 1250,
            to: 1150,
            delay: 0.015,
            seconds: 0.07,
            level: 0.07,
        },
    ],
    [Sound.Crit]: [
        { type: "sine", from: 3100, to: 2900, seconds: 0.22, level: 0.14 },
        {
            type: "sine",
            from: 4650,
            to: 4400,
            delay: 0.01,
            seconds: 0.14,
            level: 0.07,
        },
    ],
    [Sound.Fall]: [
        {
            type: "noise",
            seconds: 0.16,
            level: 0.12,
            filter: { type: "lowpass", frequency: 500 },
        },
        { type: "sine", from: 110, to: 55, seconds: 0.12, level: 0.12 },
    ],
    [Sound.HeavyFall]: [
        {
            type: "noise",
            seconds: 0.3,
            level: 0.25,
            filter: { type: "lowpass", frequency: 400 },
        },
        { type: "sine", from: 80, to: 38, seconds: 0.3, level: 0.35 },
    ],
    [Sound.ColossusFall]: [
        { type: "sine", from: 70, to: 28, seconds: 1.4, level: 0.7 },
        {
            type: "noise",
            seconds: 1.2,
            level: 0.5,
            filter: { type: "lowpass", frequency: 500 },
        },
    ],
    [Sound.Coin]: [
        { type: "sine", from: 1320, to: 1320, seconds: 0.06, level: 0.18 },
        {
            type: "sine",
            from: 1976,
            to: 1976,
            delay: 0.05,
            seconds: 0.12,
            level: 0.16,
        },
    ],
    [Sound.Hurt]: [
        { type: "sine", from: 130, to: 55, seconds: 0.16, level: 0.6 },
        {
            type: "noise",
            seconds: 0.1,
            level: 0.25,
            filter: { type: "lowpass", frequency: 600 },
        },
    ],
    [Sound.Down]: [
        {
            type: "sawtooth",
            from: 440,
            to: 90,
            seconds: 0.8,
            level: 0.25,
            filter: { type: "lowpass", frequency: 1400 },
        },
    ],
    [Sound.Revive]: [
        { type: "sine", from: 330, to: 660, seconds: 0.35, level: 0.3 },
        {
            type: "triangle",
            from: 660,
            to: 990,
            delay: 0.2,
            seconds: 0.3,
            level: 0.2,
        },
    ],
    [Sound.WaveStart]: [
        {
            type: "sawtooth",
            from: 98,
            to: 92,
            seconds: 1.3,
            level: 0.3,
            filter: { type: "lowpass", frequency: 700 },
        },
        {
            type: "sawtooth",
            from: 147,
            to: 138,
            seconds: 1.3,
            level: 0.22,
            filter: { type: "lowpass", frequency: 700 },
        },
    ],
    [Sound.NamedWave]: [
        {
            type: "sawtooth",
            from: 73,
            to: 69,
            seconds: 1.8,
            level: 0.3,
            filter: { type: "lowpass", frequency: 600 },
        },
        {
            type: "sawtooth",
            from: 104,
            to: 98,
            seconds: 1.8,
            level: 0.22,
            filter: { type: "lowpass", frequency: 800 },
        },
        {
            type: "noise",
            seconds: 0.5,
            level: 0.3,
            filter: { type: "bandpass", frequency: 3200 },
        },
    ],
    [Sound.Dawn]: [
        { type: "triangle", from: 523, to: 523, seconds: 0.5, level: 0.2 },
        {
            type: "triangle",
            from: 659,
            to: 659,
            delay: 0.14,
            seconds: 0.6,
            level: 0.2,
        },
        {
            type: "triangle",
            from: 784,
            to: 784,
            delay: 0.28,
            seconds: 0.8,
            level: 0.2,
        },
        {
            type: "sine",
            from: 1047,
            to: 1047,
            delay: 0.42,
            seconds: 1.8,
            level: 0.22,
        },
        {
            type: "sine",
            from: 262,
            to: 262,
            delay: 0.42,
            seconds: 2.2,
            level: 0.18,
        },
    ],
    [Sound.WaveHeld]: [
        { type: "triangle", from: 523, to: 523, seconds: 0.2, level: 0.22 },
        {
            type: "triangle",
            from: 659,
            to: 659,
            delay: 0.1,
            seconds: 0.2,
            level: 0.22,
        },
        {
            type: "triangle",
            from: 784,
            to: 784,
            delay: 0.2,
            seconds: 0.5,
            level: 0.24,
        },
    ],
    [Sound.CardFlip]: cardFlipVoices,
    [Sound.CardLand]: cardLandVoices,
    [Sound.RareCard]: rareCardVoices,
    [Sound.EpicCharge]: epicChargeVoices,
    [Sound.EpicCard]: epicCardVoices,
    [Sound.Card]: [
        { type: "triangle", from: 880, to: 1760, seconds: 0.25, level: 0.18 },
        {
            type: "sine",
            from: 1320,
            to: 2640,
            delay: 0.08,
            seconds: 0.3,
            level: 0.12,
        },
    ],
    [Sound.RunOver]: [
        { type: "triangle", from: 392, to: 392, seconds: 0.3, level: 0.26 },
        {
            type: "triangle",
            from: 311,
            to: 311,
            delay: 0.25,
            seconds: 0.3,
            level: 0.26,
        },
        {
            type: "triangle",
            from: 262,
            to: 247,
            delay: 0.5,
            seconds: 0.9,
            level: 0.3,
        },
    ],
    [Sound.Rift]: [
        {
            type: "noise",
            seconds: 0.8,
            level: 0.3,
            filter: { type: "lowpass", frequency: 400 },
        },
        {
            type: "sawtooth",
            from: 70,
            to: 48,
            seconds: 0.8,
            level: 0.14,
            filter: { type: "lowpass", frequency: 300 },
        },
    ],
    [Sound.StepGrass]: [
        {
            type: "noise",
            seconds: 0.08,
            level: 0.05,
            filter: { type: "lowpass", frequency: 900 },
        },
    ],
    [Sound.StepPath]: [
        {
            type: "noise",
            seconds: 0.07,
            level: 0.06,
            filter: { type: "lowpass", frequency: 600 },
        },
    ],
    [Sound.StepPaving]: [
        {
            type: "noise",
            seconds: 0.05,
            level: 0.06,
            filter: { type: "lowpass", frequency: 1500 },
        },
    ],
    //  Lub-dub: two low thumps, the second a little softer.
    [Sound.Heartbeat]: [
        { type: "sine", from: 60, to: 40, seconds: 0.12, level: 0.5 },
        {
            type: "sine",
            from: 60,
            to: 40,
            delay: 0.2,
            seconds: 0.12,
            level: 0.35,
        },
    ],
};

/** A recorded sound: the files a play picks from, and how it plays. */
interface Recording {
    urls: string[];
    /** Linear gain that brings the file's loudest 50 ms to its place in
     *  the mix, measured on the committed files: shots lowest, hits over
     *  them, kills and the wave cues on top. */
    gain: number;
    /** Playback rate the random spread centres on: below 1 plays lower
     *  and longer. */
    rate?: number;
    /** Seconds after which the file fades out, so a sound that repeats
     *  fast never piles up on itself. */
    seconds?: number;
    /** Synthesized voices played with the file, as a low thump under a
     *  shot. */
    layer?: Voice[];
    /** Where it sits in the mix: the main bus unless named. */
    tier?: SoundTier;
    /** Plays that may sound at once, 4 unless named, and seconds one
     *  must wait after the last, none unless named. */
    voices?: number;
    gapSeconds?: number;
    /** Share of its level sent to the night's echo, none unless named: a
     *  heavy shot's file rolls off the treeline, as a shot outdoors does in
     *  every shooter's mix. */
    echo?: number;
    /** Whether it is the HUD's, a card or the shop's answer, which the
     *  player's Interface volume sets rather than her Effects. */
    hud?: boolean;
}

//  Each comment gives the file's loudest 50 ms, in dB below full scale.
const recordings: Record<Sound, Recording> = {
    //  -16 dB; fires six times a second while the trigger is held, and
    //  up to about sixteen with every Hair Trigger card.
    [Sound.Shot]: {
        urls: [shotOne, shotTwo],
        gain: 0.45,
        gapSeconds: 0.03,
        seconds: 0.16,
        layer: [
            { type: "sine", from: 150, to: 55, seconds: 0.07, level: 0.22 },
        ],
    },
    //  -10.4 dB RMS over its loudest 50 ms, a crunch 4 dB over a blaster
    //  shot with a low thump under it: once a second, it should land.
    [Sound.Scattergun]: {
        urls: [scattergun],
        gain: 0.38,
        echo: 0.5,
        layer: [
            { type: "sine", from: 120, to: 42, seconds: 0.22, level: 0.35 },
        ],
    },
    //  -8.2 dB, a crack 4 dB over a blaster shot, over a low sweep.
    [Sound.Rail]: {
        urls: [rail],
        gain: 0.29,
        echo: 0.7,
        layer: [{ type: "sine", from: 200, to: 55, seconds: 0.35, level: 0.3 }],
    },
    //  -14 dB, a small ping under the shots.
    [Sound.Ricochet]: { urls: [ricochet], gain: 0.3, rate: 1.2 },
    //  -14.3 dB, a latch with a coin's chime over it.
    [Sound.RackBuy]: {
        urls: [rackBuy],
        gain: 0.9,
        layer: [
            {
                type: "sine",
                from: 1320,
                to: 1320,
                delay: 0.06,
                seconds: 0.12,
                level: 0.1,
            },
            {
                type: "sine",
                from: 1976,
                to: 1976,
                delay: 0.12,
                seconds: 0.2,
                level: 0.09,
            },
        ],
    },
    //  -8.7 dB.
    [Sound.Upgrade]: { urls: [upgrade], gain: 0.5 },
    //  -15.3 dB, a rush of flame.
    [Sound.Feed]: { urls: [feed], gain: 0.8 },
    //  The rush, a fourth lower and louder, under a rising fifth.
    [Sound.FireRises]: {
        urls: [feed],
        gain: 1.1,
        rate: 0.75,
        layer: [
            { type: "triangle", from: 392, to: 392, seconds: 0.4, level: 0.16 },
            {
                type: "triangle",
                from: 587,
                to: 587,
                delay: 0.15,
                seconds: 0.8,
                level: 0.16,
            },
        ],
    },
    //  -32 dB, paper: played up to sit with the card's chime.
    [Sound.Reroll]: { urls: [reroll], gain: 3, hud: true },
    //  -10.3 dB.
    [Sound.Refused]: { urls: [refused], gain: 0.35, hud: true },
    //  -8.5 dB.
    [Sound.Hit]: {
        urls: [hitOne, hitTwo],
        gain: 0.4,
        tier: SoundTier.Crowd,
        gapSeconds: 0.04,
    },
    //  Synthesized: a knock under the hit, her own kills alone.
    [Sound.Kill]: { urls: [], gain: 1, voices: 2, gapSeconds: 0.06 },
    //  -15.3 dB, rung over the hit and above it, cut short so a burst of
    //  weak spot hits never rings on.
    [Sound.Crit]: {
        urls: [crit],
        gain: 1.2,
        seconds: 0.32,
        //  Her own weak-spot hits, over the crowd's hits and never ducked:
        //  a few at once, so a burst of them still rings each.
        voices: 3,
        gapSeconds: 0.05,
        layer: [
            { type: "sine", from: 3100, to: 2900, seconds: 0.16, level: 0.05 },
        ],
    },
    //  Each -0.4 dB at its peak, a soft heavy impact: played about 8 dB
    //  under a hit, three at most at once, so a wave's deaths are a patter
    //  of bodies on the grass under the guns rather than a wall of booms.
    [Sound.Fall]: {
        urls: [fallOne, fallTwo, fallThree],
        gain: 0.06,
        rate: 0.9,
        tier: SoundTier.Crowd,
        voices: 3,
        gapSeconds: 0.09,
    },
    //  The same falls, a fourth lower, over a low thump.
    [Sound.HeavyFall]: {
        urls: [fallOne, fallTwo, fallThree],
        gain: 0.3,
        rate: 0.65,
        tier: SoundTier.Crowd,
        voices: 2,
        gapSeconds: 0.15,
        layer: [{ type: "sine", from: 90, to: 38, seconds: 0.3, level: 0.25 }],
    },
    //  The low explosion, an octave down, over a long thump and a heavy
    //  fall: the night's boss going down is a moment.
    [Sound.ColossusFall]: {
        urls: [blast],
        gain: 1,
        rate: 0.55,
        tier: SoundTier.Moment,
        voices: 1,
        layer: [
            { type: "sine", from: 70, to: 28, seconds: 1.2, level: 0.5 },
            {
                type: "noise",
                delay: 0.35,
                seconds: 0.5,
                level: 0.3,
                filter: { type: "lowpass", frequency: 300 },
            },
        ],
    },
    //  -29.6 dB, a quiet clink: the chime over it says it is a reward.
    [Sound.Coin]: {
        urls: [coin],
        gain: 3.5,
        layer: [
            { type: "sine", from: 1320, to: 1320, seconds: 0.06, level: 0.08 },
            {
                type: "sine",
                from: 1976,
                to: 1976,
                delay: 0.05,
                seconds: 0.12,
                level: 0.07,
            },
        ],
    },
    //  -7.7 dB.
    [Sound.Hurt]: { urls: [hurt], gain: 0.6, voices: 2, gapSeconds: 0.1 },
    //  -6.2 dB.
    [Sound.Down]: { urls: [down], gain: 0.5 },
    //  -14.9 dB.
    [Sound.Revive]: { urls: [revive], gain: 1.1 },
    //  -7.8 dB, a deep boom under the recipe's horn.
    [Sound.WaveStart]: {
        urls: [waveStart],
        gain: 0.9,
        layer: [
            {
                type: "sawtooth",
                from: 98,
                to: 92,
                seconds: 1.3,
                level: 0.18,
                filter: { type: "lowpass", frequency: 700 },
            },
            {
                type: "sawtooth",
                from: 147,
                to: 138,
                seconds: 1.3,
                level: 0.13,
                filter: { type: "lowpass", frequency: 700 },
            },
        ],
    },
    //  The wave's boom, a fifth lower, under a clash and a low horn.
    [Sound.NamedWave]: {
        urls: [waveStart],
        gain: 1,
        rate: 0.67,
        layer: [
            {
                type: "sawtooth",
                from: 73,
                to: 69,
                seconds: 1.8,
                level: 0.3,
                filter: { type: "lowpass", frequency: 600 },
            },
            {
                type: "sawtooth",
                from: 104,
                to: 98,
                seconds: 1.8,
                level: 0.22,
                filter: { type: "lowpass", frequency: 800 },
            },
            {
                type: "noise",
                seconds: 0.5,
                level: 0.3,
                filter: { type: "bandpass", frequency: 3200 },
            },
        ],
    },
    //  -2.1 dB.
    [Sound.WaveHeld]: { urls: [waveHeld], gain: 0.4 },
    //  The held wave's chime, lower and longer, under a rising C major.
    [Sound.Dawn]: {
        urls: [waveHeld],
        gain: 0.45,
        rate: 0.75,
        layer: [
            { type: "triangle", from: 523, to: 523, seconds: 0.5, level: 0.2 },
            {
                type: "triangle",
                from: 659,
                to: 659,
                delay: 0.14,
                seconds: 0.6,
                level: 0.2,
            },
            {
                type: "triangle",
                from: 784,
                to: 784,
                delay: 0.28,
                seconds: 0.8,
                level: 0.2,
            },
            {
                type: "sine",
                from: 1047,
                to: 1047,
                delay: 0.42,
                seconds: 1.8,
                level: 0.22,
            },
            {
                type: "sine",
                from: 262,
                to: 262,
                delay: 0.42,
                seconds: 2.2,
                level: 0.18,
            },
        ],
    },
    //  -6.3 dB.
    [Sound.Card]: { urls: [card], gain: 0.35, hud: true },
    //  No file: each is its recipe.
    [Sound.CardFlip]: { urls: [], gain: 1, hud: true },
    [Sound.CardLand]: { urls: [], gain: 1, hud: true },
    //  The card's chime a fifth up, over its pings.
    [Sound.RareCard]: {
        urls: [card],
        gain: 0.4,
        hud: true,
        rate: 1.5,
        layer: rareCardVoices,
    },
    //  No file: the climb is its recipe.
    [Sound.EpicCharge]: { urls: [], gain: 1, hud: true },
    //  The held wave's chime a fourth up, under the chord.
    [Sound.EpicCard]: {
        urls: [waveHeld],
        gain: 0.5,
        hud: true,
        rate: 1.33,
        layer: epicCardVoices,
    },
    //  -5.8 dB, played a little low for weight.
    [Sound.RunOver]: { urls: [runOver], gain: 0.65, rate: 0.9 },
    //  -4.0 dB, played low so a force field's hum reads as a growl from
    //  the ground.
    //  A wave's batch rises at once: two at a time is its sound.
    [Sound.Rift]: {
        urls: [rift],
        gain: 0.25,
        rate: 0.7,
        tier: SoundTier.Crowd,
        voices: 2,
        gapSeconds: 0.2,
    },
    //  Each step -20 dB, and played about 12 dB under a shot: she hears her
    //  feet three times a second under everything else.
    [Sound.StepGrass]: {
        urls: [stepGrassOne, stepGrassTwo, stepGrassThree],
        gain: 0.18,
        tier: SoundTier.Crowd,
    },
    [Sound.StepPath]: {
        urls: [stepPathOne, stepPathTwo, stepPathThree],
        gain: 0.18,
        tier: SoundTier.Crowd,
    },
    [Sound.StepPaving]: {
        urls: [stepPavingOne, stepPavingTwo, stepPavingThree],
        gain: 0.18,
        tier: SoundTier.Crowd,
    },
    //  No file: it always plays its recipe.
    [Sound.Heartbeat]: { urls: [], gain: 1, voices: 1 },
    //  No file: a crackle a few times a second while a Storm warden fires,
    //  so it stays short and quiet.
    [Sound.Arc]: {
        urls: [],
        gain: 1,
        tier: SoundTier.Crowd,
        voices: 3,
        gapSeconds: 0.05,
    },
    //  Glass, 0 dB at its peak and a fifth of a second: the crack of ice.
    [Sound.Freeze]: {
        urls: [freeze],
        gain: 0.4,
        rate: 1.1,
        tier: SoundTier.Crowd,
        voices: 2,
        gapSeconds: 0.1,
    },
    //  A quarter second of the fire's crackle, as a burn builds: short and
    //  quiet, since a Horde's burns build many at once.
    [Sound.Kindle]: {
        urls: [fireCrackle],
        gain: 3,
        seconds: 0.25,
        tier: SoundTier.Crowd,
        voices: 3,
        gapSeconds: 0.08,
    },
    //  The start of the Meltdown roar, higher and cut short.
    [Sound.Ignite]: {
        urls: [meltdown],
        gain: 0.35,
        rate: 1.4,
        seconds: 0.5,
        tier: SoundTier.Crowd,
        voices: 2,
        gapSeconds: 0.12,
    },
    //  A large laser's crack, 1 dB under full, over a crackle.
    [Sound.ChainShock]: {
        urls: [chainShock],
        gain: 0.7,
        tier: SoundTier.Moment,
        voices: 2,
        gapSeconds: 0.08,
        layer: [
            {
                type: "noise",
                seconds: 0.2,
                level: 0.25,
                filter: { type: "bandpass", frequency: 3200 },
            },
        ],
    },
    //  A low explosion, 0 dB at its peak, with a thump under it.
    [Sound.Blast]: {
        urls: [blast],
        gain: 0.9,
        tier: SoundTier.Moment,
        voices: 2,
        gapSeconds: 0.08,
        layer: [{ type: "sine", from: 90, to: 35, seconds: 0.4, level: 0.4 }],
    },
    //  A rush of flame, 4 dB under full, played high into a hiss.
    [Sound.Steam]: {
        urls: [steam],
        gain: 0.5,
        rate: 1.5,
        tier: SoundTier.Moment,
        voices: 2,
        gapSeconds: 0.08,
    },
    //  A long low rumble, 0 dB at its peak, under a crack as the bolt lands.
    [Sound.Thunderhead]: {
        urls: [thunder],
        gain: 0.85,
        tier: SoundTier.Moment,
        voices: 2,
        gapSeconds: 0.1,
        layer: [
            {
                type: "noise",
                seconds: 0.1,
                level: 0.45,
                filter: { type: "bandpass", frequency: 2500 },
            },
        ],
    },
    //  A roar of flame, 4 dB under full, over a low thump.
    [Sound.Meltdown]: {
        urls: [meltdown],
        gain: 0.9,
        tier: SoundTier.Moment,
        voices: 2,
        gapSeconds: 0.1,
        layer: [{ type: "sine", from: 70, to: 35, seconds: 0.5, level: 0.4 }],
    },
    //  Heavy glass, 0 dB at its peak.
    [Sound.Shatter]: {
        urls: [shatter],
        gain: 0.8,
        tier: SoundTier.Moment,
        voices: 2,
        gapSeconds: 0.1,
    },
};

/** One looping layer of the night's bed. */
interface AmbienceLayer {
    /** What the mix calls it, for its level in each mood. */
    name: AmbienceLayerName;
    url: string;
    /** Linear gain, for a bed that sits under every sound. */
    gain: number;
    /** Hertz above which the layer is cut, by two low passes in a row, so
     *  no hiss sits under the game. */
    lowpass: number;
}

//  The bed sits at least 18 dB under a shot's loudest 50 ms, as shooters
//  mix it, and holds no broadband noise: a constant noise reads as hiss at
//  any level.
const ambienceLayers: AmbienceLayer[] = [
    //  Crickets, chirping at 4 to 5 kHz; RMS -33 dB.
    {
        name: AmbienceLayerName.Crickets,
        url: nightCrickets,
        gain: 0.18,
        lowpass: 6000,
    },
    //  The fire's crackle; RMS -49 dB. Most of the recording's own noise
    //  floor lies above 2 kHz, so the cut leaves soft pops.
    { name: AmbienceLayerName.Fire, url: fireCrackle, gain: 2, lowpass: 2000 },
    //  The drone's RMS is -8 dB, all of it under 500 Hz.
    {
        name: AmbienceLayerName.Drone,
        url: duskDrone,
        gain: 0.012,
        lowpass: 6000,
    },
];

/** Seconds of each loop's end blended into its start, over its seam. */
const loopSeamSeconds = 0.5;

/** Seconds the ambience takes to swell in once it starts. */
const ambienceFadeSeconds = 3;
/** Seconds a mood's change takes to settle, about: the crickets hush over
 *  the wave's first moments and come back as the breather opens. */
const moodSeconds = 2.5;
/** The bed's mood now. */
let ambienceMood = AmbienceMood.Calm;
/** Each playing layer's level, which a mood moves. */
const ambienceGains = new Map<AmbienceLayerName, GainNode>();

/** Fetches and decodes every file once, into `buffers`. A file that fails
 *  leaves its sound on its recipe. */
function loadFiles(audio: AudioContext) {
    if (typeof fetch === "undefined") return;
    const urls = new Set([
        ...Object.values(recordings).flatMap((recording) => recording.urls),
        ...ambienceLayers.map((layer) => layer.url),
    ]);
    for (const url of urls)
        void fetch(url)
            .then((response) => response.arrayBuffer())
            .then((data) => audio.decodeAudioData(data))
            .then((buffer) => {
                buffers.set(url, buffer);
                startAmbience();
            })
            .catch(() => undefined);
}

/** A random factor within `spread` either side of 1. */
function vary(spread: number) {
    return 1 + (Math.random() * 2 - 1) * spread;
}

/** How loud, 0 to 1, as a far event plays quieter, and how much higher,
 *  as a ratio of its pitch: 2 plays it an octave up. */
export interface SoundOptions {
    volume?: number;
    pitch?: number;
    /** A gun's upgrade tier, 0 to 3: each plays its shot a little higher
     *  over a layer of its own, so a raised gun sounds raised. */
    tier?: number;
    /** A teammate's shot: under the player's own, in the crowd. */
    ally?: boolean;
}

/** What each gun tier lays over a shot, as Pack-a-Punch lays its zap over
 *  a gun: a rising zap from the first, a low thump under it from the
 *  second, and a high shimmer at the top, the gold band's sound. */
const tierLayers: Voice[][] = [
    [],
    [{ type: "triangle", from: 700, to: 1500, seconds: 0.07, level: 0.045 }],
    [
        { type: "triangle", from: 700, to: 1500, seconds: 0.07, level: 0.05 },
        { type: "sine", from: 120, to: 48, seconds: 0.11, level: 0.14 },
    ],
    [
        { type: "triangle", from: 800, to: 1800, seconds: 0.08, level: 0.055 },
        { type: "sine", from: 120, to: 48, seconds: 0.12, level: 0.16 },
        {
            type: "sine",
            from: 2637,
            to: 2637,
            delay: 0.012,
            seconds: 0.16,
            level: 0.03,
        },
        {
            type: "sine",
            from: 3951,
            to: 3951,
            delay: 0.03,
            seconds: 0.12,
            level: 0.018,
        },
    ],
];

/** The night's echo into `bus`: one dark repeat a quarter second on, and
 *  a softer second, off the treeline round the circle. */
function createEcho(audio: AudioContext, bus: AudioNode) {
    const send = audio.createGain();
    const delay = audio.createDelay(1);
    delay.delayTime.value = 0.23;
    const dark = audio.createBiquadFilter();
    dark.type = "lowpass";
    dark.frequency.value = 1400;
    const feedback = audio.createGain();
    feedback.gain.value = 0.3;
    const wet = audio.createGain();
    wet.gain.value = 0.32;
    send.connect(delay).connect(dark).connect(wet).connect(bus);
    dark.connect(feedback).connect(delay);
    return send;
}

/** A play quieter than this, a fall across the field, is not worth one of
 *  its sound's voices. */
const quietest = 0.04;

/** Seconds a sound's play sounds: its recipe's longest voice, or its
 *  file's length at its rate. */
function measureSeconds(sound: Sound, buffer: AudioBuffer | undefined) {
    const recording = recordings[sound];
    if (!buffer)
        return Math.max(
            ...recipes[sound].map(
                (voice) => (voice.delay ?? 0) + voice.seconds,
            ),
        );
    return recording.seconds ?? buffer.duration / (recording.rate ?? 1);
}

/** Ducks the crowd's bus under a moment starting `now`: down at once, held
 *  through the moment's first beat, then back up. */
function duckCrowd(now: number) {
    if (!crowd) return;
    const level = readDuckLevel(now, momentAt);
    momentAt = now;
    const gain = crowd.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(level, now);
    gain.linearRampToValueAtTime(duckLevel, now + 0.03);
    gain.setValueAtTime(duckLevel, now + duckHoldSeconds);
    gain.linearRampToValueAtTime(1, now + duckHoldSeconds + duckReleaseSeconds);
}

/** Plays `sound` now, where the page has audio and the mix has room for
 *  it: each sound sounds at most its voices at once, no sooner than its gap
 *  after the last, and a moment ducks the crowd. */
export function playSound(
    sound: Sound,
    { volume: loudness = 1, pitch, tier = 0, ally = false }: SoundOptions = {},
) {
    //  About a semitone either way, or a sixth of one for a sound given its
    //  pitch, so a scale stays in tune.
    const tune = {
        pitch: (pitch ?? 1) * readTierPitch(tier),
        spread: pitch === undefined ? 0.05 : 0.01,
    };
    const audio = readContext();
    const recording = recordings[sound];
    const play = ally
        ? readAllyPlay(sound, {
              voices: recording.voices ?? 4,
              gapSeconds: recording.gapSeconds ?? 0,
          })
        : {
              key: sound,
              tier: recording.tier ?? SoundTier.Main,
              gain: 1,
              voices: recording.voices ?? 4,
              gapSeconds: recording.gapSeconds ?? 0,
          };
    const volume = loudness * play.gain;
    if (!audio || !effects || audio.state !== "running" || volume < quietest)
        return;
    const url =
        recording.urls[Math.floor(Math.random() * recording.urls.length)];
    const buffer = buffers.get(url) ?? buffers.get(recording.urls[0]);
    const now = audio.currentTime;
    const admitted = admitVoice(mix, {
        key: play.key,
        voices: play.voices,
        gapSeconds: play.gapSeconds,
        now,
        seconds: measureSeconds(sound, buffer),
    });
    if (!admitted) return;
    if (play.tier === SoundTier.Moment) duckCrowd(now);
    const bus =
        (recording.hud
            ? hud
            : play.tier === SoundTier.Crowd
              ? crowd
              : undefined) ?? effects;
    const layers = tierLayers[clampTier(tier)];
    if (layers.length > 0) playVoices(audio, layers, { volume, ...tune }, bus);
    if (!buffer) {
        playVoices(audio, recipes[sound], { volume, ...tune }, bus);
        return;
    }
    const player = audio.createBufferSource();
    player.buffer = buffer;
    //  Its pitch as tuned, and its level a decibel either way.
    player.playbackRate.value =
        (recording.rate ?? 1) * tune.pitch * vary(tune.spread);
    const level = recording.gain * volume * vary(0.12);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(level, now);
    if (recording.seconds !== undefined) {
        const end = now + recording.seconds;
        gain.gain.setValueAtTime(level, end - 0.04);
        gain.gain.linearRampToValueAtTime(0, end);
    }
    player.connect(gain).connect(bus);
    //  Her own heavy shots alone: a teammate's echo would sit outside the
    //  crowd's duck.
    if (recording.echo && echo && !ally) {
        const send = audio.createGain();
        send.gain.value = recording.echo;
        gain.connect(send).connect(echo);
    }
    player.start(now);
    //  After the start: a source refuses a stop before it has started.
    if (recording.seconds !== undefined)
        player.stop(now + recording.seconds + 0.01);
    if (recording.layer)
        playVoices(audio, recording.layer, { volume, ...tune }, bus);
}

/** How a sound plays: `volume` times its levels, `pitch` times its hertz,
 *  and each play a random share up to `spread` higher or lower. */
interface Tuning {
    volume: number;
    pitch: number;
    spread: number;
}

/** Plays synthesized `voices` now, as `tuning` says, into `bus`. */
function playVoices(
    audio: AudioContext,
    voices: Voice[],
    { volume, pitch, spread }: Tuning,
    bus: AudioNode,
) {
    if (!noise) return;
    const now = audio.currentTime;
    //  So a burst of the same sound is no drone.
    const detune = pitch * vary(Math.min(spread, 0.03));
    for (const voice of voices) {
        const start = now + (voice.delay ?? 0);
        const end = start + voice.seconds;
        const gain = audio.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
            voice.level * volume,
            start + 0.005,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        let source: AudioScheduledSourceNode;
        if (voice.type === "noise") {
            const player = audio.createBufferSource();
            player.buffer = noise;
            source = player;
        } else {
            const oscillator = audio.createOscillator();
            oscillator.type = voice.type ?? "sine";
            oscillator.frequency.setValueAtTime(
                (voice.from ?? 440) * detune,
                start,
            );
            oscillator.frequency.exponentialRampToValueAtTime(
                (voice.to ?? voice.from ?? 440) * detune,
                end,
            );
            source = oscillator;
        }
        let tail: AudioNode = source;
        if (voice.filter) {
            const filter = audio.createBiquadFilter();
            filter.type = voice.filter.type;
            filter.frequency.value = voice.filter.frequency;
            tail = tail.connect(filter);
        }
        tail.connect(gain).connect(bus);
        source.start(start);
        source.stop(end + 0.02);
    }
}

/** How many mounted callers want the ambience. */
let ambienceWanted = 0;
/** The ambience's looping players while it plays, by each layer's file. */
const ambiencePlayers = new Map<string, AudioBufferSourceNode>();

/** Starts each of the ambience's loops once it is wanted, the audio runs
 *  and that layer has loaded, so a layer that fails leaves the others
 *  playing; called again at each of those moments. */
function startAmbience() {
    const audio = context;
    if (ambienceWanted === 0 || !audio || !music || audio.state !== "running")
        return;
    const now = audio.currentTime;
    for (const layer of ambienceLayers) {
        const buffer = buffers.get(layer.url);
        if (!buffer || ambiencePlayers.has(layer.url)) continue;
        const player = audio.createBufferSource();
        player.buffer = createLoopBuffer(audio, buffer);
        player.loop = true;
        const gain = audio.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(
            layer.gain * readAmbienceLevel(layer.name, ambienceMood),
            now + ambienceFadeSeconds,
        );
        ambienceGains.set(layer.name, gain);
        let tail: AudioNode = player;
        for (let stage = 0; stage < 2; stage++) {
            const filter = audio.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = layer.lowpass;
            tail = tail.connect(filter);
        }
        tail.connect(gain).connect(music);
        //  Each loop from a random point, so the two never line up alike.
        player.start(now, Math.random() * buffer.duration);
        ambiencePlayers.set(layer.url, player);
    }
}

/** `buffer` with its seam blended, as `blendLoopSeam` does, channel by
 *  channel. */
function createLoopBuffer(audio: AudioContext, buffer: AudioBuffer) {
    const fadeLength = Math.round(loopSeamSeconds * buffer.sampleRate);
    const loop = audio.createBuffer(
        buffer.numberOfChannels,
        buffer.length - fadeLength,
        buffer.sampleRate,
    );
    for (let channel = 0; channel < buffer.numberOfChannels; channel++)
        loop.copyToChannel(
            blendLoopSeam(buffer.getChannelData(channel), fadeLength),
            channel,
        );
    return loop;
}

/** Stops every ambience loop that plays. */
function stopAmbience() {
    for (const player of ambiencePlayers.values()) player.stop();
    ambiencePlayers.clear();
    ambienceGains.clear();
}

/** Moves the night's bed to `mood`: each playing layer eases to its level
 *  there, and a layer that starts later starts at it. */
export function setAmbienceMood(mood: AmbienceMood) {
    if (mood === ambienceMood) return;
    ambienceMood = mood;
    const audio = context;
    if (!audio) return;
    const now = audio.currentTime;
    for (const layer of ambienceLayers) {
        const gain = ambienceGains.get(layer.name);
        if (!gain) continue;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.setTargetAtTime(
            layer.gain * readAmbienceLevel(layer.name, mood),
            now,
            moodSeconds / 3,
        );
    }
}

/** Plays the night's looping bed from the first moment the page has audio,
 *  until the returned function stops it. */
export function playAmbience() {
    ambienceWanted++;
    startAmbience();
    return () => {
        ambienceWanted--;
        if (ambienceWanted === 0) stopAmbience();
    };
}

/** Metres at which a sound in the world has faded to nothing. */
const hearingMetres = 40;

/** How loud a sound `metres` away plays: full close by, fading out. */
export function measureHearing(metres: number) {
    return Math.max(0, 1 - metres / hearingMetres) ** 1.5;
}

//  Last, so every table above is set before the files start to load.
if (typeof window !== "undefined") {
    readContext();
    for (const type of ["pointerdown", "click", "keydown", "touchend"])
        window.addEventListener(type, wakeAudio);
}
