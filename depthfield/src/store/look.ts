import { create } from "zustand";
import { persist } from "zustand/middleware";

//  How the field is drawn, switched from the devtools' Look panel to try
//  one effect against another. In development the choice is kept in this
//  browser, so a reload keeps it; a production page, which has no panel
//  to change it, always draws the defaults.

/** How the soldier and the swarm are drawn. */
export enum Figures {
    /** The Meshy models: the rigged soldier and the 3D swarm. */
    Models = "models",
    /** The source's pixel sprite and flat figures. */
    Flat = "flat",
}

/** Where the weapons past the first are drawn. */
export enum SpareGuns {
    /** Each floats beside the soldier and turns to its own shots. */
    Orbit = "orbit",
    /** The soldier's hands hold whichever gun fired last. */
    Swap = "swap",
}

/** What a shot's muzzle shows. */
export enum MuzzleLook {
    Off = "off",
    Flash = "flash",
    /** The flash, and a light on the floor round the soldier. */
    FlashAndLight = "flashAndLight",
}

/** What a dash shows. */
export enum DashLook {
    /** Fading copies and a streak on the floor. */
    Ghosts = "ghosts",
    /** The model's forward roll. */
    Roll = "roll",
    Both = "both",
}

/** How a killed enemy leaves. */
export enum DeathLook {
    /** A white flash, a squash flat and a burst of sparks. */
    Burst = "burst",
    /** Knocked back from the soldier, spinning, as it sinks. */
    Tumble = "tumble",
    /** Scattered into shards of its colour. */
    Shatter = "shatter",
}

/** How strongly the lifted colours glow. */
export enum GlowLook {
    Off = "off",
    Soft = "soft",
    Strong = "strong",
}

export interface LookState {
    figures: Figures;
    spareGuns: SpareGuns;
    muzzle: MuzzleLook;
    dash: DashLook;
    death: DeathLook;
    glow: GlowLook;
    /** The camera shakes on a hit taken and on a big kill. */
    shake: boolean;
    /** A bright rim round each model. */
    rims: boolean;
    /** Degrees each model leans back, away from the camera, so the angled
     *  camera sees it standing rather than foreshortened. */
    lean: number;
}

export const defaultLook: LookState = {
    figures: Figures.Models,
    spareGuns: SpareGuns.Orbit,
    muzzle: MuzzleLook.FlashAndLight,
    dash: DashLook.Both,
    death: DeathLook.Burst,
    glow: GlowLook.Soft,
    shake: true,
    rims: true,
    lean: 35,
};

export const useLook = create<LookState>()(
    import.meta.env.DEV
        ? persist(() => defaultLook, { name: "depthfield-look" })
        : () => defaultLook,
);
