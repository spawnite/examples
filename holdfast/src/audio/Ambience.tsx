import { useEffect } from "react";
import { playAmbience } from "./sounds";

/** The night's sound bed, crickets and the fire's crackle over a low
 *  drone, looping while this is mounted, at the player's music volume. */
export function Ambience() {
    useEffect(() => playAmbience(), []);
    return null;
}
