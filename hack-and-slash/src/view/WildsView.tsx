import { OrbitCamera } from "./OrbitCamera";
import { usePortrait } from "./device";

/** The wilds' view: an MMO's camera behind and above her, which the
 *  player turns and tilts with the right mouse button or two fingers, and
 *  zooms with the wheel or a pinch. It starts looking north over her, and
 *  leads toward her aim and moves with the fight. Held upright, as a phone
 *  in portrait, it starts further back, so as much ground shows across.
 *  Its own component, so a phone turning redraws the view and not the
 *  scene. */
export function WildsView() {
    const portrait = usePortrait();
    return (
        <OrbitCamera
            polar={(50 * Math.PI) / 180}
            distance={portrait ? 14 : 10}
            minDistance={4}
            maxDistance={18}
            minPolar={(20 * Math.PI) / 180}
            maxPolar={(82 * Math.PI) / 180}
            dynamic
        />
    );
}
