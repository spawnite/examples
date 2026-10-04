import {
    Camera,
    CameraPreset,
    CameraTarget,
    Hud,
    Panel,
    Round,
    RoundScreen,
    Slot,
    Text,
    World,
    type Position,
} from "@spawnite/engine";
import "../items";
import { Ball } from "../components/Ball";
import { Coin } from "../components/Coin";
import { Ring } from "../components/Ring";
import { RoundClock } from "../components/RoundClock";
import { Tree } from "../components/Tree";
import { Spirit } from "../components/Spirit";

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins and its save.
export { plugins } from "../game";
export { save } from "../save";

/** Three coins in a line ahead of the player, a tree beside them, then the
 *  ball, and the ring past them. The round is won with every coin. */
export const coinPositions: Position[] = [
    [0, 0, -3],
    [0, 0, -5],
    [0, 0, -7],
];
/** Resting on the ground: its centre a radius up. */
export const ballPosition: Position = [0, 0.5, -8.5];
const treePosition: Position = [2, 0, -5];
const ringPosition: Position = [0, 0, -10];

export function Run() {
    return (
        <World map="meadow">
            <Spirit />
            {/*  The orbit it has always had: the left button's drag,
                and no click-to-walk. */}
            <Camera
                follow={CameraTarget.Player}
                preset={CameraPreset.Classic}
                clickToWalk={false}
            />
            <Round seconds={20} target={coinPositions.length} />
            <RoundClock />
            <RoundScreen />
            {coinPositions.map((position) => (
                <Coin key={position.join()} position={position} />
            ))}
            <Ball position={ballPosition} />
            <Tree position={treePosition} />
            <Ring position={ringPosition} />
            <Hud>
                <Panel slot={Slot.Bottom}>
                    <Text>
                        WASD walks. Collect the three coins before the clock
                        runs out.
                    </Text>
                </Panel>
            </Hud>
        </World>
    );
}
