import {
    ellipse,
    outline,
    paintTexture,
    pixel,
    rect,
    shade,
    type Paint,
} from "../sprites/canvas";
import {
    SRGBColorSpace,
    TextureLoader,
    type Texture,
} from "@spawnite/engine/three";
import type { ArmorSet, EquipSlot, ItemId } from "./items";

//  An item's picture on the ground, its photograph; and each empty slot's
//  faint outline and the gold's coins, 16 pixels square, painted.

export const iconPixels = 16;

/** A line of pixels from (x0, y0) to (x1, y1), `width` pixels thick. */
export function line(
    paint: Paint,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    width = 1,
) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let step = 0; step <= steps; step++) {
        const x = x0 + ((x1 - x0) * step) / steps;
        const y = y0 + ((y1 - y0) * step) / steps;
        rect(paint, x, y, width, width, color);
    }
}

function paintSword(paint: Paint, [blade, hilt]: [string, string]) {
    line(paint, 5, 10, 13, 2, blade, 2);
    line(paint, 6, 10, 13, 3, shade(blade, 0.45));
    line(paint, 3, 8, 7, 12, shade(hilt, 0.2), 1);
    line(paint, 3, 12, 5, 10, hilt, 2);
    pixel(paint, 2, 13, shade(hilt, 0.4));
}

function paintShield(paint: Paint, [face, rim]: [string, string]) {
    ellipse(paint, 8, 8, 6.5, 7, rim);
    ellipse(paint, 8, 8, 5, 5.5, face);
    rect(paint, 7, 3, 2, 10, shade(face, -0.2));
    ellipse(paint, 8, 8, 1.6, 1.6, shade(rim, 0.3));
    pixel(paint, 5, 4, shade(face, 0.4));
}

function paintHead(
    paint: Paint,
    shape: "cap" | "helm" | "hat" | "headset",
    [main, trim]: [string, string],
) {
    if (shape === "cap") {
        ellipse(paint, 8, 9, 6, 5, main);
        rect(paint, 1, 10, 14, 2, trim);
        pixel(paint, 5, 6, shade(main, 0.35));
    } else if (shape === "helm") {
        ellipse(paint, 8, 9, 6, 6, main);
        rect(paint, 2, 11, 12, 4, main);
        rect(paint, 4, 10, 8, 2, "#1b1b24");
        rect(paint, 7, 3, 2, 9, trim);
        pixel(paint, 5, 6, shade(main, 0.5));
    } else if (shape === "headset") {
        //  A band over the top, a cup either side ringed in its trim, and
        //  a cat's ear standing on the band each side.
        rect(paint, 4, 4, 8, 2, main);
        rect(paint, 2, 6, 2, 4, main);
        rect(paint, 12, 6, 2, 4, main);
        ellipse(paint, 3, 11, 2.5, 3, main);
        ellipse(paint, 13, 11, 2.5, 3, main);
        ellipse(paint, 3, 11, 1.2, 1.7, trim);
        ellipse(paint, 13, 11, 1.2, 1.7, trim);
        for (const [x, y] of [
            [4, 1],
            [4, 2],
            [5, 2],
            [5, 3],
            [4, 3],
            [11, 1],
            [11, 2],
            [10, 2],
            [10, 3],
            [11, 3],
        ])
            pixel(paint, x, y, main);
        pixel(paint, 5, 3, trim);
        pixel(paint, 10, 3, trim);
    } else {
        //  A wide brim, a tall crown, and a feather in the band.
        rect(paint, 1, 11, 14, 2, main);
        rect(paint, 4, 5, 8, 6, main);
        rect(paint, 4, 9, 8, 1, shade(main, -0.35));
        line(paint, 11, 9, 14, 2, trim, 2);
        pixel(paint, 5, 6, shade(main, 0.35));
    }
}

/** A body piece, by its set: a long robe, a belted coat, a strapped
 *  harness, plate with pauldrons, a hooded tunic or a strapped jacket. */
function paintBody(
    paint: Paint,
    set: ArmorSet | undefined,
    [main, trim]: [string, string],
) {
    const dark = shade(main, -0.3);
    if (set === "arcane") {
        //  Flaring to the hem, a trimmed collar and front.
        rect(paint, 5, 2, 6, 5, main);
        rect(paint, 4, 7, 8, 4, main);
        rect(paint, 3, 11, 10, 4, main);
        rect(paint, 7, 3, 2, 12, trim);
        rect(paint, 5, 2, 6, 1, trim);
        rect(paint, 2, 3, 3, 5, dark);
        rect(paint, 11, 3, 3, 5, dark);
        return;
    }
    rect(paint, 4, 2, 8, 11, main);
    rect(paint, 2, 3, 3, 5, dark);
    rect(paint, 11, 3, 3, 5, dark);
    if (set === "knight") {
        //  Plate: pauldrons, a crest down the chest and a skirt of lames.
        ellipse(paint, 3, 4, 2.5, 2, shade(main, 0.2));
        ellipse(paint, 13, 4, 2.5, 2, shade(main, 0.2));
        rect(paint, 7, 3, 2, 8, trim);
        rect(paint, 4, 11, 8, 1, dark);
        rect(paint, 4, 13, 8, 2, main);
    } else if (set === "berserker") {
        //  Leather crossed by a strap, fur at the shoulders.
        line(paint, 4, 3, 11, 11, trim, 2);
        rect(paint, 2, 2, 12, 2, "#d8c8a8");
        rect(paint, 4, 11, 8, 2, dark);
    } else if (set === "ranger") {
        //  A hooded tunic, belted, its hem pointed.
        ellipse(paint, 8, 2, 3, 1.6, shade(main, -0.2));
        rect(paint, 4, 9, 8, 1, trim);
        pixel(paint, 8, 9, "#c9a15a");
        rect(paint, 6, 13, 4, 2, main);
    } else if (set === "scout") {
        //  A jacket crossed by two straps, a belt and a pouch.
        line(paint, 4, 3, 11, 9, "#5a3f28", 1);
        line(paint, 11, 3, 4, 9, "#5a3f28", 1);
        rect(paint, 4, 10, 8, 1, trim);
        rect(paint, 9, 11, 2, 2, "#5a3f28");
    } else {
        //  A coat with a gold belt and buttons.
        rect(paint, 4, 9, 8, 2, trim);
        pixel(paint, 8, 4, trim);
        pixel(paint, 8, 6, trim);
        rect(paint, 4, 13, 3, 2, main);
        rect(paint, 9, 13, 3, 2, main);
    }
    pixel(paint, 5, 3, shade(main, 0.4));
}

function paintGloves(paint: Paint, [main, trim]: [string, string]) {
    for (const x of [2, 9]) {
        rect(paint, x, 5, 5, 6, main);
        rect(paint, x + (x === 2 ? 4 : -1), 6, 2, 3, main);
        rect(paint, x, 11, 5, 3, trim);
        pixel(paint, x + 1, 6, shade(main, 0.4));
    }
}

function paintBoots(paint: Paint, [main, trim]: [string, string]) {
    for (const x of [2, 9]) {
        rect(paint, x, 3, 4, 8, main);
        rect(paint, x, 11, 6, 3, main);
        rect(paint, x, 3, 4, 2, trim);
        rect(paint, x, 13, 6, 1, shade(main, -0.4));
        pixel(paint, x + 1, 6, shade(main, 0.4));
    }
}

const cache = new Map<string, ReturnType<typeof paintTexture>>();

function cached(key: string, draw: (paint: Paint) => void) {
    const found = cache.get(key);
    if (found) return found;
    const texture = paintTexture(iconPixels, iconPixels, (paint) => {
        draw(paint);
        outline(paint, "#15151c");
    });
    cache.set(key, texture);
    return texture;
}

const photos = new Map<ItemId, Texture>();

/** An item's photograph, from public/icons, as a texture for its loot on
 *  the ground: loaded once, drawn as soon as it arrives. */
export function iconTexture(id: ItemId) {
    let texture = photos.get(id);
    if (!texture) {
        texture = new TextureLoader().load(
            `${import.meta.env.BASE_URL}icons/${id}.png`,
        );
        texture.colorSpace = SRGBColorSpace;
        photos.set(id, texture);
    }
    return texture;
}

/** An empty slot's faint outline of what it takes. */
export function slotTexture(slot: EquipSlot) {
    return cached(`slot-${slot}`, (paint) => {
        const grey: [string, string] = ["#8a8f99", "#6b707a"];
        if (slot === "weapon") paintSword(paint, grey);
        else if (slot === "shield") paintShield(paint, grey);
        else if (slot === "head") paintHead(paint, "helm", grey);
        else if (slot === "body") paintBody(paint, undefined, grey);
        else if (slot === "hands") paintGloves(paint, grey);
        else paintBoots(paint, grey);
    });
}

/** A small pile of gold coins. */
export function goldTexture() {
    return cached("gold", (paint) => {
        ellipse(paint, 6, 11, 4, 2.5, "#b8860b");
        ellipse(paint, 6, 10, 4, 2.5, "#ffd24a");
        ellipse(paint, 10, 8, 4, 2.5, "#b8860b");
        ellipse(paint, 10, 7, 4, 2.5, "#ffe27a");
        pixel(paint, 9, 6, "#fff8d0");
        pixel(paint, 5, 9, "#fff8d0");
    });
}
