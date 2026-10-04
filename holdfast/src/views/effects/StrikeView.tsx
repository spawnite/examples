import { useFrame } from "@react-three/fiber";
import type { World } from "koota";
import { useWorld } from "koota/react";
import { useRef } from "react";
import { Color, Vector3 } from "three";
import { findPlayerHero, TransformTrait, useEvent } from "@spawnite/engine";
import { measureHearing, playSound, Sound } from "../../audio/sounds";
import { Element } from "../../siege/elements";
import {
    ElementStrikesTrait,
    type Strike,
    StrikeKind,
    WardenTrait,
} from "../../siege/traits";
import { showReaction } from "../../hud/ReactionWords";
import { showDamage } from "../DamageNumbers";
import { noteStormHit } from "../monsters/stormHits";
import { drawCrackle } from "./elementHits";
import { readStrikeShake, shakeView } from "../shakes";
import { elementColors, readWardenColor } from "../palette";
import {
    borrowLight,
    emitBolt,
    emitFlame,
    emitGlint,
    emitGlow,
    emitShards,
    emitSparks,
} from "./EffectPools";

//  Each element's moment as the room sends it, drawn on this page from the
//  shared pools: Storm's arcs, the three reactions, and the three
//  capstones, each with its sound where it happened and, for a reaction,
//  its big word. A warden's own arcs draw at full brightness and her
//  teammates' dimmer; reactions and capstones always at full, and shake
//  the camera of a warden near them, a teammate's less than her own.
//
//  A reaction is the payoff of a mark, so it winds up before it lands: the
//  spent mark's color snaps in to a white point over a tenth of a second,
//  then the reaction bursts out of it with its sound and its word, as a
//  fighting game's hit lands after its flash.

/** Times its full brightness a teammate's arc draws at. */
const teammateBrightness = 0.45;
/** Times full volume a teammate's arc sounds at. */
const teammateVolume = 0.5;
/** How far toward white each glow goes, so the dusk grading keeps it
 *  bright, and how far past white a core burns for the bloom. */
const whiteness = 0.3;
const coreHeat = 3;

const white = new Color("#ffffff");
const storm = new Color(elementColors[Element.Storm]).lerp(white, whiteness);
const ember = new Color(elementColors[Element.Ember]).lerp(white, whiteness);
const frost = new Color(elementColors[Element.Frost]).lerp(white, whiteness);
const stormCore = new Color("#fffbe0").multiplyScalar(coreHeat);
const frostCore = new Color("#eefaff").multiplyScalar(coreHeat);
const fireCore = new Color("#ffe2a0").multiplyScalar(coreHeat);
const emberDark = new Color("#8a2a10");
const steamWhite = new Color("#e8eef0");
const upward = new Vector3(0, 1, 0);
/** Metres above the struck monster a Thunderhead bolt falls from. */
const skyMetres = 26;
/** Seconds a reaction's wind-up takes before it bursts. */
const windUpSeconds = 0.1;
/** Meters up from a monster's feet a reaction's wind-up centers. */
const chestMetres = 1;
/** Meters over a monster's feet a burn's number floats from. */
const burnNumberMetres = 1.8;
/** A lick of flame in its own colours, a little past white for the
 *  bloom. */
const flameWhite = new Color(1, 1, 1).multiplyScalar(1.6);

//  Written in place for each strike.
const at = new Vector3();
const from = new Vector3();
const to = new Vector3();
const shade = new Color();
const coreShade = new Color();
const flashShade = new Color();
const forkFrom = new Vector3();
const forkTo = new Vector3();
const forkWay = new Vector3();
/** Lengths a leap is drawn in at most, so a few long chains at once fit
 *  the bolt pool whole: about forty segments a leap with its core and
 *  forks. */
const maximumBends = 14;
/** An arc's glow: Storm's yellow, a little toward white, saturated
 *  enough to read against a struck body's pale flash. */
const arcGlow = new Color(elementColors[Element.Storm]).lerp(white, 0.05);
/** The white flash where an arc lands, a touch of blue in it. */
const arcFlash = new Color("#dfe9ff").multiplyScalar(2.6);

/** The volume a moment at `at` plays at for this page's warden. */
function measureVolume(at: Vector3, listener: Vector3 | undefined) {
    return listener ? measureHearing(at.distanceTo(listener)) : 1;
}

/** Storm's arc: a thin, jagged bolt from monster to monster, a narrow
 *  yellow glow round a white core, a short fork or two off each leap, and
 *  a white flash where it lands on each. It flashes at full, then lingers
 *  a moment as a dim afterglow. */
function drawArc(strike: Strike, brightness: number) {
    for (let index = 0; index + 2 < strike.points.length; index += 3)
        noteStormHit(to.fromArray(strike.points, index));
    shade.copy(arcGlow).multiplyScalar(brightness * 1.2);
    coreShade.copy(stormCore).multiplyScalar(brightness * 3.2);
    flashShade.copy(arcFlash).multiplyScalar(brightness);
    for (let index = 3; index + 2 < strike.points.length; index += 3) {
        from.fromArray(strike.points, index - 3);
        to.fromArray(strike.points, index);
        //  Finer bends on a longer leap; a short one stays a clean zigzag
        //  rather than a scribble.
        const length = from.distanceTo(to);
        const bends = Math.min(
            maximumBends,
            Math.max(6, Math.round(length * 8)),
        );
        const jag = Math.min(0.2, length * 0.1);
        emitBolt({
            from,
            to,
            color: shade,
            width: 0.1,
            seconds: 0.5,
            jag: jag * 0.6,
            bends,
            kinks: 2 + Math.round(Math.random() * 2),
            afterglow: true,
            core: { color: coreShade, width: 0.055, seconds: 0.45 },
        });
        //  Forks: from a point along the leap, a short crooked branch.
        const forks = length > 1 ? 2 : 1;
        for (let fork = 0; fork < forks; fork++) {
            forkFrom.lerpVectors(from, to, 0.3 + Math.random() * 0.4);
            forkTo
                .copy(forkFrom)
                .add(
                    forkWay
                        .set(
                            Math.random() - 0.5,
                            (Math.random() - 0.5) * 0.6,
                            Math.random() - 0.5,
                        )
                        .setLength(length * (0.2 + Math.random() * 0.15)),
                );
            emitBolt({
                from: forkFrom,
                to: forkTo,
                color: shade,
                width: 0.09,
                seconds: 0.35,
                jag: 0.08,
                bends: 3,
                afterglow: true,
                core: { color: coreShade, width: 0.04, seconds: 0.3 },
            });
        }
        //  The landing: a blue-white pinpoint, a crackle over the body it
        //  reached, and for the first leap a moment's light on the ground.
        emitGlint({
            position: to,
            color: flashShade,
            seconds: 0.18,
            size: 0.45,
        });
        drawCrackle({ position: to, glow: shade, core: coreShade, count: 1 });
        if (index === 3)
            borrowLight({
                position: to,
                color: arcFlash,
                intensity: 3 * brightness,
                seconds: 0.12,
            });
    }
}

/** Chain Shock: a thick bolt of lightning through each frozen monster,
 *  white-hot through ice-blue, the ice on each bursting into shards. */
function drawChainShock(strike: Strike) {
    from.fromArray(strike.points, 0);
    borrowLight({
        position: from,
        color: storm,
        intensity: 45,
        seconds: 0.5,
    });
    emitGlow({
        position: from,
        color: storm,
        seconds: 0.4,
        size: 2,
        endSize: 5,
    });
    for (let index = 0; index + 2 < strike.points.length; index += 3) {
        to.fromArray(strike.points, index);
        if (index > 0) {
            from.fromArray(strike.points, index - 3);
            emitBolt({ from, to, color: storm, width: 1, seconds: 0.45 });
            emitBolt({ from, to, color: frost, width: 0.4, seconds: 0.38 });
            emitBolt({
                from,
                to,
                color: stormCore,
                width: 0.14,
                seconds: 0.32,
                jag: 0.2,
            });
        }
        emitShards({
            position: to,
            height: 1,
            color: frost,
            count: 8,
            size: 0.8,
            seconds: 1.2,
        });
        emitGlow({
            position: to,
            color: frost,
            seconds: 0.45,
            size: 0.6,
            endSize: 3,
            ring: true,
        });
        emitSparks({ position: to, color: storm, count: 10, speed: 9 });
    }
}

/** Blast: a fireball that swells and fades, a shockwave out to its reach,
 *  sparks and burning shards thrown wide, and the ground lit orange. */
function drawBlast(at: Vector3) {
    borrowLight({ position: at, color: ember, intensity: 90, seconds: 0.6 });
    emitGlow({
        position: at,
        color: fireCore,
        seconds: 0.3,
        size: 1,
        endSize: 5,
    });
    emitGlow({ position: at, color: ember, seconds: 0.6, size: 2, endSize: 9 });
    emitGlow({
        position: at,
        color: ember,
        seconds: 0.5,
        size: 1,
        endSize: 9,
        ring: true,
    });
    emitSparks({
        position: at,
        color: fireCore,
        count: 36,
        speed: 15,
        seconds: 0.6,
        width: 0.09,
    });
    emitShards({
        position: at,
        height: 1,
        color: emberDark,
        count: 10,
        size: 1.4,
        seconds: 1.4,
    });
}

/** Steam Cloud's moment: a white burst as the cloud rises. The cloud
 *  itself is drawn while it stands. */
function drawSteamBurst(at: Vector3) {
    emitGlow({
        position: at,
        color: steamWhite,
        seconds: 0.6,
        size: 1.5,
        endSize: 6,
        rise: 1.5,
    });
    emitGlow({
        position: at,
        color: ember,
        seconds: 0.5,
        size: 1,
        endSize: 7,
        ring: true,
    });
}

/** Thunderhead: a bolt from the sky onto the monster, a flash that lights
 *  the circle, and a ring and sparks where it lands. */
function drawThunderhead(at: Vector3) {
    from.copy(at).setY(at.y + skyMetres);
    to.copy(at);
    borrowLight({
        position: at,
        color: stormCore,
        intensity: 140,
        seconds: 0.45,
    });
    emitBolt({
        from,
        to,
        color: storm,
        width: 1.6,
        seconds: 0.5,
        jag: 1.4,
        bends: 9,
    });
    emitBolt({
        from,
        to,
        color: stormCore,
        width: 0.3,
        seconds: 0.36,
        jag: 1.1,
        bends: 9,
    });
    emitGlow({
        position: at,
        color: stormCore,
        seconds: 0.3,
        size: 2,
        endSize: 4,
    });
    emitGlow({
        position: at,
        color: storm,
        seconds: 0.5,
        size: 0.5,
        endSize: 6,
        ring: true,
    });
    emitSparks({
        position: at,
        color: storm,
        count: 28,
        speed: 12,
        toward: upward,
        spread: 1.2,
        seconds: 0.5,
    });
}

/** Meltdown: a column of fire erupting from the monster in licks of
 *  flame, a ring of heat, and sparks thrown up. */
function drawMeltdown(at: Vector3) {
    borrowLight({ position: at, color: ember, intensity: 70, seconds: 0.7 });
    for (let lick = 0; lick < 5; lick++)
        emitFlame({
            position: at,
            color: flameWhite,
            seconds: 0.45 + lick * 0.1,
            size: 1.1 - lick * 0.12,
            endSize: 0.3,
            rise: 3 + lick * 1.6,
        });
    emitGlow({
        position: at,
        color: ember,
        seconds: 0.55,
        size: 1,
        endSize: 6,
        ring: true,
    });
    emitSparks({
        position: at,
        color: fireCore,
        count: 30,
        speed: 13,
        toward: upward,
        spread: 0.6,
        seconds: 0.7,
    });
}

/** Shatter: the frozen monster bursting into shards of ice, and a ring of
 *  frost racing out over the ones it freezes. */
function drawShatter(at: Vector3) {
    borrowLight({ position: at, color: frost, intensity: 60, seconds: 0.5 });
    emitShards({
        position: at,
        height: 1,
        color: frost,
        count: 22,
        size: 1.4,
        seconds: 1.6,
    });
    emitGlow({
        position: at,
        color: frostCore,
        seconds: 0.25,
        size: 1.5,
        endSize: 3,
    });
    emitGlow({
        position: at,
        color: frost,
        seconds: 0.6,
        size: 0.5,
        endSize: 8,
        ring: true,
    });
    emitSparks({ position: at, color: frostCore, count: 16, speed: 10 });
}

/** A scattergun pellet's bounces: a short streak of the shooter's colour
 *  from monster to monster, and a spark where it strikes each. */
function drawRicochet(strike: Strike, brightness: number) {
    const hue = strike.by?.get(WardenTrait)?.hue ?? 0;
    shade
        .set(readWardenColor(hue))
        .lerp(white, 0.35)
        .multiplyScalar(1.8 * brightness);
    coreShade.copy(white).multiplyScalar(2.2 * brightness);
    for (let index = 3; index + 2 < strike.points.length; index += 3) {
        from.fromArray(strike.points, index - 3);
        to.fromArray(strike.points, index);
        emitBolt({
            from,
            to,
            color: shade,
            width: 0.12,
            seconds: 0.12,
            jag: 0,
            bends: 1,
        });
        emitBolt({
            from,
            to,
            color: coreShade,
            width: 0.035,
            seconds: 0.08,
            jag: 0,
            bends: 1,
        });
        emitSparks({
            position: to,
            color: shade,
            count: 5,
            speed: 5,
            seconds: 0.2,
        });
    }
}

/** The sound each strike plays: a burn's number none, since its monster's
 *  flame crackles as the burn builds. */
const strikeSounds: Partial<Record<StrikeKind, Sound>> = {
    [StrikeKind.Ricochet]: Sound.Ricochet,
    [StrikeKind.Arc]: Sound.Arc,
    [StrikeKind.ChainShock]: Sound.ChainShock,
    [StrikeKind.Blast]: Sound.Blast,
    [StrikeKind.SteamCloud]: Sound.Steam,
    [StrikeKind.Thunderhead]: Sound.Thunderhead,
    [StrikeKind.Meltdown]: Sound.Meltdown,
    [StrikeKind.Shatter]: Sound.Shatter,
};

/** Who watches a strike: whether it is her own, and where she stands to
 *  hear it, where she stands anywhere. */
interface Watcher {
    own: boolean;
    listener: Vector3 | undefined;
}

/** Whether a strike is a reaction, the payoff of a mark. */
function isReaction(kind: StrikeKind) {
    return (
        kind === StrikeKind.ChainShock ||
        kind === StrikeKind.Blast ||
        kind === StrikeKind.SteamCloud
    );
}

/** The spent mark's color for a reaction's wind-up: ice for what Storm
 *  or Ember set off on frozen, fire for what they set off on blazing. */
const windUpColors: Partial<Record<StrikeKind, Color>> = {
    [StrikeKind.ChainShock]: frost,
    [StrikeKind.Blast]: ember,
    [StrikeKind.SteamCloud]: steamWhite,
};

/** A reaction's wind-up at each monster it spends: the mark's color and a
 *  white core, each shrinking in to a point. */
function drawWindUp(strike: Strike) {
    const color = windUpColors[strike.kind] ?? white;
    const each =
        strike.kind === StrikeKind.ChainShock ? 3 : strike.points.length;
    for (let index = 0; index + 2 < strike.points.length; index += each) {
        at.fromArray(strike.points, index);
        at.y += chestMetres;
        emitGlow({
            position: at,
            color,
            seconds: windUpSeconds,
            size: 3.2,
            endSize: 0.4,
            ring: true,
        });
        emitGlow({
            position: at,
            color: coreShade.copy(white).multiplyScalar(coreHeat),
            seconds: windUpSeconds * 1.4,
            size: 1.6,
            endSize: 0.3,
        });
    }
}

/** A reaction waiting out its wind-up, and when it lands on the page's
 *  clock. */
interface Pending {
    strike: Strike;
    watcher: Watcher;
    due: number;
}

/** Draws `strike`, plays its sound and shakes the camera, for this page's
 *  warden. */
function drawStrike(world: World, strike: Strike, { own, listener }: Watcher) {
    at.fromArray(strike.points, 0);
    const shake = readStrikeShake(strike.kind, own);
    if (shake !== undefined) shakeView(world, { strength: shake, at });
    const volume = measureVolume(at, listener);
    switch (strike.kind) {
        case StrikeKind.Arc:
            drawArc(strike, own ? 1 : teammateBrightness);
            break;
        case StrikeKind.ChainShock:
            drawChainShock(strike);
            break;
        case StrikeKind.Blast:
            drawBlast(at);
            break;
        case StrikeKind.SteamCloud:
            drawSteamBurst(at);
            break;
        case StrikeKind.Thunderhead:
            drawThunderhead(at);
            break;
        case StrikeKind.Meltdown:
            drawMeltdown(at);
            break;
        case StrikeKind.Shatter:
            drawShatter(at);
            break;
        case StrikeKind.Ricochet:
            drawRicochet(strike, own ? 1 : teammateBrightness);
            break;
        case StrikeKind.Burn:
            //  Every warden's, as every hit's number shows, over the
            //  monster's head.
            at.y += burnNumberMetres;
            showDamage({ position: at, amount: strike.amount, burn: true });
            return;
    }
    const sound = strikeSounds[strike.kind];
    if (sound === undefined) return;
    playSound(sound, {
        volume:
            (strike.kind === StrikeKind.Arc ||
                strike.kind === StrikeKind.Ricochet) &&
            !own
                ? volume * teammateVolume
                : volume,
    });
    if (isReaction(strike.kind)) showReaction({ strike, position: at });
}

/** Hears each step's strikes on the siege and draws them, a reaction
 *  after its wind-up. The room, which draws nothing, hears none. */
export function StrikeView() {
    const world = useWorld();
    const clockRef = useRef(0);
    //  The view's own, so a reaction left waiting as the scene unmounts
    //  never bursts in the next one.
    const pendingRef = useRef<Pending[]>([]);
    useEvent(ElementStrikesTrait, (siege) => {
        const hero = findPlayerHero(world);
        const listener = hero?.get(TransformTrait)?.clone();
        for (const strike of siege.get(ElementStrikesTrait)?.strikes ?? []) {
            const watcher = { own: strike.by === hero, listener };
            if (!isReaction(strike.kind)) {
                drawStrike(world, strike, watcher);
                continue;
            }
            //  Its own copy: the event's record is the room's next send's.
            const held = { ...strike, points: [...strike.points] };
            drawWindUp(held);
            pendingRef.current.push({
                strike: held,
                watcher,
                due: clockRef.current + windUpSeconds,
            });
        }
    });
    useFrame((_state, delta) => {
        clockRef.current += delta;
        const pending = pendingRef.current;
        while (pending.length > 0 && pending[0].due <= clockRef.current) {
            const next = pending.shift();
            if (next) drawStrike(world, next.strike, next.watcher);
        }
    });
    return null;
}
