import type { World } from "koota";
import { Sound } from "../audio/sounds";
import { GunId } from "../siege/guns";
import { lanceWeapon } from "../siege/lance";
import { BeamKind } from "../views/Beam";
import { kickView } from "../views/shakes";

//  How each weapon's shot looks, sounds and feels on a page: its line,
//  whether that line runs on through what it hits, its sound, how far it
//  pushes back what it hits, and how hard it kicks its shooter's camera.
//  A heavy gun pushes and kicks harder, as Deep Rock Galactic's heavy
//  weapons stagger what they hit.

/** How far a hit pushes a monster's body back, and how long it takes to
 *  come home. */
export interface Knock {
    metres: number;
    seconds: number;
}

interface ShotLook {
    beam: BeamKind;
    /** Whether its line runs on past what it hits, to cover or its range,
     *  as a shot that pierces a whole line does. */
    through: boolean;
    sound: Sound;
    knock: Knock;
    /** How hard a shot shakes its shooter's own camera, as `shakeCamera`
     *  takes it: a whole shake at 1, none at 0. */
    kick: number;
}

const shotLooks: Record<string, ShotLook> = {
    //  Six shots a second: a kick would blur the view.
    [GunId.Blaster]: {
        beam: BeamKind.Bolt,
        through: false,
        sound: Sound.Shot,
        knock: { metres: 0.12, seconds: 0.12 },
        kick: 0,
    },
    [GunId.Scattergun]: {
        beam: BeamKind.Pellet,
        through: false,
        sound: Sound.Scattergun,
        knock: { metres: 0.28, seconds: 0.25 },
        kick: 0.2,
    },
    [GunId.Rail]: {
        beam: BeamKind.Rail,
        through: true,
        sound: Sound.Rail,
        knock: { metres: 0.4, seconds: 0.35 },
        kick: 0.3,
    },
    //  A card's weapon on the other button, not a gun her camera kicks
    //  for, but a spear of light that pushes what it runs through.
    [lanceWeapon]: {
        beam: BeamKind.Lance,
        through: true,
        sound: Sound.Shot,
        knock: { metres: 0.3, seconds: 0.3 },
        kick: 0,
    },
};

/** How a shot of `weapon` looks and sounds: a blaster's where the page
 *  knows no other. */
export function readShotLook(weapon: string): ShotLook {
    return shotLooks[weapon] ?? shotLooks[GunId.Blaster];
}

/** Kicks her own camera for a shot of `weapon`, as hard as the gun is
 *  heavy, and a held trigger's kicks no higher than one heavy shot. The
 *  player's Screen shake setting and Reduced motion scale it as they do
 *  every shake. */
export function kickCamera(world: World, weapon: string) {
    const { kick } = readShotLook(weapon);
    if (kick > 0) kickView(world, kick);
}
