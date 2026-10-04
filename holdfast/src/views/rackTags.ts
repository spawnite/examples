//  The rack's tags on the screen. Each stands over its stand in the world,
//  and from most places a warden stands the three stands line up, so the
//  tags would cover each other. The nearest keeps its place; each farther
//  one lifts above every tag placed before it that it would cover, and
//  above what the screen keeps clear, such as her cards, as a map's labels
//  are placed nearest first.

import type { Phase } from "../siege/phase";

/** A box on the screen, in CSS pixels from its top left. */
export interface ScreenBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** A tag where it stands, round its middle, and how far its stand is from
 *  the camera. */
export interface ScreenTag {
    x: number;
    y: number;
    width: number;
    height: number;
    distance: number;
}

/** Pixels kept between two tags, and between a tag and a kept box. */
const tagGap = 4;

/** Whether two boxes overlap, with `tagGap` round them. */
function overlaps(a: ScreenBox, b: ScreenBox) {
    return (
        a.left < b.left + b.width + tagGap &&
        b.left < a.left + a.width + tagGap &&
        a.top < b.top + b.height + tagGap &&
        b.top < a.top + a.height + tagGap
    );
}

/** Whether the rack's tags stand down: through a wave, and while her hand
 *  holds the part of the screen they would cross, the element pick in the
 *  middle or any hand at the top of a phone held upright, where a lifted
 *  tag would land on the corner's buttons. */
export function areTagsHidden({
    phase,
    picking,
    handAtTop,
}: {
    phase: Phase | undefined;
    picking: boolean;
    handAtTop: boolean;
}) {
    return phase === "fight" || picking || handAtTop;
}

/** The pixels each of `tags` lifts, in their order, 0 or less: the nearest
 *  stays where it stands, and each farther one rises above every tag
 *  placed before it and every box in `kept` it would cover. */
export function liftTags(
    tags: readonly ScreenTag[],
    kept: readonly ScreenBox[],
): number[] {
    const lifts = tags.map(() => 0);
    const placed: ScreenBox[] = [...kept];
    const order = tags
        .map((tag, index) => ({ tag, index }))
        .sort((a, b) => a.tag.distance - b.tag.distance);
    for (const { tag, index } of order) {
        const box: ScreenBox = {
            left: tag.x - tag.width / 2,
            top: tag.y - tag.height / 2,
            width: tag.width,
            height: tag.height,
        };
        //  Each rise may meet another placed box above: rise again, at most
        //  once for each.
        for (let tries = 0; tries <= placed.length; tries++) {
            const under = placed.find((other) => overlaps(box, other));
            if (!under) break;
            box.top = under.top - tagGap - box.height;
        }
        lifts[index] = box.top - (tag.y - tag.height / 2);
        placed.push(box);
    }
    return lifts;
}

//  Which tags show, as Risk of Rain 2 shows a price within 15 m and
//  Roblox's prompts need a line of sight and the camera's facing: in the
//  breather and the gathering, a stand within 10 m, within 30° of the
//  camera's forward and in sight, and its detail line within 4 m. Every
//  tag hides during a wave and while her element pick is open, and steps
//  aside for the Use prompt within 2.2 m. Each distance edge and the facing
//  have a margin a shown tag keeps, so a warden standing on an edge never
//  sees a tag flicker.

/** Metres from her feet within which a stand's tag shows, and within which
 *  it says what its gun does. */
export const tagMetres = 10;
export const detailMetres = 4;
/** Metres from a stand within which its Use prompt speaks for it. */
export const promptMetres = 2.2;
/** Degrees off the camera's forward within which a stand's tag shows. */
export const tagDegrees = 30;
/** The margins a shown tag keeps past each edge: metres, and degrees. */
const edgeMetres = 1;
const edgeDegrees = 6;

/** Whether a stand's tag shows, and whether its detail line does. */
export interface TagSight {
    shown: boolean;
    detail: boolean;
}

/** How her page sees a stand this frame. */
export interface TagView {
    /** Whether every tag hides: during a wave, and while her element pick
     *  holds the middle of the screen. */
    hidden: boolean;
    /** Metres from her feet to the stand. */
    metres: number;
    /** Degrees between the camera's forward and the tag. */
    degrees: number;
    /** Whether nothing stands between the camera and the tag. */
    clear: boolean;
}

/** The tag's sight this frame, from its sight the frame before. */
export function readTagSight(was: TagSight, view: TagView): TagSight {
    const { hidden, metres, degrees, clear } = view;
    const margin = was.shown ? edgeMetres : 0;
    const shown =
        !hidden &&
        clear &&
        metres < tagMetres + margin &&
        metres > promptMetres + (was.shown ? 0 : edgeMetres) &&
        degrees < tagDegrees + (was.shown ? edgeDegrees : 0);
    const detail =
        shown && metres < detailMetres + (was.detail ? edgeMetres : 0);
    return { shown, detail };
}

/** A point in the world, in metres. */
export interface Point {
    x: number;
    y: number;
    z: number;
}

/** A body's radius and height, in metres: a warden or a monster standing,
 *  round her gun and over her head. */
const bodyRadius = 0.45;
const bodyHeight = 2;

/** Whether one of `bodies`, each an upright capsule by its feet, stands
 *  across the line from `eye` to `tag`. The ground, the stones and the
 *  hearth are the physics world's to test. */
export function isSightBlocked(
    eye: Point,
    tag: Point,
    bodies: readonly Point[],
) {
    const dx = tag.x - eye.x;
    const dz = tag.z - eye.z;
    const length = dx * dx + dz * dz;
    for (const body of bodies) {
        const along =
            length === 0
                ? 0
                : ((body.x - eye.x) * dx + (body.z - eye.z) * dz) / length;
        //  Past either end of the line, a body stands behind the eye or the
        //  stand.
        if (along <= 0 || along >= 1) continue;
        const across = Math.hypot(
            eye.x + dx * along - body.x,
            eye.z + dz * along - body.z,
        );
        if (across > bodyRadius) continue;
        const height = eye.y + (tag.y - eye.y) * along - body.y;
        if (height >= 0 && height <= bodyHeight) return true;
    }
    return false;
}

/** Times its usual light a stand's shaft burns where her purse meets its
 *  price, as Black Ops 6 lights a wall buy's outline. */
const affordableGlow = 1.8;

/** How bright a stand's shaft burns: dark while the rack is shut, lit once
 *  it opens, and brighter where her purse meets its price. */
export function readShaftStrength({
    open,
    affordable,
}: {
    open: boolean;
    affordable: boolean;
}) {
    if (!open) return 0;
    return affordable ? affordableGlow : 1;
}
