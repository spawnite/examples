import { Html } from "@react-three/drei";
import type { Entity } from "koota";
import { useHealth } from "@spawnite/engine";
import { Bar, palette } from "@spawnite/ui";

export interface HealthBarSize {
    /**  Html scales the element by distanceFactor / (2 · tan(fov / 2) ·
     *   distance). */
    distanceFactor: number;
    /** Pixels, before that scale. */
    width: number;
    height: number;
}

//  The factor is the one that draws the bar at the width and height beside it
//  when the camera sits where it starts: a 50° field of view at 3.81 m, the
//  camera settings the game opens with. The camera's own distance limits are
//  then the clamp, and the bar runs between about 2.4× and 0.76× of that
//  size, instead of shrinking to a pixel or towering over her. Realm draws
//  its own over-head bar at a fixed 96 × 6 px, from
//  packages/ui/src/realm/Hud.tsx on threejs-game-template v2.
export const healthBarSize: HealthBarSize = {
    distanceFactor: 3.38,
    width: 128,
    height: 11,
};

interface HealthBarProps {
    entity: Entity;
    height: number;
    /** Storybook's controls tune the bar against the app's own camera. */
    size?: HealthBarSize;
}

export function HealthBar({
    entity,
    height,
    size = healthBarSize,
}: HealthBarProps) {
    const health = useHealth(entity);
    if (!health) return null;

    return (
        <Html
            //  Html writes its scale in a frame callback, and only when the
            //  camera has moved; a new factor on a still camera would hold the
            //  old scale until something else moved. A new factor is a new
            //  element instead, which Storybook's slider needs and the app,
            //  which never changes it, never reaches.
            key={size.distanceFactor}
            center
            position={[0, height, 0]}
            distanceFactor={size.distanceFactor}
            //  Centred on her head, the bar straddles it; lifting it by its own
            //  height clears it, leaving half that height as the gap. The shift
            //  and the size are both inside the scaled element, so the gap
            //  closes and opens with the bar.
            style={{
                pointerEvents: "none",
                marginTop: -size.height,
                width: size.width,
                height: size.height,
            }}
        >
            <Bar
                label="Hero health"
                value={health.current}
                maximum={health.maximum}
                className={`h-full w-full ${palette.healthTrack}`}
            />
        </Html>
    );
}
