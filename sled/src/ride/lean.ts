import { trait } from "koota";
import { MathUtils } from "three";
import {
    RunContext,
    TrackMoverTrait,
    type Behaviour,
    type System,
} from "@spawnite/engine/core";

/** Radians of roll into a full steer. */
const leanMaximum = 0.3;
/** How fast, in 1/s, the roll follows the steer: a flick still reads as a
 *  lean, and not as a snap. */
const leanResponse = 12;

export const LeanTrait = trait({
    /** Radians the rider rolls, positive into a steer to the right. */
    roll: 0,
    /** Off, the roll holds where it is, as at a run's end. */
    enabled: true,
});

export const LeanBehaviour: Behaviour<typeof LeanTrait> = {
    trait: LeanTrait,
    source: "games/sled/src/ride/lean.ts",
    description: "Rolls the rider into the steer.",
    runsOn: RunContext.Client,
};

/** Eases each rider's roll toward its steer. Drawn only: the ride is the
 *  mover's. */
export const leanIntoSteer: System = (world, { deltaSeconds }) => {
    world.query(LeanTrait, TrackMoverTrait).updateEach(([lean, mover]) => {
        if (!lean.enabled) return;
        lean.roll = MathUtils.damp(
            lean.roll,
            mover.steer * leanMaximum,
            leanResponse,
            deltaSeconds,
        );
    });
};
