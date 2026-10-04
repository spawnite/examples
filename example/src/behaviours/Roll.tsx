import type { Entity } from "koota";
import {
    defineBehaviour,
    RunContext,
    states,
    TransformTrait,
    useBehaviour,
    type Position,
} from "@spawnite/engine";

/** Metres across the ground the ball's middle may drift from its spot
 *  and still rest there: more than a body settling moves, less than a
 *  push. */
const spotReach = 0.1;

/** Whether the ball stands further than `spotReach` from its spot. */
function isOffItsSpot(ball: Entity): boolean {
    const position = ball.get(TransformTrait);
    const roll = ball.get(RollMachine.trait);
    if (!position || !roll) return false;
    return (
        Math.hypot(position.x - roll.spotX, position.z - roll.spotZ) > spotReach
    );
}

/** The ball's roll: resting on its spot until the hero walks into it,
 *  then pushed. It watches the ball's own transform with `when`, so no
 *  system sends it anything. Its context is the spot, across the ground. */
export const RollMachine = states({
    id: "roll",
    description: "The ball: resting on its spot, then pushed off it.",
    initial: "resting",
    context: { spotX: 0, spotZ: 0 },
    states: {
        resting: { when: [[isOffItsSpot, "pushed"]] },
        pushed: {},
    },
});

export const RollBehaviour = defineBehaviour({
    name: "roll",
    trait: RollMachine.trait,
    runsOn: RunContext.Client,
    wiki: "/behaviours/roll/",
    source: "src/behaviours/Roll.tsx",
    description: "Says whether the ball rests on its spot or was pushed.",
});

export interface RollProps {
    /** Where the ball rests, as its Entity's `position`. */
    spot: Position;
}

/** Puts the roll machine on its entity. */
export function Roll({ spot: [x, , z] }: RollProps) {
    useBehaviour(RollBehaviour, { spotX: x, spotZ: z });

    return null;
}
