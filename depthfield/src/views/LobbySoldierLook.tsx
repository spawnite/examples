import { useEffect, useMemo } from "react";
import {
    Mesh,
    Quaternion,
    Sprite,
    Vector3,
    type Bone,
    type Object3D,
} from "three";
import {
    ClipLayer,
    playClip,
    useAfterPose,
    useEntity,
    useInspect,
    useModel,
} from "@spawnite/engine";
import { LookId, WeaponId, weaponIds } from "../rules/data";
import { useChoice } from "../store/choice";
import { useLook } from "../store/look";
import {
    holdGunInHands,
    measureArmLength,
    readGunKick,
    readHandMiss,
    readHoldingBody,
    type HoldingBody,
} from "./holdGunInHands";
import { addHueTurn, createModelMaterial } from "./matcap";
import { gunUrls, soldierModel } from "./models";
import { readLookTurn } from "./prism";
import {
    buildGun,
    copyBody,
    copyPose,
    findGeometry,
    listBones,
} from "./SoldierModel";

//  The lobby soldier's look over the engine's posed model. An Entity draws
//  a model in the file's own materials, and the soldier wears the matcap
//  turned to the look's hue, so this hides the engine's copy and draws its
//  own, dressed, in the pose the engine gave the hidden one each frame. It
//  stands three-quarters on to the camera and sways a little; a look pick
//  turns it to face the camera for a moment. It holds the gun of the
//  weapon picked in both hands, as the field's soldier does, and a weapon
//  pick turns it side on and plays a shot that raises the gun to its
//  shoulder and kicks it.
//  ponytail: two skeletons for one soldier; an Entity `material` prop, as
//  the Player has, would let the engine's copy wear the dress (the pull
//  request's engine gaps).

/** Radians it turns from facing the camera at rest: its front toward the
 *  screen's right, where the picks are. */
const restTurn = 0.45;
/** Radians it turns from facing the camera as a weapon pick's shot plays:
 *  side on, firing toward the picks, so the camera sees the gun's side
 *  and both hands on it rather than down its barrel. */
const shotTurn = 1.2;
/** Radians it sways either way at rest, and how fast, in radians of the
 *  sway a second. */
const swayRadians = 0.12;
const swaySpeed = 0.4;
/** Seconds it faces the camera after a pick. */
const faceSeconds = 1.6;
/** How quickly it turns to where it should face: the share of the way
 *  left it closes in a second is 1 - e^-rate. */
const turnRate = 3;
/** The clip a weapon pick plays, the gun raised while it plays. */
const shootClip = "shoot";
/** How quickly the gun rises and lowers: the share of the way left it
 *  closes in a second is 1 - e^-rate, as on the field. */
const raiseRate = 14;

const up = new Vector3(0, 1, 0);
//  Written in place each frame.
const yawTurn = new Quaternion();
const facing = new Quaternion();

export function LobbySoldierLook() {
    const entity = useEntity();
    const rims = useLook((look) => look.rims);
    const starter = useChoice((choice) => choice.starter) ?? WeaponId.Pulse;
    const look = useChoice((choice) => choice.look) ?? LookId.Grove;
    const { scene, animations } = useModel(soldierModel);
    const shotSeconds = useMemo(
        () => animations.find((clip) => clip.name === shootClip)?.duration ?? 0,
        [animations],
    );
    const gunModels = useModel(gunUrls);
    const hue = useMemo(() => ({ value: 0 }), []);
    const body = useMemo(
        () =>
            copyBody(scene, (map) => {
                const material = createModelMaterial(rims, map);
                addHueTurn(material, hue);
                return material;
            }),
        [scene, rims, hue],
    );
    const guns = useMemo(
        () =>
            new Map(
                weaponIds.map((id, index) => [
                    id,
                    buildGun(findGeometry(gunModels[index].scene), id, rims),
                ]),
            ),
        [gunModels, rims],
    );
    useEffect(
        () => () => {
            for (const material of body.materials) material.dispose();
        },
        [body],
    );
    useEffect(
        () => () => {
            for (const gun of guns.values())
                gun.group.traverse((node) => {
                    if (node instanceof Mesh || node instanceof Sprite)
                        node.material.dispose();
                });
        },
        [guns],
    );
    const state = useMemo(
        () => ({
            turn: restTurn,
            seconds: 0,
            faceAge: faceSeconds,
            shotAge: Infinity,
            /** How far the gun is raised, from 0 at rest to 1 aiming. */
            ready: 0,
            posedRoot: null as Object3D | null,
            posedBones: [] as Bone[],
            holding: null as HoldingBody | null,
        }),
        [],
    );
    useEffect(() => {
        state.faceAge = 0;
    }, [look, state]);
    useEffect(() => {
        state.shotAge = 0;
        playClip(entity, shootClip, { layer: ClipLayer.UpperBody });
    }, [starter, entity, state]);
    //  How it stands, for a check that reads it.
    useInspect("lobby soldier", () => ({
        posed: state.posedRoot !== null,
        turn: state.turn,
        gun: starter,
        ready: state.ready,
        handMiss: state.holding && readHandMiss(state.holding),
    }));

    useAfterPose(entity, (posed, delta) => {
        const { root } = posed;
        //  The engine's copy stays posed but unseen: this one is drawn.
        root.visible = false;
        if (state.posedRoot !== root) {
            state.posedRoot = root;
            state.posedBones = listBones(root);
        }
        copyPose(state.posedBones, body);
        state.seconds += delta;
        state.faceAge += delta;
        state.shotAge += delta;
        const target =
            state.shotAge < shotSeconds
                ? shotTurn
                : state.faceAge < faceSeconds
                  ? 0
                  : restTurn +
                    Math.sin(state.seconds * swaySpeed) * swayRadians;
        state.turn += (target - state.turn) * (1 - Math.exp(-delta * turnRate));
        //  The engine turns its copy half a turn to face away from the
        //  camera, along the entity's -z; another half turn faces it.
        yawTurn.setFromAxisAngle(up, Math.PI + state.turn);
        body.root.position.copy(root.position);
        body.root.quaternion.copy(root.quaternion).premultiply(yawTurn);
        body.root.scale.copy(root.scale);
        body.root.updateMatrixWorld(true);
        hue.value = readLookTurn(useChoice.getState().look ?? LookId.Grove);

        //  The gun of the weapon picked, in both hands in the low ready,
        //  raised to the shoulder while the pick's shot plays.
        if (state.holding?.root !== body.root)
            state.holding = readHoldingBody(
                body.root,
                (name) => body.bones.find((bone) => bone.name === name),
                measureArmLength(scene, root.scale.x),
            );
        state.ready +=
            ((state.shotAge < shotSeconds ? 1 : 0) - state.ready) *
            (1 - Math.exp(-delta * raiseRate));
        const picked = useChoice.getState().starter ?? WeaponId.Pulse;
        facing.copy(body.root.quaternion);
        for (const [id, gun] of guns) {
            gun.group.visible = id === picked;
            if (!gun.group.visible) continue;
            holdGunInHands({
                body: state.holding,
                gun: gun.group,
                weapon: id,
                ready: state.ready,
                held: 1,
                facing,
                kick: readGunKick(id, state.shotAge),
            });
        }
    });

    return (
        <>
            <primitive object={body.root} />
            {[...guns.values()].map((gun, index) => (
                <primitive key={weaponIds[index]} object={gun.group} />
            ))}
        </>
    );
}
