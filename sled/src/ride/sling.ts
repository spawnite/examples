import { trait, type Entity } from "koota";
import { MathUtils } from "three";
import {
    Authority,
    launchTrackMover,
    readStat,
    RunContext,
    startRound,
    TrackMoverTrait,
    type Behaviour,
    type System,
} from "@spawnite/engine/core";
import type { LevelPoint } from "../levels";

//  The slingshot the run starts from. The drag sets the targets and the
//  eased values trail them, so the rider follows the finger like a weighted
//  sling. The sideways ease moves the rider for real; the pull-back is drawn
//  only, because behind the start line there is no track to ride.

/** Metres a second down the run at a full charge, before the rider's
 *  `launch` stat scales it. */
const launchMaximum = 6.5;
/** Metres a second at none: the sling's slack, never fired from. */
const launchMinimum = 1.5;
/** Where the sling sits the moment it is touched: a bare press fires from
 *  here. */
const tapCharge = 0.5;
/** Metres the rider is drawn back at a full charge. */
export const pullMaximum = 2;
/** How fast, in 1/s, the pull eases toward the drag; lower is heavier. */
const pullResponse = 5;
/** The sideways aim eases slower than the pull. */
const sideResponse = 2.5;
/** Seconds S is held for a full pull, and A or D for a full aim. */
const keyPullSeconds = 0.8;
const keyAimSeconds = 0.5;
/** Metres either side of the centre the sling aims across, at most. */
const aimSpanMaximum = 2.5;

export const SlingTrait = trait({
    /** 0 to 1, the eased pull the rider is drawn back by. */
    charge: 0,
    /** 0 to 1, the pull the drag asks for, which the launch pays. */
    targetCharge: 0,
    /** -1 to 1, the eased aim across. */
    side: 0,
    targetSide: 0,
    /** Metres either side of the centre a full aim reaches. */
    aimSpan: aimSpanMaximum,
    /** On until the release, off for the rest of the run: easing on would
     *  drag the rider back to the line. */
    enabled: true,
});

export const SlingBehaviour: Behaviour<typeof SlingTrait> = {
    trait: SlingTrait,
    source: "games/sled/src/ride/sling.ts",
    description: "Pulls the rider back and aims it, then launches it.",
    ranges: { aimSpan: { min: 0, max: 4, step: 0.1 } },
    runsOn: RunContext.Client,
};

/** The aim across a level's start: inside the lane, never into its edge. */
export function readAimSpan(points: LevelPoint[]) {
    return Math.min(aimSpanMaximum, points[0].width / 2 - 0.5);
}

/** Sets what the sling is pulled to: `charge` 0 to 1, and `side` -1 to 1
 *  across the lane. The rider eases toward it each step. */
export function aimSling(entity: Entity, charge: number, side = 0) {
    entity.set(SlingTrait, {
        targetCharge: MathUtils.clamp(charge, 0, 1),
        targetSide: MathUtils.clamp(side, -1, 1),
    });
}

/** Fires the sling: the power comes off the drag, not the eased pull, so a
 *  quick yank pays in full. The pull snapping home is the firing. The
 *  `launch` stat scales the whole range, the slack with the full pull. */
export function releaseSling(entity: Entity) {
    const sling = entity.get(SlingTrait);
    if (!sling?.enabled) return;
    const scale = (readStat(entity, "launch") ?? launchMaximum) / launchMaximum;
    const speed =
        MathUtils.lerp(launchMinimum, launchMaximum, sling.targetCharge) *
        scale;
    entity.set(SlingTrait, { charge: 0, targetCharge: 0, enabled: false });
    launchTrackMover(entity, speed);
}

//  Written in the step, released after it: koota writes a record back
//  once its callback returns.
let released: Entity | null = null;

/** The player's sling on the keys and the stick: S pulls, W eases off, A
 *  and D aim, and a jump fires. The first press draws the half-pull a
 *  touch does. Then every sling eases toward its targets. Between the
 *  input and the move, so the move never sees the fire as a jump. */
export const drawSling: System = (world, { deltaSeconds, input }) => {
    world
        .query(SlingTrait, TrackMoverTrait, Authority)
        .updateEach(([sling, mover, { context }], entity) => {
            if (!sling.enabled) return;
            if (context === RunContext.Client) {
                const pull = -(input?.intent.y ?? 0);
                const aim = mover.steer;
                const fire = mover.jump;
                if (pull || aim || fire) {
                    sling.targetCharge = MathUtils.clamp(
                        Math.max(
                            tapCharge,
                            sling.targetCharge +
                                (pull * deltaSeconds) / keyPullSeconds,
                        ),
                        0,
                        1,
                    );
                    sling.targetSide = MathUtils.clamp(
                        sling.targetSide + (aim * deltaSeconds) / keyAimSeconds,
                        -1,
                        1,
                    );
                }
                if (fire) {
                    mover.jump = false;
                    released = entity;
                    return;
                }
            }
            sling.charge = MathUtils.damp(
                sling.charge,
                sling.targetCharge,
                pullResponse,
                deltaSeconds,
            );
            sling.side = MathUtils.damp(
                sling.side,
                sling.targetSide,
                sideResponse,
                deltaSeconds,
            );
            mover.lateral = sling.side * sling.aimSpan;
        });
    if (released) {
        releaseSling(released);
        //  The fire is the run's start.
        startRound(world);
    }
    released = null;
};
