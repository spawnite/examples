import {
    Hud,
    Icon,
    Joystick,
    Panel,
    Player,
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
            <Player position={startPosition} />
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
                {/*  Drawn only for a thumb. */}
                <Joystick
                    onSteer={steer}
                    className="fixed bottom-14 left-14 hidden pointer-coarse:flex"
                />
                <Tap
                    label="Jump"
                    onTap={jump}
                    className="fixed right-14 bottom-14 hidden pointer-coarse:flex"
                >
                    <Icon name="arrow-big-up" />
                </Tap>
            </Hud>
        </World>
    );
}
