import { facePlates, firstPlate } from "./paintFace";
import { wigs } from "./wigs";

//  How the hero looks, chosen at character creation: a hairstyle, a face,
//  and a place along a colour ramp for her hair, her skin, each eye and her
//  outfit. Each colour is a number from 0 to 1, a slider's position, so a
//  ramp can be retuned without breaking a saved hero.

/** The hairstyles, each a wig fitted to her bald head, by name. */
export const hairStyles = wigs.map(({ name }) => name);

/** The faces she can choose, by name: the creator's plates only. The
 *  painted faces are hidden for now, as the creator asked, since they are
 *  not drawn to the plates' scale; a look keeps its place among every
 *  face, painted first, so they can come back. */
export const faces = facePlates.map(({ name }) => name);

/** A face's place in `faces`, and the face at a place in it. */
export const faceChoice = (face: number) => face - firstPlate;
export const faceChosen = (choice: number) => firstPlate + choice;

export type Look = {
    hair: number;
    face: number;
    hairColor: number;
    skin: number;
    leftEye: number;
    rightEye: number;
    outfit: number;
};

/** The ramps each slider runs along, as colour stops: natural shades
 *  first, then fantasy ones. */
export const ramps = {
    hair: [
        "#141414",
        "#3b2417",
        "#6b4226",
        "#a0522d",
        "#c8452c",
        "#e0892e",
        "#e8c35a",
        "#f2e6b8",
        "#f4f4f4",
        "#e98bbf",
        "#9b5de5",
        "#3d7de0",
        "#2ec4b6",
        "#4caf50",
    ],
    skin: [
        "#fde7d6",
        "#f5d0b0",
        "#e8b48c",
        "#d39a6a",
        "#b87a4b",
        "#8d5a36",
        "#5e3a22",
        "#3b2416",
        "#9fd3a8",
        "#9ab8e8",
    ],
    outfit: [
        "#7a7d82",
        "#2a2a2e",
        "#3f6fb0",
        "#2fa3c7",
        "#2c7a4b",
        "#8fb83a",
        "#c9a227",
        "#d97a3a",
        "#b8342c",
        "#e98bbf",
        "#6b4a8a",
        "#f2f2f2",
    ],
    eye: [
        "#3b2417",
        "#7a4a22",
        "#9a7b3a",
        "#4f8a3a",
        "#2fae6a",
        "#3a8fb7",
        "#7fa8c9",
        "#8a8f98",
        "#7b4fc9",
        "#b03a5b",
        "#d9342b",
        "#f2b632",
    ],
} satisfies Record<string, string[]>;

function channels(hex: string) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** The colour a slider at `t`, 0 to 1, stands on along `stops`. */
export function colorAt(stops: readonly string[], t: number) {
    const place = Math.min(1, Math.max(0, t)) * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(place));
    const share = place - index;
    const from = channels(stops[index]);
    const to = channels(stops[index + 1]);
    const mixed = from.map((channel, at) =>
        Math.round(channel + (to[at] - channel) * share),
    );
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** A slider's track: the ramp as a CSS gradient. */
export function rampGradient(stops: readonly string[]) {
    return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** Short dark brown hair, a calm face, sea-green eyes and a blue outfit. */
export const defaultLook: Look = {
    hair: 1,
    face: firstPlate,
    hairColor: 0.1,
    skin: 0.12,
    leftEye: 0.42,
    rightEye: 0.42,
    outfit: 0.2,
};

/** A look at random: natural skin, and one hero in four with eyes of two
 *  colours. */
export function randomLook(): Look {
    const leftEye = Math.random();
    return {
        hair: Math.floor(Math.random() * hairStyles.length),
        face: faceChosen(Math.floor(Math.random() * faces.length)),
        hairColor: Math.random(),
        skin: Math.random() * 0.75,
        leftEye,
        rightEye: Math.random() < 0.75 ? leftEye : Math.random(),
        outfit: Math.random(),
    };
}

/** The colours the painter reads. */
export function lookColors(look: Look) {
    return {
        hair: colorAt(ramps.hair, look.hairColor),
        skin: colorAt(ramps.skin, look.skin),
        leftEye: colorAt(ramps.eye, look.leftEye),
        rightEye: colorAt(ramps.eye, look.rightEye),
        outfit: colorAt(ramps.outfit, look.outfit),
    };
}
