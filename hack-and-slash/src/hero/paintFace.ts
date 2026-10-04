import { shade } from "../sprites/canvas";

//  Her face, painted on a canvas that wraps the front of her head: the
//  canvas's left is her right side, as a viewer facing her sees it. Clear
//  where her skin shows through. Each face is a recipe of eyes, brows, mouth
//  and blush; each eye takes its own colour, and her brows her hair's. The
//  eyes are a chibi's: big, glinting, and set low and wide.

export const faceCanvasWidth = 256;
export const faceCanvasHeight = 224;

/** How much bigger than the base sizes below the features are drawn. */
const k = 2.1;
/** Where the features sit on the canvas: her eyes a little below the
 *  middle of her head, her brows above, her mouth near her chin. */
const eyeY = 124;
const eyeApart = 60;
/** An eye's half-width and half-height at its base size. */
const eyeRx = 18;
const eyeRy = 23;
const browY = eyeY - eyeRy * k - 12;
const blushY = eyeY + eyeRy * k + 6;
const mouthY = 194;
const middle = faceCanvasWidth / 2;

const lash = "#1d1520";
const mouthColor = "#6a2a2e";
const blushColor = "#f28aa0";

type EyeShape = "open" | "narrow" | "sleepy" | "closed" | "wide";
type BrowShape = "soft" | "fierce" | "raised";
type MouthShape = "calm" | "smile" | "firm" | "o" | "wide-o" | "cat" | "flat";

/** A face as its parts: each eye (her right, then her left), her brows,
 *  her mouth, and whether she blushes. */
type FaceRecipe = {
    eyes: [EyeShape, EyeShape];
    brows: BrowShape;
    mouth: MouthShape;
    blush: boolean;
};

/** The faces the creator offers, in its order. */
export const faceRecipes: { name: string; recipe: FaceRecipe }[] = [
    {
        name: "Calm",
        recipe: {
            eyes: ["open", "open"],
            brows: "soft",
            mouth: "calm",
            blush: false,
        },
    },
    {
        name: "Smile",
        recipe: {
            eyes: ["open", "open"],
            brows: "soft",
            mouth: "smile",
            blush: true,
        },
    },
    {
        name: "Fierce",
        recipe: {
            eyes: ["narrow", "narrow"],
            brows: "fierce",
            mouth: "firm",
            blush: false,
        },
    },
    {
        name: "Blush",
        recipe: {
            eyes: ["open", "open"],
            brows: "soft",
            mouth: "o",
            blush: true,
        },
    },
    {
        name: "Sleepy",
        recipe: {
            eyes: ["sleepy", "sleepy"],
            brows: "soft",
            mouth: "flat",
            blush: false,
        },
    },
    {
        name: "Wink",
        recipe: {
            eyes: ["closed", "open"],
            brows: "raised",
            mouth: "smile",
            blush: true,
        },
    },
    {
        name: "Surprised",
        recipe: {
            eyes: ["wide", "wide"],
            brows: "raised",
            mouth: "wide-o",
            blush: false,
        },
    },
    {
        name: "Cat",
        recipe: {
            eyes: ["open", "open"],
            brows: "soft",
            mouth: "cat",
            blush: true,
        },
    },
];

/** The creator's face plates, after the painted faces: each a photograph
 *  of the plate straight on, baked by scripts/bake-faces.py to keep only
 *  what is drawn on its skin, so her own skin shows through. It is laid on
 *  her head from the front, as it was taken, so the face keeps the plate's
 *  own proportions. Its brows take her hair's colour; an eye drawn open
 *  takes hers, within `iris`, a box round it as shares of the photograph,
 *  with the side of her face it is. */
export const facePlates: {
    name: string;
    file: string;
    iris?: {
        x: number;
        y: number;
        width: number;
        height: number;
        eye: "left" | "right";
    };
}[] = [
    { name: "Joy", file: "joy" },
    { name: "Grin", file: "grin" },
    { name: "Gasp", file: "gasp" },
    {
        name: "Sly",
        file: "sly",
        //  Her right eye, on the photograph's left.
        iris: { x: 0.17, y: 0.39, width: 0.26, height: 0.33, eye: "right" },
    },
];

/** A plate's canvas, the photographs' size. */
export const plateCanvasWidth = 512;
export const plateCanvasHeight = 414;

/** The first plate's place among every face. */
export const firstPlate = faceRecipes.length;

/** Whether the face is one of the plates. */
export function isPlateFace(face: number) {
    return (
        face >= faceRecipes.length &&
        face < faceRecipes.length + facePlates.length
    );
}

/** The rows of a plate's photograph its brows lie between, as shares of
 *  its height. */
const plateBrows = [0.23, 0.41];

const plateImages = new Map<string, HTMLImageElement>();

/** A plate's image, loading once; every plate starts loading as the game
 *  does, so one is ready by the time it is chosen. */
function plateImage(file: string) {
    let image = plateImages.get(file);
    if (!image) {
        image = new Image();
        image.src = `${import.meta.env.BASE_URL}models/faces/${file}.png`;
        plateImages.set(file, image);
    }
    return image;
}
for (const plate of facePlates) plateImage(plate.file);

export type FaceLook = {
    face: number;
    hair: string;
    leftEye: string;
    rightEye: string;
};

function ellipse(
    paint: CanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    ry: number,
    color: string | CanvasGradient,
) {
    paint.fillStyle = color;
    paint.beginPath();
    paint.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    paint.fill();
}

/** One big chibi eye at (x, y): white, the iris in `color` shaded darker at
 *  the top, a pupil, two glints and a heavy upper lash; `wide` for a
 *  startled one, a smaller iris ringed with white. `outward` is -1 for the
 *  eye on the canvas's left, so the lash's wing points away from the nose. */
function eye(
    paint: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    outward: number,
    wide: boolean,
) {
    const rx = eyeRx * k;
    const ry = eyeRy * k;
    ellipse(paint, x, y, rx, ry, "#ffffff");
    const iris = paint.createLinearGradient(0, y - ry, 0, y + ry);
    iris.addColorStop(0, shade(color, -0.55));
    iris.addColorStop(0.45, color);
    iris.addColorStop(1, shade(color, 0.3));
    const size = wide ? 0.7 : 1;
    ellipse(paint, x, y + 2 * k, 14 * k * size, 19.5 * k * size, iris);
    ellipse(
        paint,
        x,
        y + 1.5 * k,
        6.5 * k * size * size,
        9 * k * size * size,
        shade(color, -0.75),
    );
    ellipse(paint, x - 5 * k, y - 7 * k, 5 * k, 5.5 * k, "#ffffff");
    ellipse(paint, x + 5 * k, y + 9 * k, 2.2 * k, 2.2 * k, "#ffffff");
    //  The upper lash, and its wing.
    paint.strokeStyle = lash;
    paint.lineCap = "round";
    paint.lineWidth = 6 * k;
    paint.beginPath();
    paint.ellipse(x, y + 2 * k, rx + k, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
    paint.stroke();
    paint.lineWidth = 4 * k;
    paint.beginPath();
    paint.moveTo(x + outward * 17 * k, y - 10 * k);
    paint.lineTo(x + outward * 25 * k, y - 16 * k);
    paint.stroke();
}

/** Cuts the top of an eye away along a slope down toward the nose, for a
 *  narrowed, fierce look; or level across its middle, for a sleepy one.
 *  `inward` points toward her nose. */
function lid(
    paint: CanvasRenderingContext2D,
    x: number,
    inward: number,
    sleepy: boolean,
) {
    const nose = sleepy ? eyeY - 2 * k : eyeY - 8 * k;
    const temple = sleepy ? eyeY - 2 * k : eyeY - 30 * k;
    const top = eyeY - 42 * k;
    paint.save();
    paint.globalCompositeOperation = "destination-out";
    paint.beginPath();
    paint.moveTo(x + inward * 26 * k, nose);
    paint.lineTo(x - inward * 28 * k, temple);
    paint.lineTo(x - inward * 28 * k, top);
    paint.lineTo(x + inward * 26 * k, top);
    paint.closePath();
    paint.fill();
    paint.restore();
    paint.strokeStyle = lash;
    paint.lineWidth = 5 * k;
    paint.lineCap = "round";
    paint.beginPath();
    paint.moveTo(x + inward * 18 * k, nose - 1);
    paint.lineTo(x - inward * 20 * k, sleepy ? temple - 1 : temple + 4 * k);
    paint.stroke();
}

/** A closed eye: a lash curved up, as in a happy squint or a wink. */
function closedEye(paint: CanvasRenderingContext2D, x: number) {
    paint.strokeStyle = lash;
    paint.lineWidth = 5 * k;
    paint.lineCap = "round";
    paint.beginPath();
    paint.moveTo(x - 16 * k, eyeY + 4 * k);
    paint.quadraticCurveTo(x, eyeY - 14 * k, x + 16 * k, eyeY + 4 * k);
    paint.stroke();
}

function brow(
    paint: CanvasRenderingContext2D,
    x: number,
    color: string,
    outward: number,
    shape: BrowShape,
) {
    paint.strokeStyle = shade(color, -0.25);
    paint.lineWidth = 5 * k;
    paint.lineCap = "round";
    paint.beginPath();
    if (shape === "fierce") {
        //  Down toward the nose.
        paint.moveTo(x - outward * 14 * k, browY + 10 * k);
        paint.lineTo(x + outward * 16 * k, browY - 3 * k);
    } else {
        const raise = shape === "raised" ? -8 * k : 0;
        paint.moveTo(x - outward * 14 * k, browY + 2 * k + raise);
        paint.quadraticCurveTo(
            x,
            browY - 6 * k + raise,
            x + outward * 16 * k,
            browY + k + raise,
        );
    }
    paint.stroke();
}

function blush(paint: CanvasRenderingContext2D, x: number) {
    paint.strokeStyle = blushColor;
    paint.lineWidth = 3 * k;
    paint.lineCap = "round";
    for (let line = 0; line < 3; line++) {
        const lineX = x + (line - 1) * 8 * k;
        paint.beginPath();
        paint.moveTo(lineX + 3 * k, blushY - 4 * k);
        paint.lineTo(lineX - 3 * k, blushY + 4 * k);
        paint.stroke();
    }
}

function mouth(paint: CanvasRenderingContext2D, shape: MouthShape) {
    const m = k * 0.9;
    paint.strokeStyle = mouthColor;
    paint.fillStyle = mouthColor;
    paint.lineWidth = 4 * m;
    paint.lineCap = "round";
    paint.beginPath();
    switch (shape) {
        case "smile":
            //  A wide smile, a little open.
            paint.moveTo(middle - 14 * m, mouthY - 3 * m);
            paint.quadraticCurveTo(
                middle,
                mouthY + 12 * m,
                middle + 14 * m,
                mouthY - 3 * m,
            );
            paint.closePath();
            paint.fill();
            return;
        case "firm":
            //  Set firm, with a fang.
            paint.moveTo(middle - 10 * m, mouthY + 2 * m);
            paint.lineTo(middle + 10 * m, mouthY - m);
            paint.stroke();
            paint.fillStyle = "#ffffff";
            paint.beginPath();
            paint.moveTo(middle + 3 * m, mouthY);
            paint.lineTo(middle + 8 * m, mouthY - m);
            paint.lineTo(middle + 6 * m, mouthY + 6 * m);
            paint.fill();
            return;
        case "o":
            paint.lineWidth = 3 * m;
            paint.ellipse(middle, mouthY, 5 * m, 6 * m, 0, 0, Math.PI * 2);
            paint.stroke();
            return;
        case "wide-o":
            paint.ellipse(
                middle,
                mouthY + 2 * m,
                8 * m,
                11 * m,
                0,
                0,
                Math.PI * 2,
            );
            paint.fill();
            return;
        case "cat":
            //  An ω, its corners up.
            paint.moveTo(middle - 14 * m, mouthY - 4 * m);
            paint.quadraticCurveTo(
                middle - 7 * m,
                mouthY + 8 * m,
                middle,
                mouthY - m,
            );
            paint.quadraticCurveTo(
                middle + 7 * m,
                mouthY + 8 * m,
                middle + 14 * m,
                mouthY - 4 * m,
            );
            paint.stroke();
            return;
        case "flat":
            paint.moveTo(middle - 7 * m, mouthY + m);
            paint.lineTo(middle + 7 * m, mouthY + m);
            paint.stroke();
            return;
        case "calm":
            //  A small, soft smile.
            paint.moveTo(middle - 8 * m, mouthY);
            paint.quadraticCurveTo(
                middle,
                mouthY + 5 * m,
                middle + 8 * m,
                mouthY,
            );
            paint.stroke();
            return;
    }
}

/** A colour's channels, 0 to 255, and its lightness, 0 to 1. */
function channels(hex: string): [number, number, number] {
    return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [
        number,
        number,
        number,
    ];
}
const lightness = (r: number, g: number, b: number) =>
    (Math.max(r, g, b) + Math.min(r, g, b)) / 510;

/** Paints a plate face onto `canvas`, the plate canvas, its brows in her
 *  hair's colour and its open eye in hers, each at its own light and
 *  shade. A plate not yet loaded paints nothing and calls `whenLoaded` once
 *  it is, to be painted again. */
export function paintPlate(
    canvas: HTMLCanvasElement,
    look: FaceLook,
    whenLoaded?: () => void,
) {
    const paint = canvas.getContext("2d", { willReadFrequently: true })!;
    paint.clearRect(0, 0, canvas.width, canvas.height);
    const plate = facePlates[look.face - faceRecipes.length];
    if (!plate) return;
    const image = plateImage(plate.file);
    if (!image.complete || image.naturalWidth === 0) {
        image.addEventListener("load", () => whenLoaded?.(), { once: true });
        return;
    }
    const width = canvas.width;
    const height = canvas.height;
    paint.drawImage(image, 0, 0, width, height);
    const recolour = (
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
        takes: (r: number, g: number, b: number) => boolean,
    ) => {
        const area = paint.getImageData(x, y, width, height);
        const [toR, toG, toB] = channels(color);
        const toLight = Math.max(0.05, lightness(toR, toG, toB));
        const pixels = area.data;
        for (let at = 0; at < pixels.length; at += 4) {
            if (pixels[at + 3] < 30) continue;
            const [r, g, b] = [pixels[at], pixels[at + 1], pixels[at + 2]];
            if (!takes(r, g, b)) continue;
            //  Her colour, as light or dark as the stroke was drawn.
            const by = Math.min(2.2, lightness(r, g, b) / toLight);
            pixels[at] = Math.min(255, toR * by);
            pixels[at + 1] = Math.min(255, toG * by);
            pixels[at + 2] = Math.min(255, toB * by);
        }
        paint.putImageData(area, x, y);
    };
    //  The brows: the dark strokes over her eyes.
    recolour(
        0,
        Math.round(plateBrows[0] * height),
        width,
        Math.round((plateBrows[1] - plateBrows[0]) * height),
        shade(look.hair, -0.25),
        (r, g, b) => lightness(r, g, b) < 0.55,
    );
    const iris = plate.iris;
    if (iris)
        recolour(
            Math.round(iris.x * width),
            Math.round(iris.y * height),
            Math.round(iris.width * width),
            Math.round(iris.height * height),
            iris.eye === "right" ? look.rightEye : look.leftEye,
            //  Coloured, neither the white nor the dark of the eye.
            (r, g, b) => {
                const light = lightness(r, g, b);
                const spread = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
                return spread > 0.12 && light > 0.2 && light < 0.9;
            },
        );
}

/** Paints her painted face for `look` onto `canvas`, replacing what was
 *  there: nothing for a plate face, which lies on a canvas of its own. */
export function paintFace(canvas: HTMLCanvasElement, look: FaceLook) {
    const paint = canvas.getContext("2d")!;
    paint.clearRect(0, 0, canvas.width, canvas.height);
    if (isPlateFace(look.face)) return;
    const { recipe } = faceRecipes[look.face] ?? faceRecipes[0];
    //  Her right eye is on the canvas's left.
    const sides: [number, string, number, EyeShape][] = [
        [middle - eyeApart, look.rightEye, -1, recipe.eyes[0]],
        [middle + eyeApart, look.leftEye, 1, recipe.eyes[1]],
    ];
    for (const [x, color, outward, shape] of sides) {
        if (shape === "closed") closedEye(paint, x);
        else {
            eye(paint, x, eyeY, color, outward, shape === "wide");
            if (shape === "narrow") lid(paint, x, -outward, false);
            if (shape === "sleepy") lid(paint, x, -outward, true);
        }
        brow(paint, x, look.hair, outward, recipe.brows);
        if (recipe.blush) blush(paint, x + outward * 10 * k);
    }
    mouth(paint, recipe.mouth);
}
