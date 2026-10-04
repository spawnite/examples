import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

//  The soft white shapes every flash, spark and puff draws with: a radial
//  falloff, a star of rays over it for a muzzle's flash, a ring, a puff of
//  dust, a rift's jagged tear, a line of lightning, and the dark falloff a
//  monster's shadow draws with, and frost on the ground; and two in
//  colour, a tongue of flame and a scorch on the ground. Drawn once on a canvas, so the game downloads no
//  sprite.

/** Pixels across each texture. */
const size = 128;

function paintTexture(paint: (context: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context) paint(context);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

function paintGlow(context: CanvasRenderingContext2D) {
    const middle = size / 2;
    const falloff = context.createRadialGradient(
        middle,
        middle,
        0,
        middle,
        middle,
        middle,
    );
    falloff.addColorStop(0, "rgba(255,255,255,1)");
    falloff.addColorStop(0.25, "rgba(255,255,255,0.8)");
    falloff.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = falloff;
    context.fillRect(0, 0, size, size);
}

/** Rays of a star: each a thin lens from the middle to the rim. */
const rayCount = 6;

function paintStar(context: CanvasRenderingContext2D) {
    paintGlow(context);
    const middle = size / 2;
    context.translate(middle, middle);
    context.fillStyle = "rgba(255,255,255,0.9)";
    for (let ray = 0; ray < rayCount; ray++) {
        context.rotate((Math.PI * 2) / rayCount);
        const reach = middle * (ray % 2 === 0 ? 0.98 : 0.6);
        context.beginPath();
        context.moveTo(0, -4);
        context.quadraticCurveTo(reach * 0.5, -2, reach, 0);
        context.quadraticCurveTo(reach * 0.5, 2, 0, 4);
        context.fill();
    }
}

/** A soft ring, bright at its middle radius and clear inside and out: a
 *  pickup's pop. */
function paintRing(context: CanvasRenderingContext2D) {
    const middle = size / 2;
    const band = context.createRadialGradient(
        middle,
        middle,
        middle * 0.55,
        middle,
        middle,
        middle,
    );
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.55, "rgba(255,255,255,1)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = band;
    context.fillRect(0, 0, size, size);
}

/** A puff of dust: a few soft blobs overlapping, so it reads as smoke and
 *  not a disc. Fixed offsets, so every page draws the same puff. */
const puffBlobs = [
    [0, 0, 0.5],
    [-0.22, 0.1, 0.34],
    [0.2, 0.14, 0.32],
    [0.05, -0.2, 0.3],
    [-0.12, -0.12, 0.28],
];

function paintPuff(context: CanvasRenderingContext2D) {
    const middle = size / 2;
    for (const [x, y, radius] of puffBlobs) {
        const centerX = middle + x * size;
        const centerY = middle + y * size;
        const reach = radius * size;
        const blob = context.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            reach,
        );
        blob.addColorStop(0, "rgba(255,255,255,0.55)");
        blob.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = blob;
        context.fillRect(0, 0, size, size);
    }
}

/** The points of a rift's tear, across the canvas from left to right, as
 *  fractions of its size: jagged, and widest in the middle. */
const tearPoints = [
    [0.04, 0.5],
    [0.15, 0.38],
    [0.26, 0.62],
    [0.38, 0.3],
    [0.5, 0.68],
    [0.62, 0.32],
    [0.74, 0.64],
    [0.85, 0.4],
    [0.96, 0.54],
];

function paintTear(context: CanvasRenderingContext2D) {
    context.lineJoin = "miter";
    context.lineCap = "round";
    context.strokeStyle = "rgba(255,255,255,1)";
    context.shadowColor = "rgba(255,255,255,1)";
    //  A wide soft pass for the glow, then the thin hot edge over it.
    for (const [width, blur] of [
        [14, 20],
        [5, 6],
    ]) {
        context.lineWidth = width;
        context.shadowBlur = blur;
        context.beginPath();
        for (const [x, y] of tearPoints) context.lineTo(x * size, y * size);
        context.stroke();
    }
}

/** A soft dark patch: black, fading out from a dense middle. */
function paintShadow(context: CanvasRenderingContext2D) {
    const middle = size / 2;
    const falloff = context.createRadialGradient(
        middle,
        middle,
        0,
        middle,
        middle,
        middle,
    );
    falloff.addColorStop(0, "rgba(0,0,0,1)");
    falloff.addColorStop(0.45, "rgba(0,0,0,0.7)");
    falloff.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = falloff;
    context.fillRect(0, 0, size, size);
}

/** A line of light: bright down its middle and soft to either side, even
 *  along its length, so a bolt drawn in lengths joins without a seam. */
function paintStreak(context: CanvasRenderingContext2D) {
    const falloff = context.createLinearGradient(0, 0, size, 0);
    falloff.addColorStop(0, "rgba(255,255,255,0)");
    falloff.addColorStop(0.3, "rgba(255,255,255,0.35)");
    falloff.addColorStop(0.46, "rgba(255,255,255,1)");
    falloff.addColorStop(0.54, "rgba(255,255,255,1)");
    falloff.addColorStop(0.7, "rgba(255,255,255,0.35)");
    falloff.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = falloff;
    context.fillRect(0, 0, size, size);
}

/** A tongue of flame to trace: `halfWidth` to each side at its widest, a
 *  little above its round foot on `baseY`, `height` tall, its middle
 *  `across` from the canvas's, and its tip leaning `lean` times its
 *  half width to the right. */
interface Tongue {
    halfWidth: number;
    baseY: number;
    height: number;
    across: number;
    lean: number;
}

function traceTongue(
    context: CanvasRenderingContext2D,
    { halfWidth, baseY, height, across, lean }: Tongue,
) {
    const middle = size / 2 + across;
    const tip = baseY - height;
    const tipX = middle + halfWidth * lean;
    //  The upper curve bends toward the tip, so a leaning tongue curls.
    const right = (share: number, bend = 0) =>
        middle + halfWidth * (share + lean * bend);
    const left = (share: number, bend = 0) =>
        middle - halfWidth * (share - lean * bend);
    context.beginPath();
    context.moveTo(tipX, tip);
    context.bezierCurveTo(
        right(0.2, 0.8),
        tip + height * 0.3,
        right(1.05, 0.3),
        tip + height * 0.5,
        right(0.95),
        baseY - height * 0.2,
    );
    context.bezierCurveTo(
        right(0.85),
        baseY,
        right(0.3),
        baseY + height * 0.04,
        middle,
        baseY + height * 0.04,
    );
    context.bezierCurveTo(
        left(0.3),
        baseY + height * 0.04,
        left(0.85),
        baseY,
        left(0.95),
        baseY - height * 0.2,
    );
    context.bezierCurveTo(
        left(1.05, 0.3),
        tip + height * 0.5,
        left(0.2, 0.8),
        tip + height * 0.3,
        tipX,
        tip,
    );
    context.closePath();
}

/** A flame's layers, outside in: a red edge, an orange body, a yellow core
 *  and a white-yellow heart low in it, each as a share of the canvas. */
const flameLayers = [
    { half: 0.36, height: 0.92, color: "rgba(200,40,10,0.95)", blur: 3 },
    { half: 0.27, height: 0.56, color: "rgba(255,90,24,0.95)", blur: 3 },
    { half: 0.17, height: 0.4, color: "rgba(255,168,64,1)", blur: 2 },
    { half: 0.09, height: 0.24, color: "rgba(255,244,200,1)", blur: 2 },
];

/** The shapes a burn's tongues take, so no two on a monster match: each
 *  a list of tongues drawn together, as shares of the canvas, with its
 *  lean. A tall one whose tip splits in two, one curling left, and a
 *  shorter, wider one curling right. */
export enum FlameShape {
    Split = "split",
    Left = "left",
    Right = "right",
}

const flameShapes: Record<
    FlameShape,
    { across: number; height: number; width: number; lean: number }[]
> = {
    [FlameShape.Split]: [
        { across: -0.08, height: 0.95, width: 0.72, lean: -0.35 },
        { across: 0.1, height: 0.78, width: 0.6, lean: 0.4 },
    ],
    [FlameShape.Left]: [{ across: 0.04, height: 0.92, width: 0.9, lean: -0.6 }],
    [FlameShape.Right]: [
        { across: -0.04, height: 0.8, width: 1.05, lean: 0.55 },
    ],
};

/** A burn's tongue of flame in one of its shapes, painted in its own
 *  colours rather than white, since a flame's colour runs through it: each
 *  layer, red edge to white-yellow heart, over every tongue of the shape.
 *  Drawn added over the scene, so its dark red tips fade into what is
 *  behind. */
function paintFlame(context: CanvasRenderingContext2D, shape: FlameShape) {
    for (const layer of flameLayers) {
        context.filter = `blur(${layer.blur}px)`;
        context.fillStyle = layer.color;
        for (const tongue of flameShapes[shape]) {
            traceTongue(context, {
                halfWidth: layer.half * size * tongue.width,
                baseY: size * 0.94,
                height: layer.height * size * tongue.height,
                across: tongue.across * size,
                lean: tongue.lean,
            });
            context.fill();
        }
    }
    context.filter = "none";
}

/** A scorch's blots, as fractions of the canvas from its middle: a dense
 *  middle and ragged arms. Fixed, so every page draws the same scorch. */
const scorchBlots = [
    [0, 0, 0.36],
    [-0.2, 0.08, 0.24],
    [0.18, 0.12, 0.22],
    [0.06, -0.2, 0.2],
    [-0.14, -0.14, 0.18],
    [0.34, -0.06, 0.12],
    [-0.38, -0.02, 0.1],
    [0.1, 0.36, 0.12],
    [-0.08, 0.42, 0.07],
    [0.3, 0.3, 0.08],
    [-0.32, 0.28, 0.07],
    [0.4, -0.3, 0.06],
    [-0.22, -0.4, 0.07],
    [0.44, 0.1, 0.05],
    [-0.44, 0.12, 0.05],
];

/** Embers left glowing in a scorch, as fractions of the canvas: fixed, so
 *  every page draws the same scorch. */
const scorchFlecks = [
    [0.41, 0.44, 0.02],
    [0.63, 0.34, 0.012],
    [0.55, 0.66, 0.016],
    [0.28, 0.6, 0.01],
    [0.71, 0.57, 0.014],
    [0.47, 0.24, 0.008],
    [0.36, 0.72, 0.009],
    [0.58, 0.48, 0.011],
];

/** A scorch on the ground: a dark, ragged blot, densest in its middle, with
 *  a few flecks of ember orange. Drawn over the ground, not added to it. */
function paintScorch(context: CanvasRenderingContext2D) {
    const middle = size / 2;
    for (const [x, y, radius] of scorchBlots) {
        const centerX = middle + x * size * 0.8;
        const centerY = middle + y * size * 0.8;
        const blot = context.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            radius * size * 1.15,
        );
        blot.addColorStop(0, "rgba(12,8,6,0.9)");
        blot.addColorStop(0.6, "rgba(18,12,9,0.6)");
        blot.addColorStop(1, "rgba(24,16,12,0)");
        context.fillStyle = blot;
        context.fillRect(0, 0, size, size);
    }
    //  Ash at its edge, lighter than the char, so the scorch reads on dark
    //  ground as well as on stone.
    const ash = context.createRadialGradient(
        middle,
        middle,
        middle * 0.55,
        middle,
        middle,
        middle * 0.95,
    );
    ash.addColorStop(0, "rgba(90,80,72,0)");
    ash.addColorStop(0.5, "rgba(90,80,72,0.35)");
    ash.addColorStop(1, "rgba(90,80,72,0)");
    context.fillStyle = ash;
    context.fillRect(0, 0, size, size);
    for (const [x, y, radius] of scorchFlecks) {
        const fleck = context.createRadialGradient(
            x * size,
            y * size,
            0,
            x * size,
            y * size,
            radius * size,
        );
        fleck.addColorStop(0, "rgba(255,120,40,0.9)");
        fleck.addColorStop(1, "rgba(120,30,10,0)");
        context.fillStyle = fleck;
        context.fillRect(0, 0, size, size);
    }
}

/** Spikes of hoarfrost from a patch's middle: each its turn, as a share
 *  of a full turn, and its reach, as a share of the canvas's half. Fixed,
 *  so every page draws the same frost. */
const frostSpikes = [
    [0, 0.95],
    [0.07, 0.62],
    [0.13, 0.88],
    [0.21, 0.7],
    [0.27, 0.97],
    [0.34, 0.58],
    [0.41, 0.84],
    [0.48, 0.66],
    [0.55, 0.93],
    [0.62, 0.6],
    [0.69, 0.86],
    [0.76, 0.72],
    [0.83, 0.96],
    [0.9, 0.64],
];

/** Frost on the ground: a faint pale patch, and spikes of hoarfrost from
 *  its middle, each with a pair of short barbs, bright at their roots. */
function paintFrost(context: CanvasRenderingContext2D) {
    const middle = size / 2;
    const patch = context.createRadialGradient(
        middle,
        middle,
        0,
        middle,
        middle,
        middle,
    );
    patch.addColorStop(0, "rgba(255,255,255,0.14)");
    patch.addColorStop(0.6, "rgba(255,255,255,0.06)");
    patch.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = patch;
    context.fillRect(0, 0, size, size);
    context.translate(middle, middle);
    context.lineCap = "round";
    context.shadowColor = "rgba(255,255,255,0.9)";
    context.shadowBlur = 3;
    for (const [turn, reach] of frostSpikes) {
        const length = reach * middle * 0.95;
        context.save();
        context.rotate(turn * Math.PI * 2);
        const spike = context.createLinearGradient(0, 0, length, 0);
        spike.addColorStop(0, "rgba(255,255,255,0.95)");
        spike.addColorStop(1, "rgba(255,255,255,0)");
        context.strokeStyle = spike;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(middle * 0.1, 0);
        context.lineTo(length, 0);
        for (const at of [0.45, 0.7]) {
            const barb = length * (0.28 - at * 0.15);
            context.moveTo(length * at, 0);
            context.lineTo(length * at + barb * 0.7, -barb * 0.7);
            context.moveTo(length * at, 0);
            context.lineTo(length * at + barb * 0.7, barb * 0.7);
        }
        context.stroke();
        context.restore();
    }
}

/** A sparkle: a pinpoint with four thin rays, the long pair upright and
 *  across and the short pair on the diagonals, each fading to its tip. No
 *  soft glow round it, so a sparkle stays a point of light. */
function paintSparkle(context: CanvasRenderingContext2D) {
    const middle = size / 2;
    context.translate(middle, middle);
    for (const [turn, reach, width] of [
        [0, 0.98, 8],
        [0.25, 0.98, 8],
        [0.125, 0.55, 5],
        [0.375, 0.55, 5],
    ]) {
        context.save();
        context.rotate(turn * Math.PI * 2);
        const ray = context.createLinearGradient(
            -middle * reach,
            0,
            middle * reach,
            0,
        );
        ray.addColorStop(0, "rgba(255,255,255,0)");
        ray.addColorStop(0.5, "rgba(255,255,255,1)");
        ray.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = ray;
        context.fillRect(
            -middle * reach,
            -width / 2,
            middle * reach * 2,
            width,
        );
        context.restore();
    }
    const core = context.createRadialGradient(0, 0, 0, 0, 0, middle * 0.3);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = core;
    context.fillRect(-middle, -middle, size, size);
}

let glow: Texture | undefined;
let sparkle: Texture | undefined;
let frost: Texture | undefined;
const flames: Partial<Record<FlameShape, Texture>> = {};
let scorch: Texture | undefined;
let streak: Texture | undefined;
let star: Texture | undefined;
let ring: Texture | undefined;
let puff: Texture | undefined;
let tear: Texture | undefined;
let shadow: Texture | undefined;

/** The round glow, made on first use: a module a test imports draws
 *  nothing until a view asks. */
export function readGlowTexture() {
    glow ??= paintTexture(paintGlow);
    return glow;
}

export function readStreakTexture() {
    streak ??= paintTexture(paintStreak);
    return streak;
}

export function readStarTexture() {
    star ??= paintTexture(paintStar);
    return star;
}

export function readRingTexture() {
    ring ??= paintTexture(paintRing);
    return ring;
}

export function readPuffTexture() {
    puff ??= paintTexture(paintPuff);
    return puff;
}

export function readTearTexture() {
    tear ??= paintTexture(paintTear);
    return tear;
}

export function readShadowTexture() {
    shadow ??= paintTexture(paintShadow);
    return shadow;
}

/** A tongue of flame in `shape`: a lick of flame, which rises and goes
 *  out, takes the tall split one. */
export function readFlameTexture(shape = FlameShape.Split) {
    flames[shape] ??= paintTexture((context) => paintFlame(context, shape));
    return flames[shape];
}

export function readScorchTexture() {
    scorch ??= paintTexture(paintScorch);
    return scorch;
}

export function readFrostTexture() {
    frost ??= paintTexture(paintFrost);
    return frost;
}

export function readSparkleTexture() {
    sparkle ??= paintTexture(paintSparkle);
    return sparkle;
}
