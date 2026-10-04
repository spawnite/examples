import {
    CanvasTexture,
    Color,
    NearestFilter,
    SRGBColorSpace,
} from "@spawnite/engine/three";

//  Pixel art painted on a canvas at runtime: every sprite in the game is
//  drawn here from shapes and colours rather than loaded from a file, so a
//  colour a player picks repaints it.

export type Paint = CanvasRenderingContext2D;

/** A canvas `width` by `height` pixels, painted by `draw`, as a texture that
 *  keeps its pixels sharp when scaled up. */
export function paintTexture(
    width: number,
    height: number,
    draw: (paint: Paint) => void,
) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const paint = canvas.getContext("2d")!;
    paint.imageSmoothingEnabled = false;
    draw(paint);
    const texture = new CanvasTexture(canvas);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    return texture;
}

export function pixel(paint: Paint, x: number, y: number, color: string) {
    paint.fillStyle = color;
    paint.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function rect(
    paint: Paint,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
) {
    paint.fillStyle = color;
    paint.fillRect(Math.round(x), Math.round(y), width, height);
}

/** Fills the pixels inside an ellipse centred on (cx, cy). */
export function ellipse(
    paint: Paint,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: string,
) {
    paint.fillStyle = color;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x + 0.5 - cx) / rx;
            const dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) paint.fillRect(x, y, 1, 1);
        }
    }
}

/** Draws a one-pixel dark edge round everything painted so far, so a
 *  sprite reads over bright grass and dark ground alike. */
export function outline(paint: Paint, color: string) {
    const { width, height } = paint.canvas;
    const { data } = paint.getImageData(0, 0, width, height);
    const solid = (x: number, y: number) =>
        x >= 0 &&
        y >= 0 &&
        x < width &&
        y < height &&
        data[(y * width + x) * 4 + 3] > 0;
    paint.fillStyle = color;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (solid(x, y)) continue;
            if (
                solid(x - 1, y) ||
                solid(x + 1, y) ||
                solid(x, y - 1) ||
                solid(x, y + 1)
            )
                paint.fillRect(x, y, 1, 1);
        }
    }
}

const mixed = new Color();

/** `color` moved toward black (negative) or white (positive) by `amount`,
 *  0 to 1, as a CSS colour: the shades of one hue a sprite is lit with. */
export function shade(color: string, amount: number) {
    mixed.set(color);
    if (amount < 0) mixed.lerp(new Color("#000000"), -amount);
    else mixed.lerp(new Color("#ffffff"), amount);
    return `#${mixed.getHexString()}`;
}
