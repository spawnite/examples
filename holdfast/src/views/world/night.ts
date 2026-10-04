import { Color, MathUtils, Vector3 } from "three";
import { calculateDaylight } from "@spawnite/engine";

import type { Phase } from "../../siege/phase";
import { nightWaves } from "../../siege/waves";

//  The night over the circle: dusk at the first wave, dark by the first
//  colossus, the east paling after the second, the sun on the horizon at
//  the last wave, and the sun up at dawn and through Endless. One number
//  carries it, the share of the night gone, which every sky, light and
//  fog of the page reads through one list of stops.

/** One stop on the night's way: the hour the engine's sun and moon stand
 *  at, which lights the circle, and this game's own sky, air and light. */
export interface SkyStop {
    /** The share of the night gone: 0 at dusk, 1 at dawn, past 1 in
     *  Endless. */
    at: number;
    hour: number;
    zenith: string;
    high: string;
    horizon: string;
    /** The band toward the sun, and the sun's halo and disc. */
    burn: string;
    sun: string;
    cloud: string;
    /** The fog the far forest fades into, and the skyline's air. */
    air: string;
    /** The skyline's rim on the sun's side. */
    glow: string;
    /** How many stars show, and how bright the moon: 0 to 1. */
    stars: number;
    moon: number;
    /** The sky's fill from above, and the cool light from the side. */
    fill: string;
    fillIntensity: number;
    side: string;
    sideIntensity: number;
    /** The look's grade: the color the frame is multiplied by, and its
     *  saturation from -1 to 0. Never above 0: a boost turns a color the
     *  bloom pushed past white black, as the scene's look notes. */
    tint: string;
    saturation: number;
}

/** The dusk the circle opens on, as the look and the sky stood before the
 *  night had a way to go. */
const dusk: SkyStop = {
    at: 0,
    hour: 19.3,
    zenith: "#0d1330",
    high: "#2c2f5e",
    horizon: "#3a4163",
    burn: "#e8794a",
    sun: "#ffc58a",
    cloud: "#232642",
    air: "#3a4163",
    glow: "#ff9a58",
    stars: 0.5,
    moon: 0,
    fill: "#7f8cc8",
    fillIntensity: 0.7,
    side: "#7d95ff",
    sideIntensity: 0.8,
    //  Warm, with the sun just gone.
    tint: "#fff0e2",
    saturation: 0,
};

const deepNight: SkyStop = {
    at: 0.46,
    //  Past the dusk the look was graded for, and short of the engine's
    //  full dark: the moon lights the field and the fire the circle. The
    //  fill and side light are high enough that a husk 20 m out stands off
    //  the grass rather than into it.
    hour: 20.12,
    zenith: "#050817",
    high: "#121840",
    //  A moonlit band low on the sky and air a shade above the firs, so
    //  the wood and the ranges stand dark against them.
    horizon: "#2a325c",
    burn: "#2e3258",
    sun: "#8a98c8",
    cloud: "#0f1328",
    air: "#242c50",
    glow: "#6a7ab0",
    stars: 1.3,
    moon: 1,
    fill: "#6a78c8",
    fillIntensity: 1.05,
    side: "#90a8ff",
    sideIntensity: 1.25,
    //  Cool and a little drained, as moonlight is; the fire's orange still
    //  holds against it.
    tint: "#e4ebff",
    saturation: -0.12,
};

/** The share of the night at which the sun passes under the circle, from
 *  the west's side of the dark to the east's: the engine's hours between
 *  are its full dark, so the hour steps across them, while the moon is
 *  low and the step barely shows. */
const midnight = 0.55;
/** The hour across the dark from the deep night's, as far under the east. */
const mirrorHour = 24 - (deepNight.hour - 20);
/** The furthest the sun climbs in Endless: a clear morning. */
const morning = 1.3;

export const skyStops: SkyStop[] = [
    dusk,
    {
        at: 0.25,
        hour: 19.95,
        zenith: "#080c22",
        high: "#181c40",
        horizon: "#2a2f50",
        burn: "#8a4652",
        sun: "#ff9a70",
        cloud: "#181b34",
        air: "#2a3050",
        glow: "#b0604e",
        stars: 1,
        moon: 0.6,
        fill: "#7482c4",
        fillIntensity: 0.8,
        side: "#7d95ff",
        sideIntensity: 0.95,
        tint: "#f2eef6",
        saturation: -0.04,
    },
    deepNight,
    { ...deepNight, at: midnight },
    { ...deepNight, at: midnight, hour: mirrorHour },
    {
        at: 0.72,
        hour: 23.9,
        zenith: "#0a1030",
        high: "#1f2a5a",
        horizon: "#3c4474",
        burn: "#8a5a6a",
        sun: "#ffb090",
        cloud: "#1a2040",
        air: "#2e3658",
        glow: "#a06a70",
        stars: 0.8,
        moon: 0.5,
        fill: "#7480c4",
        fillIntensity: 0.85,
        side: "#8aa0ff",
        sideIntensity: 1.0,
        tint: "#eaecfc",
        saturation: -0.08,
    },
    {
        at: 0.87,
        hour: 23.99,
        zenith: "#1a2c60",
        high: "#4a5e9c",
        horizon: "#c08a80",
        burn: "#ff9860",
        sun: "#ffc890",
        cloud: "#4a4668",
        air: "#5a6088",
        glow: "#ff9a60",
        stars: 0.25,
        moon: 0.15,
        fill: "#8a90c8",
        fillIntensity: 0.75,
        side: "#9aa8ff",
        sideIntensity: 0.8,
        tint: "#fceee8",
        saturation: 0,
    },
    {
        at: 1,
        //  The sun clear of the eastern hills, the air gold with it.
        hour: 25,
        zenith: "#3a6cb4",
        high: "#7fa6d6",
        horizon: "#f2b27a",
        burn: "#ffa850",
        sun: "#ffe6b8",
        cloud: "#e0a080",
        //  A cool haze, so the far wood fades to lilac rather than tan.
        air: "#9ea2c0",
        glow: "#ffb060",
        stars: 0,
        moon: 0,
        //  Warm from above, so what the sun misses still reads as morning.
        fill: "#e8c8b0",
        fillIntensity: 0.66,
        side: "#b8c4ff",
        sideIntensity: 0.4,
        //  Gold with the sunrise.
        tint: "#fff0da",
        saturation: 0,
    },
    {
        at: morning,
        hour: 26,
        zenith: "#3c78c8",
        high: "#8ec0ec",
        horizon: "#e8e0d0",
        burn: "#ffe0b0",
        sun: "#fff8e8",
        cloud: "#e8d8d0",
        air: "#b8c4d4",
        glow: "#ffe0b0",
        stars: 0,
        moon: 0,
        fill: "#b8c8f0",
        fillIntensity: 0.65,
        side: "#c0d0ff",
        sideIntensity: 0.4,
        tint: "#ffffff",
        saturation: 0,
    },
];

/** The share of the night each Endless wave moves the sun on. */
const endlessStep = 0.03;
/** The share of the night the last wave stands at: the sun on the
 *  horizon, with dawn's rise still to come. */
const lastWaveNight = 0.94;

/** Where the run as a page sees it. */
export interface NightRun {
    phase: Phase;
    wave: number;
    endless: boolean;
}

/** The share of the night the sky stands at for wave `wave`: dusk at the
 *  first, the sun on the horizon at the last. */
function measureWave(wave: number) {
    const share = (Math.max(wave, 1) - 1) / (nightWaves - 1);
    return Math.min(1, share) * lastWaveNight;
}

/** The share of the night the sky moves toward for `run`: dusk while the
 *  wardens gather, each wave's while it is fought, and the next wave's
 *  through the breather before it, so the sky turns between waves; dawn,
 *  then a climbing morning through Endless. The end screen keeps the sky
 *  of the wave the run fell on. */
export function measureNight({ phase, wave, endless }: NightRun): number {
    if (phase === "waiting") return 0;
    if (phase === "dawn") return 1;
    const next = phase === "breather" ? wave + 1 : wave;
    if (endless)
        return Math.min(morning, 1 + (next - nightWaves) * endlessStep);
    return measureWave(next);
}

/** The sky as one moment of the night has it, with the sun's and the
 *  moon's directions the engine's hour gives. Written in place. */
export interface NightSky {
    night: number;
    hour: number;
    zenith: Color;
    high: Color;
    horizon: Color;
    burn: Color;
    sun: Color;
    cloud: Color;
    air: Color;
    glow: Color;
    stars: number;
    moon: number;
    fill: Color;
    fillIntensity: number;
    side: Color;
    sideIntensity: number;
    tint: Color;
    saturation: number;
    sunDirection: Vector3;
    moonDirection: Vector3;
}

export function createNightSky(): NightSky {
    return {
        night: 0,
        hour: dusk.hour,
        zenith: new Color(dusk.zenith),
        high: new Color(dusk.high),
        horizon: new Color(dusk.horizon),
        burn: new Color(dusk.burn),
        sun: new Color(dusk.sun),
        cloud: new Color(dusk.cloud),
        air: new Color(dusk.air),
        glow: new Color(dusk.glow),
        stars: dusk.stars,
        moon: dusk.moon,
        fill: new Color(dusk.fill),
        fillIntensity: dusk.fillIntensity,
        side: new Color(dusk.side),
        sideIntensity: dusk.sideIntensity,
        tint: new Color(dusk.tint),
        saturation: dusk.saturation,
        sunDirection: new Vector3().copy(
            calculateDaylight(dusk.hour).direction,
        ),
        moonDirection: new Vector3(),
    };
}

//  The two stops' colours, parsed in place for each blend.
const from = new Color();
const to = new Color();

/** The colours a stop holds, by name. */
const skyColors = [
    "zenith",
    "high",
    "horizon",
    "burn",
    "sun",
    "cloud",
    "air",
    "glow",
    "fill",
    "side",
    "tint",
] as const;

/** The colour between the two stops' `key`, `share` of the way. */
function blend(
    target: Color,
    { before, after, share }: StopPair,
    key: (typeof skyColors)[number],
) {
    return target.copy(from.set(before[key])).lerp(to.set(after[key]), share);
}

/** Two stops round a moment, and how far from the first it stands. */
interface StopPair {
    before: SkyStop;
    after: SkyStop;
    share: number;
}

/** The stops round `night`: the last at or before it, and the next. */
function findStops(night: number): StopPair {
    let index = 0;
    while (index < skyStops.length - 1 && skyStops[index + 1].at <= night)
        index++;
    const before = skyStops[index];
    const after = skyStops[Math.min(index + 1, skyStops.length - 1)];
    const span = after.at - before.at;
    return {
        before,
        after,
        share: span > 0 ? MathUtils.clamp((night - before.at) / span, 0, 1) : 0,
    };
}

/** Writes the sky at `night` into `sky`. */
export function readNightSky(night: number, sky: NightSky) {
    const pair = findStops(night);
    const { before, after, share } = pair;
    sky.night = night;
    sky.hour = MathUtils.lerp(before.hour, after.hour, share);
    for (const key of skyColors) blend(sky[key], pair, key);
    sky.stars = MathUtils.lerp(before.stars, after.stars, share);
    sky.moon = MathUtils.lerp(before.moon, after.moon, share);
    sky.fillIntensity = MathUtils.lerp(
        before.fillIntensity,
        after.fillIntensity,
        share,
    );
    sky.sideIntensity = MathUtils.lerp(
        before.sideIntensity,
        after.sideIntensity,
        share,
    );
    sky.saturation = MathUtils.lerp(before.saturation, after.saturation, share);
    const daylight = calculateDaylight(sky.hour);
    sky.sunDirection.copy(daylight.direction);
    sky.moonDirection.copy(daylight.moonDirection);
    return sky;
}

/** The sky every view of the page draws from, which the night clock
 *  writes once a frame. */
export const nightSky = createNightSky();
