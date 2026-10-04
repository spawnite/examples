import { useEffect } from "react";
import { AmbienceMood } from "./mix";
import { playAmbience, setAmbienceMood } from "./sounds";
import { usePhase } from "../views/phase";

/** The night's sound bed, crickets and the fire's crackle over a low
 *  drone, looping while this is mounted, at the player's music volume:
 *  the crickets hush and the drone swells while a wave stands. */
export function Ambience() {
    const phase = usePhase();
    useEffect(() => playAmbience(), []);
    useEffect(() => {
        setAmbienceMood(
            phase === "fight" ? AmbienceMood.Fight : AmbienceMood.Calm,
        );
    }, [phase]);
    return null;
}
