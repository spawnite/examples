import { followVolume, VolumeChannel } from "@spawnite/engine";
import { Cue } from "../rules/traits";

//  The source's sounds, synthesized as it made them: square and triangle
//  chirps for each weapon, a pickup's notes, a kill's pop, a legendary
//  card's chime, the victory fanfare and the slow song under the death
//  screen. Copied into the game, since the engine plays files and has no
//  synthesizer; the effects follow the player's effects volume and the
//  song follows the music volume.

let context: AudioContext | null = null;
let effects: GainNode | null = null;
let music: GainNode | null = null;

/** The context, made and resumed on the first call after a gesture. */
function readContext() {
    try {
        context ??= new AudioContext();
        if (context.state === "suspended") void context.resume();
    } catch {
        return null;
    }
    if (!effects) {
        effects = context.createGain();
        effects.connect(context.destination);
        followVolume(effects, { channel: VolumeChannel.Effects });
    }
    if (!music) {
        music = context.createGain();
        music.connect(context.destination);
        followVolume(music, { channel: VolumeChannel.Music, base: 0.32 });
    }
    return context.state === "running" ? context : null;
}

/** Wakes the sound on a player's gesture, as a browser asks. */
export function enableSound() {
    readContext();
}

interface Chirp {
    frequency: number;
    seconds: number;
    volume: number;
    /** Hertz the pitch slides by over the chirp. */
    slide?: number;
    type?: OscillatorType;
    delay?: number;
}

function chirp({
    frequency,
    seconds,
    volume,
    slide = 0,
    type = "square",
    delay = 0,
}: Chirp) {
    const audio = readContext();
    if (!audio || !effects) return;
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(40, frequency), start);
    if (slide)
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(40, frequency + slide),
            start + seconds,
        );
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain);
    gain.connect(effects);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
}

const noiseBuffers = new Map<string, AudioBuffer>();

function hiss(seconds: number, volume: number, delay = 0) {
    const audio = readContext();
    if (!audio || !effects) return;
    const rate = audio.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const key = `${rate}:${length}`;
    let buffer = noiseBuffers.get(key);
    if (!buffer) {
        buffer = audio.createBuffer(1, length, rate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < length; index++)
            data[index] = (Math.random() * 2 - 1) * (1 - index / length);
        noiseBuffers.set(key, buffer);
    }
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(effects);
    source.start(audio.currentTime + delay);
}

const orbNotes = [784, 880, 1047, 1175, 1319];
let orbNote = 0;
const lastPlayed = new Map<Cue, number>();

/** Seconds a cue waits before it plays again: a crowd of kills or orbs in
 *  one moment makes one sound, not fifty. */
const cueCooldowns: Partial<Record<Cue, number>> = {
    [Cue.Orb]: 0.055,
    [Cue.Death]: 0.045,
    [Cue.Food]: 0.1,
    [Cue.Health]: 0.1,
    [Cue.Magnet]: 0.1,
    [Cue.DoubleXp]: 0.1,
};

/** Plays `cue`, once per its cooldown. */
export function playChiptune(cue: Cue) {
    const now = performance.now() / 1000;
    const cooldown = cueCooldowns[cue] ?? 0;
    if (now - (lastPlayed.get(cue) ?? -99) < cooldown) return;
    lastPlayed.set(cue, now);
    switch (cue) {
        case Cue.Pulse:
            return chirp({
                frequency: 740,
                seconds: 0.07,
                volume: 0.05,
                slide: 220,
            });
        case Cue.Laser:
            return chirp({
                frequency: 1280,
                seconds: 0.14,
                volume: 0.05,
                slide: -760,
            });
        case Cue.Boomerang:
            chirp({ frequency: 420, seconds: 0.1, volume: 0.045, slide: 160 });
            return chirp({ frequency: 640, seconds: 0.08, volume: 0.03 });
        case Cue.Shard:
            return hiss(0.07, 0.08);
        case Cue.Nova:
            return chirp({
                frequency: 880,
                seconds: 0.16,
                volume: 0.05,
                slide: -420,
            });
        case Cue.Mine:
            return chirp({
                frequency: 160,
                seconds: 0.15,
                volume: 0.07,
                slide: -70,
            });
        case Cue.Zap:
            chirp({
                frequency: 1180,
                seconds: 0.07,
                volume: 0.05,
                slide: -640,
            });
            return chirp({
                frequency: 1760,
                seconds: 0.04,
                volume: 0.02,
                slide: -200,
                type: "triangle",
                delay: 0.02,
            });
        case Cue.Death:
            chirp({
                frequency: 640,
                seconds: 0.09,
                volume: 0.055,
                slide: -380,
            });
            return hiss(0.05, 0.04);
        case Cue.Orb: {
            const pitch = orbNotes[orbNote++ % orbNotes.length];
            chirp({
                frequency: pitch,
                seconds: 0.055,
                volume: 0.027,
                slide: pitch * 0.16,
            });
            return chirp({
                frequency: pitch * 2,
                seconds: 0.04,
                volume: 0.012,
                type: "triangle",
                delay: 0.025,
            });
        }
        case Cue.Food:
            for (let bite = 0; bite < 3; bite++) {
                hiss(0.035, 0.052, bite * 0.09);
                chirp({
                    frequency: 190 - bite * 18,
                    seconds: 0.065,
                    volume: 0.037,
                    slide: -85,
                    type: "triangle",
                    delay: bite * 0.09,
                });
            }
            return;
        case Cue.Health:
            [523, 659, 784].forEach((frequency, step) =>
                chirp({
                    frequency,
                    seconds: 0.13,
                    volume: 0.045,
                    type: "triangle",
                    delay: step * 0.07,
                }),
            );
            return;
        case Cue.Magnet:
            chirp({
                frequency: 180,
                seconds: 0.25,
                volume: 0.04,
                slide: 1150,
                type: "sawtooth",
            });
            return chirp({
                frequency: 1320,
                seconds: 0.12,
                volume: 0.03,
                slide: -100,
                type: "triangle",
                delay: 0.19,
            });
        case Cue.DoubleXp:
            [659, 988, 1319, 1760].forEach((frequency, step) =>
                chirp({
                    frequency,
                    seconds: 0.09,
                    volume: 0.034,
                    delay: step * 0.05,
                }),
            );
            return;
        case Cue.Legendary:
            [880, 1320, 1760].forEach((frequency, step) =>
                chirp({
                    frequency,
                    seconds: 0.65,
                    volume: 0.11,
                    type: "sine",
                    delay: [0, 0.13, 0.27][step],
                }),
            );
            return;
        case Cue.Fanfare:
            return playFanfare();
    }
}

/** The boss's fall: a bright run up and a held top note. */
function playFanfare() {
    const lead = [
        [0, 523, 0.12],
        [0.14, 659, 0.12],
        [0.28, 784, 0.14],
        [0.46, 1047, 0.22],
        [0.74, 784, 0.12],
        [0.9, 1047, 0.26],
        [1.22, 1175, 0.12],
        [1.36, 1568, 0.62],
    ];
    const bass = [
        [0, 262, 0.42],
        [0.46, 196, 0.26],
        [0.74, 262, 0.44],
        [1.22, 392, 0.76],
    ];
    for (const [delay, frequency, seconds] of lead)
        chirp({ frequency, seconds, volume: 0.06, delay });
    for (const [delay, frequency, seconds] of bass)
        chirp({ frequency, seconds, volume: 0.07, type: "triangle", delay });
}

let songBuffer: AudioBuffer | null = null;
let songNode: AudioBufferSourceNode | null = null;

/** The death screen's song: eight bars at 68 beats a minute, a falling
 *  square lead over a slow pad and bass, rendered once. */
function renderSong(audio: AudioContext) {
    const rate = 14000;
    const beatsPerMinute = 68;
    const bars = 8;
    const samplesPerBeat = Math.round((rate * 60) / beatsPerMinute);
    const length = samplesPerBeat * 4 * bars;
    const buffer = audio.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    const pitch = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
    const chords = [
        [57, 60, 64],
        [53, 57, 60],
        [50, 53, 57],
        [52, 56, 59],
    ];
    const lead = [
        81, 79, 76, 74, 72, 71, 69, 67, 76, 74, 72, 69, 67, 65, 64, 60,
    ];
    const square = (sample: number, frequency: number) =>
        ((sample * frequency) / rate) % 1 < 0.28 ? 1 : -1;
    for (let sample = 0; sample < length; sample++) {
        const beat = sample / samplesPerBeat;
        const bar = Math.floor(beat / 4);
        const chord = chords[Math.floor(bar / 2) % 4];
        const chordPosition = (beat % 8) / 8;
        const padEnvelope =
            Math.sin((Math.min(1, chordPosition * 3) * Math.PI) / 2) *
            Math.min(1, (1 - chordPosition) * 4);
        let pad = 0;
        for (const note of chord)
            pad +=
                square(sample, pitch(note - 12)) * 0.045 +
                Math.sin((2 * Math.PI * pitch(note) * sample) / rate) * 0.03;
        const step = Math.floor(beat * 2) % lead.length;
        const notePosition = (beat * 2) % 1;
        const leadEnvelope =
            Math.sin((Math.min(1, notePosition * 6) * Math.PI) / 2) *
            Math.max(0, 1 - notePosition * notePosition);
        const melody = square(sample, pitch(lead[step])) * leadEnvelope * 0.07;
        const bass =
            square(sample, pitch(chord[0] - 24)) *
            (beat % 1 < 0.5 ? 0.1 : 0.03);
        data[sample] = Math.tanh((pad * padEnvelope + melody + bass) * 1.4);
    }
    const fade = 48;
    for (let sample = 0; sample < fade; sample++) {
        const share = sample / fade;
        data[sample] *= share;
        data[length - 1 - sample] *= share;
    }
    return buffer;
}

export function playDeathSong() {
    const audio = readContext();
    if (!audio || !music) return;
    stopDeathSong();
    songBuffer ??= renderSong(audio);
    songNode = audio.createBufferSource();
    songNode.buffer = songBuffer;
    songNode.loop = true;
    songNode.connect(music);
    songNode.start();
}

export function stopDeathSong() {
    try {
        songNode?.stop();
        songNode?.disconnect();
    } catch {
        //  Stopped already.
    }
    songNode = null;
}
