import type { Entity } from "koota";
import { Color, Vector3 } from "three";
import { Element, readHeldElements } from "../../siege/elements";
import { noteStormHit } from "../monsters/stormHits";
import { elementColors } from "../palette";
import {
    emitBolt,
    emitFlame,
    emitGlint,
    emitGlow,
    emitSparks,
} from "./EffectPools";

//  A hit's element, as the monster it lands on shows it: Storm crackles
//  bright and fast, Ember flashes white-hot and throws a lick of flame and
//  a few sparks, Frost puffs ice-blue. Each a few
//  pooled particles over the shot's own spark, at full brightness for the
//  page's own warden and dimmer for a teammate.

const white = new Color("#ffffff");
const tints: Record<Element, Color> = {
    [Element.Storm]: new Color(elementColors[Element.Storm])
        .lerp(white, 0.35)
        .multiplyScalar(2.2),
    [Element.Ember]: new Color(elementColors[Element.Ember])
        .lerp(white, 0.25)
        .multiplyScalar(1.8),
    [Element.Frost]: new Color(elementColors[Element.Frost])
        .lerp(white, 0.3)
        .multiplyScalar(1.6),
};
/** An Ember hit's flash, white-hot, and its lick of flame, which keeps the
 *  flame's own colours. */
const emberFlash = new Color("#fff0cc").multiplyScalar(3.2);
const emberLick = new Color(1, 1, 1).multiplyScalar(1.8);
/** A Storm hit's crackle: a white core over the tint's glow, and its
 *  pinpoint flash. */
const stormCore = new Color("#fffbe8").multiplyScalar(2.6);
const stormFlash = new Color("#f2f6ff").multiplyScalar(2.4);
/** Tiny sparks a Storm hit jumps over the body. */
const crackles = 2;
const crackleFrom = new Vector3();
const crackleTo = new Vector3();
/** A Frost hit's glints of ice and its puff of cold mist. */
const frostGlint = new Color("#eaf8ff").multiplyScalar(2.2);
const frostMist = new Color("#9fd4ff").multiplyScalar(0.9);
const spot = new Vector3();
const scatter = new Vector3();

/** Times full brightness a teammate's hit draws at. */
const teammateBrightness = 0.45;

//  Written in place for each hit.
const shade = new Color();
const flash = new Color();
const held: Element[] = [];

/** A crackle to draw: where, and its glow's and its core's colours. */
interface Crackle {
    position: Vector3;
    glow: Color;
    core: Color;
    /** Zigzags it throws: two on a hit, one where an arc lands. */
    count?: number;
}

/** A crackle of Storm on a body: a few tiny zigzags of lightning jumping
 *  over it round `position`, gone within a fifth of a second. */
export function drawCrackle({
    position,
    glow,
    core,
    count = crackles,
}: Crackle) {
    for (let crackle = 0; crackle < count; crackle++) {
        crackleFrom
            .copy(position)
            .add(
                scatter.set(
                    (Math.random() - 0.5) * 0.4,
                    (Math.random() - 0.5) * 0.4,
                    (Math.random() - 0.5) * 0.4,
                ),
            );
        crackleTo
            .copy(crackleFrom)
            .add(
                scatter
                    .set(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                    )
                    .setLength(0.3 + Math.random() * 0.2),
            );
        emitBolt({
            from: crackleFrom,
            to: crackleTo,
            color: glow,
            width: 0.07,
            seconds: 0.25,
            jag: 0.08,
            bends: 4,
            afterglow: true,
            core: { color: core, width: 0.03, seconds: 0.22 },
        });
    }
}

/** A hit to draw an element on: where, whose, and whether she is this
 *  page's warden. */
export interface ElementHitDraw {
    position: Vector3;
    shooter: Entity;
    own: boolean;
}

/** Draws each of the shooter's elements on her hit at `position`. */
export function drawElementHit({ position, shooter, own }: ElementHitDraw) {
    for (const element of readHeldElements(shooter, held)) {
        shade.copy(tints[element]);
        if (!own) shade.multiplyScalar(teammateBrightness);
        if (element === Element.Storm) {
            noteStormHit(position);
            const brightness = own ? 1 : teammateBrightness;
            drawCrackle({
                position,
                glow: shade,
                core: flash.copy(stormCore).multiplyScalar(brightness),
            });
            emitGlint({
                position,
                color: flash.copy(stormFlash).multiplyScalar(brightness),
                seconds: 0.06,
                size: 0.18,
            });
        } else if (element === Element.Ember) {
            const brightness = own ? 1 : teammateBrightness;
            emitGlow({
                position,
                color: flash.copy(emberFlash).multiplyScalar(brightness),
                seconds: 0.09,
                size: 0.5,
                endSize: 0.65,
            });
            emitFlame({
                position,
                color: flash.copy(emberLick).multiplyScalar(brightness),
                seconds: 0.4,
                size: 0.6,
                endSize: 0.15,
                rise: 1.6,
            });
            emitSparks({
                position,
                color: shade,
                count: 5,
                speed: 3.5,
                seconds: 0.4,
                width: 0.035,
                weight: 0.4,
            });
        } else {
            const brightness = own ? 1 : teammateBrightness;
            for (let glint = 0; glint < 2; glint++)
                emitGlint({
                    position: spot
                        .copy(position)
                        .add(
                            scatter.set(
                                (Math.random() - 0.5) * 0.4,
                                (Math.random() - 0.5) * 0.4,
                                (Math.random() - 0.5) * 0.4,
                            ),
                        ),
                    color: flash.copy(frostGlint).multiplyScalar(brightness),
                    seconds: 0.18 + Math.random() * 0.1,
                    size: 0.24,
                });
            emitGlow({
                position,
                color: flash.copy(frostMist).multiplyScalar(brightness),
                seconds: 0.35,
                size: 0.45,
                endSize: 1,
                rise: 0.3,
            });
        }
    }
}
