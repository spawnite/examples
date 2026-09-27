import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

//  The soft white shapes every flash, spark and puff draws with: a radial
//  falloff, a star of rays over it for a muzzle's flash, a ring, a puff of
//  dust and a rift's jagged tear, and the dark falloff a monster's shadow
//  draws with. Drawn once on a canvas, so the game downloads no sprite.

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

let glow: Texture | undefined;
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
