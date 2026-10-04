import boss from "@spawnite/assets/models/depthfield/boss.glb?url";
import elite from "@spawnite/assets/models/depthfield/elite.glb?url";
import grunt from "@spawnite/assets/models/depthfield/grunt.glb?url";
import gunBoomerang from "@spawnite/assets/models/depthfield/gun-boomerang.glb?url";
import gunBullet from "@spawnite/assets/models/depthfield/gun-bullet.glb?url";
import gunLaser from "@spawnite/assets/models/depthfield/gun-laser.glb?url";
import gunMine from "@spawnite/assets/models/depthfield/gun-mine.glb?url";
import gunNova from "@spawnite/assets/models/depthfield/gun-nova.glb?url";
import gunShards from "@spawnite/assets/models/depthfield/gun-shards.glb?url";
import gunZap from "@spawnite/assets/models/depthfield/gun-zap.glb?url";
import runner from "@spawnite/assets/models/depthfield/runner.glb?url";
import shooter from "@spawnite/assets/models/depthfield/shooter.glb?url";
import soldier from "@spawnite/assets/models/depthfield/soldier.glb?url";
import summoner from "@spawnite/assets/models/depthfield/summoner.glb?url";
import tank from "@spawnite/assets/models/depthfield/tank.glb?url";
import { MathUtils, Quaternion, Vector3 } from "three";
import { EnemyKind, WeaponId, weaponIds } from "../rules/data";
import { cameraPitch } from "./FieldCamera";

//  The Meshy models the field draws, and how each stands in the world.
//  Every swarm model and gun is baked to one unit: a monster one unit
//  tall with its feet at the origin, facing +z; a gun one unit long, its
//  barrel toward +z and the back of its stock at the origin. The rigged
//  soldier, elite and boss stand at their rigs' heights in metres.

export const soldierModel = soldier;

/** The name the soldier's model is registered under, which the Player
 *  wears. */
export const soldierModelName = "soldier";

/** The soldier's height on the field, in metres. */
export const soldierMetres = 1.6;

/** The rig's own height, which `soldierMetres` scales. */
export const soldierRigMetres = 1.5;

/** The rig drawn at the soldier's height. */
export const soldierScale = soldierMetres / soldierRigMetres;

/** The swarm kinds drawn as one instanced model each. */
export const swarmModels: Partial<Record<EnemyKind, string>> = {
    [EnemyKind.Grunt]: grunt,
    [EnemyKind.Runner]: runner,
    [EnemyKind.Tank]: tank,
    [EnemyKind.Shooter]: shooter,
    [EnemyKind.Summoner]: summoner,
};

/** A rigged monster: its file, its rig's height, and the height it
 *  stands at on the field. */
export interface RiggedMonster {
    url: string;
    rigMetres: number;
    metres: number;
}

/** The kinds drawn as a rigged model of their own, one at a time. */
export const riggedModels: Partial<Record<EnemyKind, RiggedMonster>> = {
    [EnemyKind.Elite]: { url: elite, rigMetres: 1.9, metres: 2.1 },
    [EnemyKind.CrimsonElite]: { url: elite, rigMetres: 1.9, metres: 2.3 },
    [EnemyKind.Boss]: { url: boss, rigMetres: 3, metres: 4.2 },
};

/** How many of its radii tall each swarm kind stands: taller than the
 *  source's flat figures, which stood 2.3, so the models read from the
 *  camera's height. */
export const swarmHeights: Partial<Record<EnemyKind, number>> = {
    [EnemyKind.Grunt]: 2.4,
    [EnemyKind.Runner]: 3.6,
    [EnemyKind.Tank]: 2.9,
    [EnemyKind.Shooter]: 3,
    [EnemyKind.Summoner]: 3.3,
};

/** A gun: its file, its length in metres in the soldier's hands, how hard
 *  each shot kicks the soldier from 0 to 1, its body's and its glowing
 *  parts' colours, and where each hand takes it. */
export interface GunLook {
    url: string;
    metres: number;
    kick: number;
    color: string;
    glow: string;
    /** The middle of the grip the right hand closes on, behind and below
     *  the trigger, in the gun's own units: z from 0 at the stock to 1 at
     *  the muzzle, y up from its bore. */
    rearGrip: Vector3;
    /** The middle of the fore grip or handguard the left hand cups, in the
     *  same units. */
    foreGrip: Vector3;
}

//  The grips were read off each gun's side silhouette: its mesh's points
//  binned by z and y, a pistol grip showing as the column that hangs
//  lowest behind the trigger guard's gap and a handguard as the underside
//  ahead of the magazine.

export const gunLooks: Record<WeaponId, GunLook> = {
    [WeaponId.Pulse]: {
        url: gunBullet,
        metres: 0.72,
        kick: 0.6,
        color: "#8fe3b0",
        glow: "#d0f8a9",
        //  Pistol grip z 0.26 to 0.37, down to y -0.18; handguard z 0.66
        //  to 0.88, ahead of the magazine at 0.53 to 0.66.
        rearGrip: new Vector3(0, -0.12, 0.31),
        foreGrip: new Vector3(0, -0.06, 0.72),
    },
    [WeaponId.Laser]: {
        url: gunLaser,
        metres: 0.95,
        kick: 0.4,
        color: "#8aa4c4",
        glow: "#80ddff",
        //  Pistol grip z 0.27 to 0.36, down to y -0.10; no handguard, so
        //  the left hand takes the front of the receiver, which ends at
        //  0.55, before the thin barrel.
        rearGrip: new Vector3(0, -0.06, 0.31),
        foreGrip: new Vector3(0, -0.02, 0.52),
    },
    [WeaponId.Boomerang]: {
        url: gunBoomerang,
        metres: 0.7,
        kick: 0.55,
        color: "#b7a3d9",
        glow: "#ffc76a",
        //  No pistol grip: the right hand takes the body's underside
        //  just ahead of the stock's rods, which end at z 0.24, and the
        //  left the underside at 0.62, behind the blade's curve.
        rearGrip: new Vector3(0, -0.07, 0.3),
        foreGrip: new Vector3(0, -0.03, 0.62),
    },
    [WeaponId.Shard]: {
        url: gunShards,
        metres: 0.7,
        kick: 0.6,
        color: "#f0a3c8",
        glow: "#d7c4ff",
        //  The wrist of the stock, z 0.2 to 0.27, down to y -0.10, is its
        //  grip, behind the lever's loop; the body's underside at 0.6,
        //  behind the crystals that hang to y -0.12, is the fore grip.
        rearGrip: new Vector3(0, -0.06, 0.24),
        foreGrip: new Vector3(0, -0.06, 0.6),
    },
    [WeaponId.Nova]: {
        url: gunNova,
        metres: 0.66,
        kick: 1,
        color: "#8f9fb8",
        glow: "#7fe8ff",
        //  Pistol grip z 0.2 to 0.35, down to y -0.22; the body's
        //  underside at y -0.08 runs from 0.5 to 0.86.
        rearGrip: new Vector3(0, -0.13, 0.29),
        foreGrip: new Vector3(0, -0.07, 0.66),
    },
    [WeaponId.Mine]: {
        url: gunMine,
        metres: 0.74,
        kick: 0.8,
        color: "#f2cf5b",
        glow: "#ffe27a",
        //  Pistol grip z 0.3 to 0.44, down to y -0.18, behind the drum at
        //  0.45 to 0.66; the block ahead of the drum, 0.7 to 0.95, under
        //  to y -0.12, is the fore grip.
        rearGrip: new Vector3(0, -0.12, 0.36),
        foreGrip: new Vector3(0, -0.08, 0.76),
    },
    [WeaponId.Zap]: {
        url: gunZap,
        metres: 0.5,
        kick: 0.45,
        color: "#6fa9e8",
        glow: "#b8fff4",
        //  A pistol: its grip z 0.02 to 0.27, down to y -0.28, raked
        //  back; no fore grip, so the left hand cups the body's underside
        //  at 0.55, ahead of the trigger guard.
        rearGrip: new Vector3(0, -0.14, 0.15),
        foreGrip: new Vector3(0, -0.07, 0.55),
    },
};

/** Every gun's file, in the order of `weaponIds`. */
export const gunUrls = weaponIds.map((id) => gunLooks[id].url);

const xAxis = new Vector3(1, 0, 0);

/** The turn that leans a model `lean` degrees back, away from the
 *  camera, about its feet, written into `out`. */
export function readLeanTurn(lean: number, out: Quaternion) {
    return out.setFromAxisAngle(xAxis, -MathUtils.degToRad(lean));
}

/** How far up the screen's own up a model `metres` tall reaches, leaning
 *  `lean` degrees back: where a bar or a label over it stands. */
export function readStandingHeight(metres: number, lean: number) {
    return metres * Math.cos(MathUtils.degToRad(cameraPitch - lean));
}
