import {
    Hud,
    Icon,
    Joystick,
    Panel,
    SideCamera,
    Slot,
    Tap,
    Text,
    useInput,
    World,
    type Position,
} from "@spawnite/engine";
import "../items";
import { Platform } from "../components/Platform";
import { Spirit } from "../components/Spirit";

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins and its save.
export { plugins } from "../game";
export { save } from "../save";

/** Metres a platform's top rises over the one before: past the 0.6 m step,
 *  so she jumps rather than walks up, and under the 1.2 m jump. */
const platformRise = 0.9;
/** Metres along x from one platform's centre to the next: 2 m wide with a
 *  half-metre gap. */
const platformSpacing = 2.5;
const platformWidth = 2;
/** Five platforms across the meadow's 8 m clearing, climbing toward
 *  positive x, rightward under the side camera. */
export const platformTops = [1, 2, 3, 4, 5].map(
    (index) => index * platformRise,
);
const calculatePlatformX = (index: number) => -4.5 + index * platformSpacing;
export const lastPlatformX = calculatePlatformX(platformTops.length - 1);
/** Left of the first platform, on the ground. */
const startPosition: Position = [-7, 0, 0];

export function Platforms() {
    const steer = useInput((state) => state.steer);
    const jump = useInput((state) => state.jump);

    return (
        <World map="meadow">
            <Spirit position={startPosition} />
            <SideCamera />
            {platformTops.map((top, index) => (
                <Platform
                    key={top}
                    position={[calculatePlatformX(index), top / 2, 0]}
                    size={[platformWidth, top, platformWidth]}
                />
            ))}
            <Hud>
                <Panel slot={Slot.Bottom}>
                    <Text>A and D walk, Space jumps. Climb to the top.</Text>
                </Panel>
                <Joystick onSteer={steer} />
                <Tap label="Jump" onTap={jump}>
                    <Icon name="arrow-big-up" />
                </Tap>
            </Hud>
        </World>
    );
}
