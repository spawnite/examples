import { useWorld } from "koota/react";
import { useBank } from "../bank";
import { readSpeedStepCost, speedSteps } from "../ride/speed";
import { buySpeedStep, useProgress } from "../shop";
import { SpeedDial } from "./SpeedDial";
import { StageMark, type ScreenPoint } from "./StageMark";

/** The Speed dial floating on the stage at `at`, from the player's step
 *  and bank: its `+` buys the next step. */
export function SpeedUpgrade({ at }: { at: ScreenPoint }) {
    const world = useWorld();
    const { step } = useProgress();
    const bank = useBank();
    const price = step < speedSteps ? readSpeedStepCost(step + 1) : undefined;
    return (
        <StageMark at={at}>
            <SpeedDial
                step={step}
                price={price}
                affordable={price !== undefined && bank >= price}
                onBuy={() => buySpeedStep(world)}
            />
        </StageMark>
    );
}
