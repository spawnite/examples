import { CanvasTexture, NearestFilter, SRGBColorSpace } from "three";
import soldierUrl from "../assets/soldier.png?url";

//  The soldier's pixel sprite, 32 by 52, and its colour variants: each look
//  turns it round the colour wheel, a hit washes it pale, and the Prismatic
//  look cycles twelve steps of hue. The source filtered a canvas with CSS;
//  the same matrices run on the pixels here, since Safari's canvas takes no
//  filter.

export const soldierWidth = 32;
export const soldierHeight = 52;

/** A 3 by 3 colour matrix, row by row. */
type ColorMatrix = readonly number[];

function hueRotate(degrees: number): ColorMatrix {
    const angle = (degrees * Math.PI) / 180;
    const a = Math.cos(angle);
    const b = Math.sin(angle);
    return [
        0.213 + 0.787 * a - 0.213 * b,
        0.715 - 0.715 * a - 0.715 * b,
        0.072 - 0.072 * a + 0.928 * b,
        0.213 - 0.213 * a + 0.143 * b,
        0.715 + 0.285 * a + 0.14 * b,
        0.072 - 0.072 * a - 0.283 * b,
        0.213 - 0.213 * a - 0.787 * b,
        0.715 - 0.715 * a + 0.715 * b,
        0.072 + 0.928 * a + 0.072 * b,
    ];
}

function saturate(amount: number): ColorMatrix {
    return [
        0.213 + 0.787 * amount,
        0.715 - 0.715 * amount,
        0.072 - 0.072 * amount,
        0.213 - 0.213 * amount,
        0.715 + 0.285 * amount,
        0.072 - 0.072 * amount,
        0.213 - 0.213 * amount,
        0.715 - 0.715 * amount,
        0.072 + 0.928 * amount,
    ];
}

function brightness(amount: number): ColorMatrix {
    return [amount, 0, 0, 0, amount, 0, 0, 0, amount];
}

/** `second` applied after `first`. */
function chain(first: ColorMatrix, second: ColorMatrix): ColorMatrix {
    const result: number[] = [];
    for (let row = 0; row < 3; row++)
        for (let column = 0; column < 3; column++) {
            let sum = 0;
            for (let inner = 0; inner < 3; inner++)
                sum += second[row * 3 + inner] * first[inner * 3 + column];
            result.push(sum);
        }
    return result;
}

/** The matrix for a look's hue: the source's `hue-rotate(h) saturate(1.15)
 *  brightness(1.18)`. */
export function lookMatrix(hue: number) {
    return chain(chain(hueRotate(hue), saturate(1.15)), brightness(1.18));
}

/** The source's hit flash: `brightness(1.7) saturate(0.3)`. */
export const hitMatrix = chain(brightness(1.7), saturate(0.3));

let soldierPixels: Promise<ImageData> | undefined;

/** The soldier's pixels, loaded once. */
export function loadSoldierPixels() {
    soldierPixels ??= new Promise<ImageData>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = soldierWidth;
            canvas.height = soldierHeight;
            const context = canvas.getContext("2d")!;
            context.drawImage(image, 0, 0);
            resolve(context.getImageData(0, 0, soldierWidth, soldierHeight));
        };
        image.onerror = () =>
            reject(new Error(`The soldier sprite did not load: ${soldierUrl}`));
        image.src = soldierUrl;
    });
    return soldierPixels;
}

const variants = new Map<string, CanvasTexture>();

/** The soldier drawn through `matrix`, as a crisp texture, kept by `key`. */
export function readSoldierTexture(
    pixels: ImageData,
    key: string,
    matrix: ColorMatrix,
) {
    const kept = variants.get(key);
    if (kept) return kept;
    const canvas = document.createElement("canvas");
    canvas.width = soldierWidth;
    canvas.height = soldierHeight;
    const context = canvas.getContext("2d")!;
    const out = context.createImageData(soldierWidth, soldierHeight);
    const source = pixels.data;
    for (let index = 0; index < source.length; index += 4) {
        const red = source[index];
        const green = source[index + 1];
        const blue = source[index + 2];
        out.data[index] =
            matrix[0] * red + matrix[1] * green + matrix[2] * blue;
        out.data[index + 1] =
            matrix[3] * red + matrix[4] * green + matrix[5] * blue;
        out.data[index + 2] =
            matrix[6] * red + matrix[7] * green + matrix[8] * blue;
        out.data[index + 3] = source[index + 3];
    }
    context.putImageData(out, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.colorSpace = SRGBColorSpace;
    variants.set(key, texture);
    return texture;
}
