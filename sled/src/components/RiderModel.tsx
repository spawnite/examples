import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
    Box3,
    Group,
    Material,
    MathUtils,
    Mesh,
    MeshStandardMaterial,
    SkinnedMesh,
    Vector3,
    type Object3D,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Entity } from "koota";
import { useModel } from "@spawnite/engine";
import {
    addIdle,
    addTurn,
    armRest,
    createRiderPose,
    readRiderPose,
    RigTrait,
    type ArmPose,
    type RiderStance,
} from "../ride/rig";
import {
    RidePose,
    rides,
    riders,
    type ModelFit,
    type RideId,
    type RideLook,
    type RiderId,
} from "../ride/riders";

//  The rider's animal on its ride, posed each frame from the rig. Built in
//  the old game's frame, +z forward, which the parent turns to face down
//  the track. Drawn only: the mover places the entity.

/** Radians the thigh swings forward to sit. */
const sitHipSwing = 1.4;
/** Radians the calf folds back under it. */
const sitKneeFold = 0.3;
/** Seconds in a riding stance before the next, plus up to `stanceVary`:
 *  at cruise the rider drifts between arms wide and the racing tuck. */
const stanceMinimum = 2;
const stanceVary = 2;
/** How fast, in 1/s, the rider shifts between stances: a shift, not a
 *  snap. */
const stanceResponse = 3;
/** The fraction of full speed above which the stance clock runs, so a
 *  launch never tucks. */
const stanceCruise = 0.5;

/** Metres above the folded skin's lowest vertex that still count as where
 *  it touches the seat: both soles, not the one a hair lower. */
const soleBand = 0.01;

/** A bone the rig turns, with its bind rotation to turn it from. */
interface Joint {
    node: Object3D;
    x: number;
    y: number;
    z: number;
}

/** A skinned rider ready to pose: its bones by role, and what its seat
 *  measured. */
interface RiderRig {
    body: Group;
    head?: Joint;
    armLeft?: Joint;
    armRight?: Joint;
    /** Radians the arms rest at off the bind, on this ride. */
    restArm: number;
    lounge: number;
}

/** Scales and turns `model` by its bounds, so the file's own origin stops
 *  mattering, stands it on its lowest point, centres it across and along,
 *  and returns its height. */
function fitModel(model: Object3D, fit: ModelFit) {
    model.rotation.y = fit.turn ?? 0;
    model.updateMatrixWorld(true);
    const size = new Box3().setFromObject(model).getSize(new Vector3());
    model.scale.setScalar(
        fit.width
            ? fit.width / size.x
            : fit.length
              ? fit.length / size.z
              : (fit.scale ?? 1),
    );
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);
    model.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        part.castShadow = true;
        part.receiveShadow = true;
        //  A skin keeps its bind pose's bounds, which a posed arm leaves.
        if (part instanceof SkinnedMesh) part.frustumCulled = false;
    });
    return bounds.max.y - bounds.min.y;
}

function findJoint(body: Object3D, name: string): Joint | undefined {
    const node = body.getObjectByName(name);
    if (!node) return undefined;
    const { x, y, z } = node.rotation;
    return { node, x, y, z };
}

/** Where `node` is in the body's own parent space, the body unparented. */
function readPosition(body: Object3D, node: Object3D) {
    body.updateMatrixWorld(true);
    return node.getWorldPosition(new Vector3());
}

/** Where the posed skin under `body` touches down, in the body's space,
 *  the body unparented: the lowest vertex's height, and the middle of every
 *  vertex within `soleBand` of it. Read from the deformed vertices, since
 *  a bone sits inside the flesh it moves. */
function readSole(body: Object3D) {
    body.updateMatrixWorld(true);
    const points: Vector3[] = [];
    body.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        const count = part.geometry.getAttribute("position").count;
        for (let index = 0; index < count; index++)
            points.push(
                part
                    .getVertexPosition(index, new Vector3())
                    .applyMatrix4(part.matrixWorld),
            );
    });
    const lowest = points.reduce(
        (low, point) => Math.min(low, point.y),
        Infinity,
    );
    const sole = points.filter((point) => point.y < lowest + soleBand);
    return sole
        .reduce((sum, point) => sum.add(point), new Vector3())
        .divideScalar(sole.length)
        .setY(lowest);
}

/** How a rider is built onto its ride. */
interface RigOptions {
    fit: ModelFit;
    ride: RideLook;
    /** Metres over the snow the rider rests at, from `buildRide`. */
    seat: number;
}

/** Clones the rider on a skeleton of its own, seats it on `ride` and
 *  measures what the seat asks: where the folded skin touches down, which
 *  rests on the seat and is the point the body pitches, rolls and squashes
 *  about, and the arm's angle along a lounger's rim. */
export function buildRig(
    scene: Object3D,
    { fit, ride, seat }: RigOptions,
): RiderRig {
    const model = clone(scene);
    fitModel(model, fit);
    const body = new Group().add(model);
    //  The turn on show is outermost, so the body spins leant as it sits.
    body.rotation.order = "YXZ";
    const shoulder = body.getObjectByName("L_Upperarm");
    const hand = body.getObjectByName("L_Hand");
    const shoulderAt = shoulder && readPosition(body, shoulder);
    const handAt = hand && readPosition(body, hand);

    const sit = ride.pose === RidePose.Stand ? 0 : 1;
    for (const name of ["L_Thigh", "R_Thigh"]) {
        const thigh = body.getObjectByName(name);
        if (thigh) thigh.rotation.x += sitHipSwing * sit;
    }
    for (const name of ["L_Calf", "R_Calf"]) {
        const calf = body.getObjectByName(name);
        if (calf) calf.rotation.x -= sitKneeFold * sit;
    }
    //  The model moves inside the body, so the body's origin, which the
    //  pose turns and scales about, is where the skin touches the seat.
    const sole = readSole(body);
    model.position.sub(sole);
    body.position.set(sole.x, seat, sole.z);

    const lounge = ride.pose === RidePose.Lounge ? 1 : 0;
    let restArm = armRest;
    if (lounge && shoulderAt && handAt) {
        //  The seated shoulder looks down, or up, at the rim across the
        //  arm's length; the bind's own angle below level is taken off.
        const length = shoulderAt.distanceTo(handAt);
        const bindBelow = Math.asin((shoulderAt.y - handAt.y) / length);
        const seated = shoulderAt.y - sole.y;
        restArm =
            bindBelow -
            Math.asin(
                MathUtils.clamp((seated - (ride.rim ?? 0)) / length, -1, 1),
            );
    }
    return {
        body,
        head: findJoint(body, "Head"),
        armLeft: findJoint(body, "L_Upperarm"),
        armRight: findJoint(body, "R_Upperarm"),
        restArm,
        lounge,
    };
}

/** Clones the ride, fitted and painted, and places it on the snow under
 *  the seat, with the seat's height in metres. */
export function buildRide(scene: Object3D, ride: RideLook) {
    const model = scene.clone();
    const height = fitModel(model, ride);
    const { finish } = ride;
    if (finish)
        model.traverse((part) => {
            if (!(part instanceof Mesh)) return;
            if (!(part.material instanceof MeshStandardMaterial)) return;
            part.material = part.material.clone();
            part.material.setValues(finish);
        });
    const placed = new Group().add(model);
    placed.position.set(-(ride.right ?? 0), 0, -(ride.forward ?? 0));
    return { model: placed, seat: height * (ride.deck ?? 1) };
}

/** Turns an arm off its bind: open about z, mirrored by `side`, and back
 *  about x. The skins' upper arm swings its hand forward about +x, on
 *  either side, so a swing back is a negative turn. */
function poseArm(joint: Joint | undefined, arm: ArmPose, side: number) {
    if (!joint) return;
    joint.node.rotation.z = joint.z + side * arm.open;
    joint.node.rotation.x = joint.x - arm.back;
}

/** Who rides, and on what. */
export interface RiderPick {
    rider: RiderId;
    ride: RideId;
}

interface RiderModelProps extends RiderPick {
    /** The rider entity whose rig poses the model. */
    entity: Entity;
    /** Standing still on show, as in the lobby: it breathes and glances
     *  about.
     *  @defaultValue `false` */
    idle?: boolean;
    /** A value whose every change turns the rider once round on its ride,
     *  as the lobby does to show a new look; never turns without one. */
    turnKey?: string;
}

/** The rider's animal on its ride: tucked with speed, leant into the turn,
 *  arms up in the air, squashed on landing and flailing on a hit. */
export function RiderModel({
    entity,
    rider,
    ride,
    idle = false,
    turnKey,
}: RiderModelProps) {
    const look = rides[ride];
    //  Both files fetch at once: the second load would wait on the first.
    useModel.preload(look.url);
    const riderModel = useModel(riders[rider].url);
    const rideModel = useModel(look.url);
    const { model: rideCopy, seat } = useMemo(
        () => buildRide(rideModel.scene, look),
        [rideModel, look],
    );
    const rig = useMemo(
        () =>
            buildRig(riderModel.scene, {
                fit: riders[rider],
                ride: look,
                seat,
            }),
        [riderModel, rider, look, seat],
    );
    //  The skeleton and any finish are this copy's; the geometry stays the
    //  loaded file's.
    useEffect(
        () => () =>
            rig.body.traverse((part) => {
                if (part instanceof SkinnedMesh) part.skeleton.dispose();
            }),
        [rig],
    );
    useEffect(
        () => () => {
            if (look.finish)
                rideCopy.traverse((part) => {
                    if (
                        part instanceof Mesh &&
                        part.material instanceof Material
                    )
                        part.material.dispose();
                });
        },
        [rideCopy, look],
    );

    const frame = useMemo(
        () => ({
            pose: createRiderPose(),
            stance: {
                tuck: 0,
                lounge: rig.lounge,
                restArm: rig.restArm,
            } satisfies RiderStance,
            tucked: false,
            stanceLeft: stanceMinimum,
        }),
        [rig],
    );
    //  Kept across a new rig, so a new rider turns as it appears.
    const turn = useRef({ key: turnKey, start: -Infinity });
    useFrame(({ clock }, delta) => {
        if (turn.current.key !== turnKey)
            turn.current = { key: turnKey, start: clock.elapsedTime };
        //  The stance clock runs at cruise only, so the first tuck comes a
        //  few seconds into the run.
        if ((entity.get(RigTrait)?.speed ?? 0) > stanceCruise) {
            frame.stanceLeft -= delta;
            if (frame.stanceLeft <= 0) {
                frame.stanceLeft = stanceMinimum + Math.random() * stanceVary;
                frame.tucked = !frame.tucked;
            }
        }
        frame.stance.tuck = MathUtils.damp(
            frame.stance.tuck,
            frame.tucked ? 1 : 0,
            stanceResponse,
            delta,
        );
        const pose = readRiderPose(entity, frame.stance, frame.pose);
        if (idle) addIdle(pose, clock.elapsedTime);
        addTurn(pose, clock.elapsedTime - turn.current.start);
        const { body, head } = rig;
        body.rotation.x = pose.pitch;
        body.rotation.y = pose.yaw;
        body.rotation.z = pose.roll;
        body.scale.set(pose.across, pose.up, pose.across);
        if (head) {
            //  The skins' head bone has its x axis to the rider's right and
            //  its y axis up, so a turn about either is the opposite way
            //  to the body's.
            head.node.rotation.x = head.x - pose.headPitch;
            head.node.rotation.y = head.y - pose.headYaw;
        }
        poseArm(rig.armLeft, pose.armLeft, 1);
        poseArm(rig.armRight, pose.armRight, -1);
    });
    return (
        <>
            <primitive object={rideCopy} />
            <primitive object={rig.body} />
        </>
    );
}
