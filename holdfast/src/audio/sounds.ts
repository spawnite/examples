import { followVolume, VolumeChannel } from "@spawnite/engine";
import card from "@spawnite/assets/sounds/holdfast/card.mp3?url";
import coin from "@spawnite/assets/sounds/holdfast/holdfast-coin.mp3?url";
import down from "@spawnite/assets/sounds/holdfast/down.mp3?url";
import duskDrone from "@spawnite/assets/sounds/holdfast/dusk-drone.mp3?url";
import fireCrackle from "@spawnite/assets/sounds/holdfast/fire-crackle.mp3?url";
import hitOne from "@spawnite/assets/sounds/holdfast/hit-1.mp3?url";
import hitTwo from "@spawnite/assets/sounds/holdfast/hit-2.mp3?url";
import hurt from "@spawnite/assets/sounds/holdfast/hurt.mp3?url";
import kill from "@spawnite/assets/sounds/holdfast/kill.mp3?url";
import nightCrickets from "@spawnite/assets/sounds/holdfast/night-crickets.mp3?url";
import revive from "@spawnite/assets/sounds/holdfast/revive.mp3?url";
import rift from "@spawnite/assets/sounds/holdfast/rift.mp3?url";
import runOver from "@spawnite/assets/sounds/holdfast/run-over.mp3?url";
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
import waveHeld from "@spawnite/assets/sounds/holdfast/wave-held.mp3?url";
import waveStart from "@spawnite/assets/sounds/holdfast/wave-start.mp3?url";
import { AudioContext as ThreeAudioContext } from "three";
import { blendLoopSeam } from "./loops";

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
    Hit = "hit",
    Kill = "kill",
    Coin = "coin",
    Hurt = "hurt",
    Down = "down",
    Revive = "revive",
    WaveStart = "waveStart",
    WaveHeld = "waveHeld",
    Card = "card",
    RunOver = "runOver",
    Rift = "rift",
    StepGrass = "stepGrass",
    StepPath = "stepPath",
    StepPaving = "stepPaving",
    Heartbeat = "heartbeat",
}

let context: AudioContext | undefined;
let master: GainNode | undefined;
/** The effects' and the ambience's levels into `master`, each following
 *  the player's volume setting for it. */
let effects: GainNode | undefined;
let music: GainNode | undefined;
let noise: AudioBuffer | undefined;

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

/** Each sound synthesized, played while its file loads or where it fails
 *  to. */
const recipes: Record<Sound, Voice[]> = {
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
        { type: "sine", from: 260, to: 50, seconds: 0.18, level: 0.5 },
        {
            type: "noise",
            seconds: 0.12,
            level: 0.3,
            filter: { type: "lowpass", frequency: 1200 },
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
}

//  Each comment gives the file's loudest 50 ms, in dB below full scale.
const recordings: Record<Sound, Recording> = {
    //  -16 dB; fires six times a second while the trigger is held, and
    //  up to about sixteen with every Hair Trigger card.
    [Sound.Shot]: {
        urls: [shotOne, shotTwo],
        gain: 0.45,
        seconds: 0.16,
        layer: [
            { type: "sine", from: 150, to: 55, seconds: 0.07, level: 0.22 },
        ],
    },
    //  -8.5 dB.
    [Sound.Hit]: { urls: [hitOne, hitTwo], gain: 0.4 },
    //  -9.3 dB.
    [Sound.Kill]: {
        urls: [kill],
        gain: 0.95,
        layer: [
            { type: "sine", from: 130, to: 40, seconds: 0.25, level: 0.45 },
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
    [Sound.Hurt]: { urls: [hurt], gain: 0.6 },
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
    //  -2.1 dB.
    [Sound.WaveHeld]: { urls: [waveHeld], gain: 0.4 },
    //  -6.3 dB.
    [Sound.Card]: { urls: [card], gain: 0.35 },
    //  -5.8 dB, played a little low for weight.
    [Sound.RunOver]: { urls: [runOver], gain: 0.65, rate: 0.9 },
    //  -4.0 dB, played low so a force field's hum reads as a growl from
    //  the ground.
    [Sound.Rift]: { urls: [rift], gain: 0.25, rate: 0.7 },
    //  Each step -20 dB, and played about 12 dB under a shot: she hears her
    //  feet three times a second under everything else.
    [Sound.StepGrass]: {
        urls: [stepGrassOne, stepGrassTwo, stepGrassThree],
        gain: 0.18,
    },
    [Sound.StepPath]: {
        urls: [stepPathOne, stepPathTwo, stepPathThree],
        gain: 0.18,
    },
    [Sound.StepPaving]: {
        urls: [stepPavingOne, stepPavingTwo, stepPavingThree],
        gain: 0.18,
    },
    //  No file: it always plays its recipe.
    [Sound.Heartbeat]: { urls: [], gain: 1 },
};

/** One looping layer of the night's bed. */
interface AmbienceLayer {
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
    { url: nightCrickets, gain: 0.18, lowpass: 6000 },
    //  The fire's crackle; RMS -49 dB. Most of the recording's own noise
    //  floor lies above 2 kHz, so the cut leaves soft pops.
    { url: fireCrackle, gain: 2, lowpass: 2000 },
    //  The drone's RMS is -8 dB, all of it under 500 Hz.
    { url: duskDrone, gain: 0.012, lowpass: 6000 },
];

/** Seconds of each loop's end blended into its start, over its seam. */
const loopSeamSeconds = 0.5;

/** Seconds the ambience takes to swell in once it starts. */
const ambienceFadeSeconds = 3;

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

/** How loud, 0 to 1, as a far event plays quieter. */
export interface SoundOptions {
    volume?: number;
}

/** Plays `sound` now, where the page has audio. */
export function playSound(sound: Sound, { volume = 1 }: SoundOptions = {}) {
    const audio = readContext();
    if (!audio || !effects || audio.state !== "running" || volume <= 0) return;
    const recording = recordings[sound];
    const url =
        recording.urls[Math.floor(Math.random() * recording.urls.length)];
    const buffer = buffers.get(url) ?? buffers.get(recording.urls[0]);
    if (!buffer) {
        playVoices(audio, recipes[sound], volume);
        return;
    }
    const now = audio.currentTime;
    const player = audio.createBufferSource();
    player.buffer = buffer;
    //  About a semitone either way, and a decibel either way.
    player.playbackRate.value = (recording.rate ?? 1) * vary(0.05);
    const level = recording.gain * volume * vary(0.12);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(level, now);
    if (recording.seconds !== undefined) {
        const end = now + recording.seconds;
        gain.gain.setValueAtTime(level, end - 0.04);
        gain.gain.linearRampToValueAtTime(0, end);
    }
    player.connect(gain).connect(effects);
    player.start(now);
    //  After the start: a source refuses a stop before it has started.
    if (recording.seconds !== undefined)
        player.stop(now + recording.seconds + 0.01);
    if (recording.layer) playVoices(audio, recording.layer, volume);
}

/** Plays synthesized `voices` now, `volume` times their levels. */
function playVoices(audio: AudioContext, voices: Voice[], volume: number) {
    if (!effects || !noise) return;
    const now = audio.currentTime;
    //  A cent or two either way, so a burst of the same sound is no drone.
    const detune = 1 + (Math.random() - 0.5) * 0.06;
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
        tail.connect(gain).connect(effects);
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
            layer.gain,
            now + ambienceFadeSeconds,
        );
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
