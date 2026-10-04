import { useFrame } from "@react-three/fiber";
import type { Entity, World } from "koota";
import { useTrait, useWorld } from "koota/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, Vector3, type Group } from "three";
import {
    findPlayerHero,
    NetworkIdTrait,
    TransformTrait,
} from "@spawnite/engine";
import { measureHearing, playSound, Sound } from "../../audio/sounds";
import { Element, Mark } from "../../siege/elements";
import { ElementLookTrait, lookSteps, WardenTrait } from "../../siege/traits";
import {
    emitGlint,
    emitGlow,
    emitScorch,
    emitShards,
    emitSparks,
} from "../effects/EffectPools";
import { elementColors } from "../palette";
import { isTakenAway, readWelcomes } from "./Corpses";
import { createMark, hideMarks, MarkKind, showMarks } from "./marks";
import { hideSigil, showSigil } from "./sigils";

//  What the elements leave on a monster, drawn over it as its own layer:
//  the monster's model, rig and materials are never touched but for its
//  clips holding still while it is frozen, and the frost a chill paints on
//  its skin, which its view lights. A mark rings the ground at its feet in
//  its element's colour; a burn licks at its chest and shoulders in tongues
//  of flame, throws embers and leaves a scorch where it ends; a chill
//  glints with frost and spreads frost on the ground; and a frozen one
//  stands in a cut shell of ice over frost and cold mist. Each is a mark,
//  one instanced draw of its kind for every monster, or a pooled particle:
//  only each mark's place, scale and colour are its own. A warden's own
//  burn and chill draw at full brightness and her teammates' dimmer; a
//  mark always at full, since it asks every warden to answer it.

const white = new Color("#ffffff");
/** How far toward white a glow goes, and past white for the bloom. */
const whiteness = 0.25;
const markHeat = 1.6;
/** A chill's frost on the ground: brighter and wider with each stack,
 *  and fainter under a frozen one, whose ice glows over it. Its width
 *  times the monster's radius at the lightest chill and at full. */
const frostHeat = { least: 0.6, full: 0.9, frozen: 0.35 };
const frostWidth = { least: 1.8, full: 2.8 };
/** Times full brightness a teammate's burn and chill draw at. */
const teammateBrightness = 0.45;
/** A mark's ring on the ground, times the monster's radius: the blazing
 *  one hugs its flames, the frozen one its ice. */
const ringWidth = { blazing: 2.6, frozen: 3 };

function readTint(element: Element, heat: number) {
    return new Color(elementColors[element])
        .lerp(white, whiteness)
        .multiplyScalar(heat);
}

/** A burn's tongue of flame at full brightness: its texture holds its
 *  colours, so this only sets how bright, a little past white for the
 *  bloom. A teammate's draws dimmer. */
const tongueHeat = 1.15;

/** A mark a monster may wear. */
type WornMark = Mark.Blazing | Mark.Frozen;

/** Each mark's glow and ring, and the burn's flame and the chill's haze at
 *  full brightness and a teammate's. */
const auraColors = {
    mark: {
        [Mark.Blazing]: readTint(Element.Ember, markHeat),
        [Mark.Frozen]: readTint(Element.Frost, markHeat),
    } satisfies Record<WornMark, Color>,
    tongue: [
        new Color(1, 1, 1).multiplyScalar(tongueHeat),
        new Color(1, 1, 1).multiplyScalar(tongueHeat * teammateBrightness),
    ],
    frost: [
        readTint(Element.Frost, 1),
        readTint(Element.Frost, teammateBrightness),
    ],
};

/** An ember: the element's own orange-red, none of the white a glow
 *  takes, so it never reads as the night's pale fireflies. */
const emberColor = new Color(elementColors[Element.Ember]).multiplyScalar(2.4);
const emberDim = emberColor.clone().multiplyScalar(teammateBrightness);
/** A glint of frost, near white and past it for the bloom, and a cold
 *  mist, faint so the ice shows through it. */
const glintColor = new Color("#eaf8ff").multiplyScalar(3.6);
const glintDim = glintColor.clone().multiplyScalar(teammateBrightness);
const mistColor = new Color("#bfe6ff").multiplyScalar(0.45);
/** The freeze's snap: a white-blue flash over the monster. */
const snapColor = new Color("#f4fbff").multiplyScalar(1.6);
/** Ice chips a freeze throws and a thaw breaks off: deeper than the glow,
 *  so a chip reads as ice rather than a white flake. */
const chipColor = new Color("#5fb0e8").multiplyScalar(0.5);
/** A frozen mark's ring is fainter than a blazing one's: the ice and the
 *  frost under it glow for it. */
const frozenRingHeat = 1.2;
/** A blazing mark's ring is brighter than its colour's glow, so it shows
 *  at the feet from the fight camera. */
const blazingRingHeat = 1.6;
/** Glints a second on a chilled monster, at the lightest chill and on top
 *  of that at full; on a frozen one's ice; and mist puffs a second at a
 *  frozen one's feet. */
const glintsPerSecond = { least: 4, full: 30, frozen: 7 };
const mistPerSecond = 2.5;
/** Embers a second a burning monster throws, at the lightest burn and on
 *  top of that at full. */
const embersPerSecond = { least: 14, full: 30 };
/** Seconds a scorch lies where a burn ended, and its width times the
 *  monster's. */
const scorchSeconds = 8;
const scorchWidth = 3.6;
/** Metres a scorch lies over a monster's feet: over the tips of the short
 *  grass round the circle, which would hide one laid on the soil. */
const scorchLift = 0.12;
/** Embers left glowing in a scorch, each going out on its own. */
const scorchEmbers = 5;
const fleckColor = new Color("#ff6a2b").multiplyScalar(1.8);

/** Where each tongue of a burn stands on the monster, in the order they
 *  light: the chest, then each shoulder's edge. Its foot across and up as
 *  shares of the monster's radius and height, its size as shares of the
 *  flame's, its shape, and its own beat, so no two flicker together. */
const tongues = [
    {
        across: -0.3,
        up: 0.5,
        width: 0.8,
        height: 1,
        kind: MarkKind.FlameLeft,
        beat: 0,
    },
    {
        across: -0.8,
        up: 0.68,
        width: 0.85,
        height: 0.8,
        kind: MarkKind.Flame,
        beat: 2.1,
    },
    {
        across: 0.8,
        up: 0.64,
        width: 0.9,
        height: 0.85,
        kind: MarkKind.FlameRight,
        beat: 4.3,
    },
];
/** A blazing monster's tongues, times a full burn's: taller and brighter,
 *  so the mark reads apart from a full burn at the fight camera. */
const blazingFlame = { height: 1.25, heat: 1.5 };

/** A burn's flame at `burn`, from 0 to full at 1: how many tongues burn,
 *  each tongue's width times the monster's radius and height times its
 *  height, and times its brightness it glows. One tongue licks at the
 *  chest of a light burn, and three cover the chest and shoulders of a
 *  full one, reaching a little over the head: the flame keeps to the
 *  monster's own size, so a crowd of burning husks still reads as husks. */
export function readFlameSize(burn: number) {
    return {
        tongues: burn < 0.3 ? 1 : burn < 0.65 ? 2 : 3,
        width: 1 + 0.7 * burn,
        height: 0.4 + 0.4 * burn,
        heat: 0.7 + 0.3 * burn,
    };
}

/** The pitch a burn's crackle plays at as it builds to `burn`: rising
 *  with it, up to about a fifth over. */
export function readKindlePitch(burn: number) {
    return 0.85 + 0.65 * burn;
}
//  Written in place each frame.
const place = new Vector3();
const feetAt = new Vector3();
const glintAt = new Vector3();
const scatter = new Vector3();
const rise = new Vector3(0, 1, 0);

interface ElementAuraProps {
    entity: Entity;
    /** Metres the monster stands, and across its body. */
    height: number;
    radius: number;
}

/** The layer, once the room has put an element on the monster: it stays
 *  mounted after, so a thaw still breaks its ice. */
export function ElementAura(props: ElementAuraProps) {
    const look = useTrait(props.entity, ElementLookTrait);
    const [lit, setLit] = useState(false);
    const lights =
        look !== undefined &&
        (look.burn > 0 || look.chill > 0 || look.frozen || look.mark !== "");
    if (lights && !lit) setLit(true);
    if (!lit && !lights) return null;
    return <ElementAuraBody {...props} />;
}

/** Plays `sound` at `place`, as loud as this page's warden hears it,
 *  at `pitch` and times `level`. */
function playAtPlace(world: World, sound: Sound, pitch = 1, level = 1) {
    const listener = findPlayerHero(world)?.get(TransformTrait);
    playSound(sound, {
        pitch,
        volume:
            level * (listener ? measureHearing(listener.distanceTo(place)) : 1),
    });
}

function ElementAuraBody({ entity, height, radius }: ElementAuraProps) {
    const world = useWorld();
    const look = useTrait(entity, ElementLookTrait);
    const rootRef = useRef<Group>(null);
    const marks = useMemo(
        () => ({
            ring: createMark(MarkKind.Ring),
            frost: createMark(MarkKind.Frost),
            tongues: tongues.map(({ kind }) => createMark(kind)),
            ice: createMark(MarkKind.Ice),
        }),
        [],
    );
    useLayoutEffect(() => {
        const own = Object.values(marks).flat();
        showMarks(own);
        return () => hideMarks(own);
    }, [marks]);
    const sigilRef = useRef<Group>(null);
    const emberClock = useRef(0);
    const glintClock = useRef(0);
    const mistClock = useRef(0);
    const mark =
        look?.mark === Mark.Blazing || look?.mark === Mark.Frozen
            ? look.mark
            : undefined;
    const frozen = look?.frozen ?? false;
    const burn = (look?.burn ?? 0) / lookSteps;
    //  Where its feet last stood while it burned, for the scorch it leaves.
    const burntAt = useRef<Vector3 | null>(null);
    const chill = (look?.chill ?? 0) / lookSteps;
    const hero = findPlayerHero(world);
    const heroHue = hero?.get(WardenTrait)?.hue ?? -2;
    const ownBurn = look?.burnHue === heroHue;
    const ownChill = look?.chillHue === heroHue;

    //  A mark's sign over its head, from across the circle.
    useLayoutEffect(() => {
        const anchor = sigilRef.current;
        if (!anchor) return;
        if (mark) showSigil(anchor, mark);
        else hideSigil(anchor);
        return () => hideSigil(anchor);
    }, [mark]);

    //  A freeze cracks the ice on, a thaw breaks it off, a blazing mark
    //  catches with a rush, and her own burn crackles higher as it builds;
    //  the first look the stream brings starts none.
    const seenRef = useRef({ frozen, mark, burn });
    useEffect(() => {
        const seen = seenRef.current;
        seenRef.current = { frozen, mark, burn };
        const feet = entity.get(TransformTrait);
        if (!feet) return;
        place.copy(feet).setY(feet.y + height * 0.5);
        if (frozen && !seen.frozen) {
            //  The ice snaps on: a white-blue flash, a few chips thrown up,
            //  and a ring of cold racing out along the ground.
            emitGlow({
                position: place,
                color: snapColor,
                seconds: 0.08,
                size: radius * 1.8,
                endSize: radius * 2.4,
            });
            playAtPlace(world, Sound.Freeze);
        } else if (!frozen && seen.frozen) {
            //  The ice breaks off in a spray of shards that land, glint and
            //  melt, with a lighter crack than it formed with.
            emitShards({
                position: place,
                height: height * 0.5,
                color: chipColor,
                count: 16,
                size: 1.6,
                reach: 0.25,
                seconds: 1.6,
            });
            for (let glint = 0; glint < 5; glint++)
                emitGlint({
                    position: glintAt
                        .copy(place)
                        .add(
                            scatter.set(
                                (Math.random() - 0.5) * radius * 2,
                                (Math.random() - 0.5) * height * 0.6,
                                (Math.random() - 0.5) * radius * 2,
                            ),
                        ),
                    color: glintColor,
                    seconds: 0.3 + Math.random() * 0.2,
                    size: 0.22,
                });
            playAtPlace(world, Sound.Freeze, 1.35, 0.6);
        }
        if (burn === 0 && seen.burn > 0) leaveScorch(feet);
        if (ownBurn && burn > seen.burn && burn < 1) {
            const listener = findPlayerHero(world)?.get(TransformTrait);
            playSound(Sound.Kindle, {
                pitch: readKindlePitch(burn),
                volume: listener
                    ? measureHearing(listener.distanceTo(place))
                    : 1,
            });
        }
        if (mark === Mark.Blazing && seen.mark !== Mark.Blazing) {
            emitGlow({
                position: place,
                color: emberColor,
                seconds: 0.4,
                size: radius * 2,
                endSize: radius * 4,
            });
            playAtPlace(world, Sound.Ignite);
        }
    }, [entity, frozen, mark, burn, ownBurn, height, radius, world]);

    /** Lays a scorch at `feet`, once for each burn that ends, with a few
     *  embers glowing in it that go out one by one. */
    function leaveScorch(feet: Vector3) {
        burntAt.current = null;
        emitScorch({
            position: place.copy(feet).setY(feet.y + scorchLift),
            size: radius * scorchWidth,
            seconds: scorchSeconds,
        });
        for (let fleck = 0; fleck < scorchEmbers; fleck++)
            emitGlow({
                position: glintAt
                    .copy(feet)
                    .add(
                        scatter.set(
                            (Math.random() - 0.5) * radius * 2.4,
                            0.06,
                            (Math.random() - 0.5) * radius * 2.4,
                        ),
                    ),
                color: fleckColor,
                seconds: 1 + Math.random() * 3,
                size: 0.04 + Math.random() * 0.05,
            });
    }

    //  A monster that falls while it burns leaves its scorch where it fell:
    //  only one the room took away in play, as its body falls, not one a
    //  welcome or a remount takes down alive. Read through a ref, so the
    //  cleanup runs once, as it unmounts.
    const leaveRef = useRef(leaveScorch);
    leaveRef.current = leaveScorch;
    useLayoutEffect(() => {
        //  Read now: the entity has no traits left once it is gone.
        const streamed = entity.get(NetworkIdTrait)?.id;
        const welcomes = readWelcomes(world);
        return () => {
            const feet = burntAt.current;
            if (
                feet &&
                !entity.isAlive() &&
                isTakenAway(world, streamed, welcomes)
            )
                leaveRef.current(feet);
        };
    }, [entity, world]);

    useFrame(({ clock }, delta) => {
        const now = clock.elapsedTime;
        //  A marked monster's own flames or ice glow for it; the ring at
        //  its feet throbs, so it reads at a glance in a crowd.
        const ring = marks.ring.object;
        ring.visible = mark !== undefined;
        if (mark) {
            marks.ring.color
                .copy(auraColors.mark[mark])
                .multiplyScalar(
                    mark === Mark.Frozen ? frozenRingHeat : blazingRingHeat,
                );
            const throb = 1 + 0.15 * Math.sin(now * 6);
            ring.scale.setScalar(
                radius *
                    (mark === Mark.Blazing
                        ? ringWidth.blazing
                        : ringWidth.frozen) *
                    (1.05 - 0.08 * throb),
            );
            ring.rotation.z = now * 0.8;
        }
        const size = readFlameSize(burn);
        const blazing = mark === Mark.Blazing;
        //  Full brightness for her own burn, dimmer for a teammate's.
        const whose = ownBurn ? 0 : 1;
        tongues.forEach((spot, index) => {
            const tongue = marks.tongues[index];
            const lit = burn > 0 && index < size.tongues;
            tongue.object.visible = lit;
            if (!lit) return;
            //  Each licks up and sways on its own beat, two waves apart so
            //  the flicker never repeats to the eye.
            const time = now + spot.beat;
            const lick =
                0.85 + 0.15 * Math.sin(time * 13.1) * Math.sin(time * 5.3);
            const sway = 0.92 + 0.08 * Math.sin(time * 17.7);
            const tall =
                height *
                size.height *
                spot.height *
                lick *
                (blazing ? blazingFlame.height : 1);
            tongue.object.scale.set(
                radius * size.width * spot.width * sway,
                tall,
                1,
            );
            //  The quad's middle, so its foot stands on its spot.
            tongue.object.position.set(
                radius * spot.across,
                height * spot.up + tall * 0.5,
                0,
            );
            tongue.color
                .copy(auraColors.tongue[whose])
                .multiplyScalar(size.heat * (blazing ? blazingFlame.heat : 1));
        });
        //  Frost spreads on the ground under a chilled monster as its
        //  chill builds, and lies full under a frozen one.
        const frost = marks.frost.object;
        const cold = frozen ? 1 : chill;
        frost.visible = cold > 0;
        if (cold > 0) {
            frost.scale.setScalar(
                radius *
                    (frostWidth.least +
                        (frostWidth.full - frostWidth.least) * cold),
            );
            marks.frost.color
                .copy(auraColors.frost[ownChill || frozen ? 0 : 1])
                .multiplyScalar(
                    frozen
                        ? frostHeat.frozen
                        : frostHeat.least +
                              (frostHeat.full - frostHeat.least) * chill,
                );
        }
        //  A frozen one stands in its shell; a chilled one's frost is on
        //  its own skin, which its view paints.
        marks.ice.object.visible = frozen;
        marks.ice.color.setScalar(1);
        const root = rootRef.current;
        if (cold > 0 && root) {
            //  Glints of frost catch on its body, more the colder it is,
            //  and a cold mist curls at a frozen one's feet.
            root.getWorldPosition(feetAt);
            glintClock.current +=
                delta *
                (frozen
                    ? glintsPerSecond.frozen
                    : glintsPerSecond.least + glintsPerSecond.full * chill);
            while (glintClock.current >= 1) {
                glintClock.current -= 1;
                emitGlint({
                    position: glintAt
                        .copy(feetAt)
                        .add(
                            scatter.set(
                                (Math.random() - 0.5) * radius * 1.6,
                                height * (0.15 + Math.random() * 0.8),
                                (Math.random() - 0.5) * radius * 1.6,
                            ),
                        ),
                    color: ownChill || frozen ? glintColor : glintDim,
                    seconds: 0.5 + Math.random() * 0.4,
                    size: 0.18 + Math.random() * 0.12,
                });
            }
            if (frozen) {
                mistClock.current += delta * mistPerSecond;
                if (mistClock.current >= 1) {
                    mistClock.current -= 1;
                    emitGlow({
                        position: glintAt
                            .copy(feetAt)
                            .add(
                                scatter.set(
                                    (Math.random() - 0.5) * radius * 2,
                                    0.25,
                                    (Math.random() - 0.5) * radius * 2,
                                ),
                            ),
                        color: mistColor,
                        seconds: 1.6,
                        size: radius * 1.2,
                        endSize: radius * 2.4,
                        rise: 0.6,
                    });
                }
            }
        }
        //  Embers rise off a burning monster's flames and wink out, more
        //  the more it burns.
        if (burn <= 0 || !root) return;
        root.getWorldPosition((burntAt.current ??= new Vector3()));
        emberClock.current +=
            delta * (embersPerSecond.least + embersPerSecond.full * burn);
        if (emberClock.current < 1) return;
        emberClock.current -= 1;
        place.copy(burntAt.current);
        place.x += (Math.random() - 0.5) * radius * 1.2;
        place.z += (Math.random() - 0.5) * radius * 1.2;
        place.y += height * (0.45 + Math.random() * 0.5);
        //  Fast and thin, so each is drawn as a short streak upward.
        emitSparks({
            position: place,
            color: ownBurn ? emberColor : emberDim,
            count: 1,
            speed: 1.7,
            toward: rise,
            spread: 0.3,
            seconds: 0.75,
            width: 0.03,
            weight: -0.1,
        });
    });

    return (
        <group ref={rootRef}>
            <group ref={sigilRef} position-y={height + 0.6} />
            <primitive
                object={marks.ring.object}
                rotation-x={-Math.PI / 2}
                position-y={0.06}
                visible={false}
            />
            {marks.tongues.map((tongue, index) => (
                <primitive
                    key={tongues[index].beat}
                    object={tongue.object}
                    visible={false}
                />
            ))}
            <primitive
                object={marks.frost.object}
                rotation-x={-Math.PI / 2}
                position-y={0.05}
                visible={false}
            />
            {/*  Round the head too: the shell stands a little over it. */}
            <primitive
                object={marks.ice.object}
                position-y={height * 0.55}
                scale={[radius * 1.35, height * 0.7, radius * 1.35]}
                visible={false}
            />
        </group>
    );
}
