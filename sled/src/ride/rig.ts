import { createQuery, trait, type Entity } from "koota";
import { MathUtils } from "three";
import {
    defineBehaviour,
    RunContext,
    TrackMoverTrait,
    updateEach,
    type System,
} from "@spawnite/engine/core";
import { RunMachine, RunTrait, stunSeconds } from "./course";
import { SlingTrait } from "./sling";

//  The rider's procedural pose. The models ship a skeleton and no clips, so
//  the pose is written to named bones each frame, every value derived from
//  what the sled is doing, as Unity's Animation Rigging and Godot's
//  SkeletonModifier3D layer a pose over a rig after the move. The step keeps
//  what depends on the simulation, here, and the view writes the bones.
//
//  Angles are in the old game's frame, which the view reproduces: +z is
//  forward, +x pitch leans the body forward, +z roll leans it right, and
//  `side` is +1 for the left arm.

/** Metres a second that counts as full speed. */
const fullSpeed = 18;
/** How fast, in 1/s, the pose follows the speed: fast enough that a launch
 *  reads as a tuck, slow enough to sit above the contact noise. */
const speedResponse = 8;
/** Seconds of air that count as fully airborne. */
const airReference = 0.45;
/** How fast, in 1/s, the takeoff and landing pulse decays. */
const impactDecay = 7;
/** The pulse a hit seeds: negative is a squash, and harder than a landing. */
const flinchImpact = -1.4;

/** Radians the body leans forward standing still. */
const tuckBase = 0.06;
/** Radians more it leans forward at full speed. */
const tuckSpeed = 0.22;
/** Radians more it crouches in the racing tuck. */
const racingTuckPitch = 0.18;
/** Radians the body leans back at a full pull of the sling. */
const braceCharge = 0.25;
/** Radians a lounger's torso leans back, about its seat. */
const loungeLeanBack = 0.25;
/** The fraction of the body's pitch the head cancels, to keep the horizon. */
const headCounter = 0.6;
/** Radians the head leads a turn. */
const headTurn = 0.3;
/** Radians the head lifts beyond the counter in the racing tuck. */
const tuckHeadUp = 0.1;

/** Radians the arms hang below the bind pose at rest. */
export const armRest = -0.5;
/** Radians the arms open above the bind at speed. */
const armSpread = 0.55;
/** Metres a second at which the arms are fully out: launch pace, so they
 *  are open by the time the sling lets go. */
const armSpeedReference = 6;
/** Radians the arms swing forward on a full pull of the sling. */
const armReach = 0.6;
/** Radians the arms fly up, fully airborne. */
const armAir = 0.7;
/** Radians the arms come down, and sweep back, in the racing tuck. */
const tuckArmDown = 1.0;
const tuckArmBack = 0.5;

/** Radians of extra roll into a full turn, on top of the sled's. */
const turnRoll = 0.18;
/** Radians the inside arm drops toward the snow, and swings back. */
const turnArmDrop = 0.9;
const turnArmBack = 0.6;
/** Radians the outside arm lifts to balance. */
const turnArmRaise = 0.35;

/** Radians the arms fly up, and come forward, at the moment of a hit. */
const hitArmsUp = 1.1;
const hitArmsForward = 0.5;
/** Radians the head is thrown back by a hit. */
const hitHeadBack = 0.5;
/** Radians of side-to-side wobble at a hit, and its rate in hertz. */
const hitWobble = 0.22;
const hitWobbleRate = 3.5;

/** The fraction a full impact squashes the body across, and stretches it
 *  up, about the seat. */
const impactSquash = 0.12;
const impactStretch = 0.18;

export const RigTrait = trait({
    /** 0 to 1, the eased fraction of full speed the pose answers to. */
    speed: 0,
    /** 0 to 1, how far into the air: the arms' rise. */
    air: 0,
    /** The takeoff's +1, the landing's -1 or a hit's -1.4, decaying to 0. */
    impact: 0,
    /** Off the snow at the last step: the edge that seeds the pulse. */
    airborne: false,
    /** Stunned at the last step: the edge that seeds the flinch. */
    stunned: false,
});

export const RigBehaviour = defineBehaviour({
    name: "rig",
    trait: RigTrait,
    source: "src/ride/rig.ts",
    description:
        "Poses the rider: a tuck with speed, a lean into the turn, arms up in the air, a squash on landing, a flail on a hit.",
    runsOn: RunContext.Client,
});

const riders = createQuery(RigTrait, TrackMoverTrait, RunTrait);

/** Eases each rider's pose toward its speed and air, and seeds the impact
 *  pulse on a takeoff, a landing and a hit. */
export const poseRiders: System = (world, { deltaSeconds }) => {
    updateEach(world, riders, ([rig, mover], rider) => {
        rig.speed = MathUtils.damp(
            rig.speed,
            MathUtils.clamp(mover.speed / fullSpeed, 0, 1),
            speedResponse,
            deltaSeconds,
        );
        const airborne = mover.height > 0;
        //  The mover counts the step it lands in as air, and the arms drop
        //  as the sled touches.
        rig.air = airborne
            ? MathUtils.clamp(mover.airSeconds / airReference, 0, 1)
            : 0;
        if (airborne !== rig.airborne) rig.impact = airborne ? 1 : -1;
        rig.airborne = airborne;
        const stunned = rider.has(RunMachine.is.stunned);
        if (stunned && !rig.stunned) rig.impact = flinchImpact;
        rig.stunned = stunned;
        rig.impact = MathUtils.damp(rig.impact, 0, impactDecay, deltaSeconds);
    });
};

/** How the rider sits its ride, which the view knows and the step does not. */
export interface RiderStance {
    /** 0 to 1, the racing tuck's blend. */
    tuck: number;
    /** 0 to 1, how far the rider lounges back. */
    lounge: number;
    /** Radians the arms rest at off the bind: `armRest`, or along a
     *  lounger's rim. */
    restArm: number;
}

/** One arm's offset off the bind: radians it opens, mirrored by side, and
 *  radians it swings back; negative swings it forward. */
export interface ArmPose {
    open: number;
    back: number;
}

/** The rider's pose this frame, each an offset off the bind pose. */
export interface RiderPose {
    /** Radians the body leans forward, and rolls right. */
    pitch: number;
    roll: number;
    /** Radians the body turns about up, to its left: the lobby's turn to
     *  show a new look. */
    yaw: number;
    /** The body's scale across and up, about the seat. */
    across: number;
    up: number;
    /** Radians the head pitches forward, and turns right. */
    headPitch: number;
    headYaw: number;
    armLeft: ArmPose;
    armRight: ArmPose;
}

const standing: RiderStance = { tuck: 0, lounge: 0, restArm: armRest };

/** Reads the rider's pose off its rig, its mover, its sling and its run. */
export function readRiderPose(
    rider: Entity,
    stance: RiderStance = standing,
    pose: RiderPose = createRiderPose(),
): RiderPose {
    const rig = rider.get(RigTrait);
    const steer = rider.get(TrackMoverTrait)?.steer ?? 0;
    const charge = rider.get(SlingTrait)?.charge ?? 0;
    const speed = rig?.speed ?? 0;
    const air = rig?.air ?? 0;
    const impact = rig?.impact ?? 0;
    const hitLeft = rider.has(RunMachine.is.stunned)
        ? (RunMachine.read(rider).secondsLeft ?? 0)
        : 0;
    const hit = hitLeft / stunSeconds;
    const tuck = stance.tuck * speed;

    const stancePitch =
        tuckBase +
        speed * tuckSpeed +
        tuck * racingTuckPitch -
        loungeLeanBack * stance.lounge;
    pose.pitch = stancePitch - charge * braceCharge;
    pose.yaw = 0;
    pose.roll =
        steer * turnRoll +
        Math.sin(hitLeft * Math.PI * 2 * hitWobbleRate) * hitWobble * hit;
    pose.across = 1 - impact * impactSquash;
    pose.up = 1 + impact * impactStretch;
    pose.headPitch =
        -stancePitch * headCounter - tuck * tuckHeadUp - hit * hitHeadBack;
    pose.headYaw = steer * headTurn;

    const move = MathUtils.clamp((speed * fullSpeed) / armSpeedReference, 0, 1);
    const open =
        stance.restArm * (1 - move) +
        armSpread * move +
        air * armAir -
        tuck * tuckArmDown +
        hit * hitArmsUp;
    const back = tuck * tuckArmBack - hit * hitArmsForward - charge * armReach;
    //  A steer to the right puts the right arm inside the turn.
    const right = MathUtils.clamp(steer, 0, 1);
    const left = MathUtils.clamp(-steer, 0, 1);
    pose.armLeft.open = open - left * turnArmDrop + right * turnArmRaise;
    pose.armLeft.back = back + left * turnArmBack;
    pose.armRight.open = open - right * turnArmDrop + left * turnArmRaise;
    pose.armRight.back = back + right * turnArmBack;
    return pose;
}

/** Seconds one breath takes, and the share it swells the body up by. */
const breathSeconds = 3.2;
const breathSwell = 0.025;
/** Radians the head glances to either side, the seconds a look one way and
 *  back takes, and how sharply it turns between: a glance holds, then
 *  turns, rather than swinging like a pendulum. */
const glanceTurn = 0.45;
const glanceSeconds = 7;
const glanceSharpness = 3;

/** Lays an idle rider's breath and its glances about onto `pose`, at
 *  `seconds` into the idle: the lobby's rider, standing still. */
export function addIdle(pose: RiderPose, seconds: number): RiderPose {
    const breath = Math.sin((seconds * 2 * Math.PI) / breathSeconds);
    pose.up += breath * breathSwell;
    pose.across -= (breath * breathSwell) / 2;
    pose.headYaw +=
        glanceTurn *
        Math.tanh(
            glanceSharpness * Math.sin((seconds * 2 * Math.PI) / glanceSeconds),
        );
    return pose;
}

/** Seconds the lobby's turn on show takes. */
const turnSeconds = 0.6;

/** Lays the lobby's turn on show onto `pose`, at `seconds` since the look
 *  on show changed: once round on the ride, eased in and out, as a mobile
 *  game's character picker spins a new character, and facing as it began
 *  from `turnSeconds` on. */
export function addTurn(pose: RiderPose, seconds: number): RiderPose {
    pose.yaw += 2 * Math.PI * MathUtils.smoothstep(seconds, 0, turnSeconds);
    return pose;
}

/** A pose to read into, made once per view. */
export function createRiderPose(): RiderPose {
    return {
        pitch: 0,
        roll: 0,
        yaw: 0,
        across: 1,
        up: 1,
        headPitch: 0,
        headYaw: 0,
        armLeft: { open: 0, back: 0 },
        armRight: { open: 0, back: 0 },
    };
}
