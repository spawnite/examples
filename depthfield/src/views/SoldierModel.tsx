import type { Entity } from "koota";
import { useWorld } from "koota/react";
import { useEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    Bone,
    CircleGeometry,
    Group,
    Mesh,
    MeshBasicMaterial,
    Quaternion,
    Sprite,
    SpriteMaterial,
    Vector3,
    type BufferGeometry,
    type Material,
    type MeshMatcapMaterial,
    type Object3D,
    type Texture,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import {
    AimPointTrait,
    useAfterPose,
    useInspect,
    useModel,
    type ModelMaterial,
    type PosedModel,
} from "@spawnite/engine";
import { findLook, weaponIds, type WeaponId } from "../rules/data";
import { echoOffsetX, echoOffsetZ } from "../rules/field";
import { isRolling } from "../rules/hero";
import { aimSeconds } from "../rules/weapons";
import { RunPhase, Shooter, ShotsTrait, type RunState } from "../rules/traits";
import { DashLook, MuzzleLook, SpareGuns, useLook } from "../store/look";
import { findRun } from "./findRun";
import {
    addHueTurn,
    createModelMaterial,
    readGlowTexture,
    type HueTurn,
} from "./matcap";
import {
    holdGunInHands,
    measureArmLength,
    readGunKick,
    readHandMiss,
    readHoldingBody,
    type HoldingBody,
} from "./holdGunInHands";
import {
    gunLooks,
    gunUrls,
    readLeanTurn,
    soldierModel,
    soldierScale,
} from "./models";
import { liftNeon } from "./neon";
import { readLookTurn } from "./prism";
import { useEventRecords } from "./useEventRecords";

//  The soldier's look over the engine's posed model: the engine's Player
//  wears the rigged model, blends its legs by speed, turns it to each shot
//  and plays the shooting, rolling and dying clips the rules ask for. After
//  the engine poses it each frame, this leans it back from the camera,
//  pins its hips over its spot, swells it on a level-up, knocks it back and
//  flashes it white on a hit, kicks it at each shot of the gun in its hands
//  and puts both hands on that gun. The gun in its hands is the first
//  weapon of the loadout, or with the Look panel's swap, whichever fired
//  last; the others float round it and turn to their own shots. A shot
//  flashes at its gun's muzzle and lights the floor. A dash leaves glowing
//  copies of its pose; the Prismatic echo copies its pose.

/** Seconds a muzzle's flash, and the floor's light, last. */
const flashSeconds = 0.07;
const floorLightSeconds = 0.12;
const ghostCount = 5;
/** Metres the spare guns float from the soldier, and how high. */
const orbitMetres = 0.85;
const orbitHeight = 1.05;

/** The bones the look turns or moves over the engine's pose, reached
 *  through the posed model each frame so the engine puts them back. */
const lookBones = [
    "Hips",
    "Spine01",
    "LeftShoulder",
    "RightArm",
    "RightForeArm",
    "RightHand",
    "LeftArm",
    "LeftForeArm",
    "LeftHand",
];

/** What the soldier's model wears: the matcap over each mesh's own
 *  texture, its colours turned by one hue for the look. */
export interface SoldierDress {
    /** The Player's `material`. */
    wear: ModelMaterial;
    /** Every material `wear` made, which a hit flashes white. */
    materials: MeshMatcapMaterial[];
    hue: HueTurn;
}

/** A new dress, with a bright rim or without. It makes each material as
 *  the Player asks for it, so a headless field makes none. */
export function createSoldierDress(rims: boolean): SoldierDress {
    const materials: MeshMatcapMaterial[] = [];
    const hue = { value: 0 };
    const wear = (original: Material) => {
        //  A glTF material is a MeshStandardMaterial, whose map is the
        //  file's base colour.
        const map = (original as { map?: Texture | null }).map ?? null;
        const made = createModelMaterial(rims, map);
        addHueTurn(made, hue);
        materials.push(made);
        return made;
    };
    return { wear, materials, hue };
}

export function listBones(root: Object3D) {
    const bones: Bone[] = [];
    root.traverse((node) => {
        if (node instanceof Bone) bones.push(node);
    });
    return bones;
}

/** A copy of the soldier the field draws itself: its root, its bones in
 *  the file's order, and its materials. */
export interface Body<Made extends Material = Material> {
    root: Object3D;
    bones: Bone[];
    materials: Made[];
}

/** A copy of `scene`, each mesh drawn in what `material` makes from the
 *  mesh's own texture. */
export function copyBody<Made extends Material>(
    scene: Object3D,
    material: (map: Texture | null) => Made,
): Body<Made> {
    const root = clone(scene);
    const materials: Made[] = [];
    root.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        //  A glTF material is a MeshStandardMaterial, whose map is the
        //  file's base colour.
        const made = material(
            (node.material as { map?: Texture | null }).map ?? null,
        );
        node.material = made;
        node.frustumCulled = false;
        materials.push(made);
    });
    return { root, bones: listBones(root), materials };
}

/** Poses `target` as `bones` stand now. */
export function copyPose(bones: Bone[], target: Body) {
    bones.forEach((bone, index) => {
        target.bones[index].position.copy(bone.position);
        target.bones[index].quaternion.copy(bone.quaternion);
    });
}

/** The engine's posed model as the look reads it: the body that holds the
 *  gun, its bones in the file's order, its hips, and the height the engine
 *  stood its root at. */
interface Rig extends HoldingBody {
    bones: Bone[];
    hips: Bone;
    standing: number;
}

function readRig({ root, bone }: PosedModel, armLength: number): Rig {
    const hips = bone("Hips");
    if (!hips) throw new Error("The soldier's rig has no Hips.");
    return {
        ...readHoldingBody(root, bone, armLength),
        bones: listBones(root),
        hips,
        standing: root.position.y,
    };
}

export function findGeometry(scene: Object3D) {
    let geometry: BufferGeometry | null = null;
    scene.traverse((node) => {
        if (!geometry && node instanceof Mesh) geometry = node.geometry;
    });
    if (!geometry) throw new Error("A gun's model holds no mesh.");
    return geometry;
}

/** A gun as drawn: the mesh, one unit long, and the flash at its muzzle. */
export interface Gun {
    group: Group;
    flash: Sprite;
}

export function buildGun(
    geometry: BufferGeometry,
    id: WeaponId,
    rims: boolean,
): Gun {
    const look = gunLooks[id];
    const material = createModelMaterial(rims);
    material.color.set(look.color);
    const mesh = new Mesh(geometry, material);
    const group = new Group();
    group.add(mesh);
    group.scale.setScalar(look.metres);
    group.visible = false;
    const flash = new Sprite(
        new SpriteMaterial({
            map: readGlowTexture(),
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        }),
    );
    liftNeon(look.glow, flash.material.color, 3);
    flash.position.set(0, 0.06, 1.02);
    flash.visible = false;
    group.add(flash);
    return { group, flash };
}

/** The last shot of one weapon: seconds since, and where at. */
interface LastShot {
    age: number;
    toX: number;
    toZ: number;
}

//  Written in place each frame.
const heroSpot = new Vector3();
const forward = new Vector3();
const offset = new Vector3();
const lean = new Quaternion();
const yawTurn = new Quaternion();
const heroTurn = new Quaternion();
const bodyTurn = new Quaternion();
const up = new Vector3(0, 1, 0);

/** The weapon the soldier's hands hold now. */
function readHandWeapon(
    run: RunState,
    spare: SpareGuns,
    shots: Map<WeaponId, LastShot>,
) {
    const first = run.loadout[0] ?? run.starter;
    if (spare === SpareGuns.Orbit) return first;
    let latest = first;
    let youngest = Infinity;
    for (const [weapon, shot] of shots)
        if (run.weapons[weapon].owned && shot.age < youngest) {
            youngest = shot.age;
            latest = weapon;
        }
    return latest;
}

/** A copy a dash left: where the soldier stood, and how long ago. */
export interface DashCopy {
    x: number;
    z: number;
    age: number;
}

/** What the soldier view keeps for its moves, shared with the sprite. */
export interface SoldierMoves {
    ghosts: DashCopy[];
    levelAge: number;
    recoilAge: number;
}

interface SoldierModelProps {
    hero: Entity;
    dress: SoldierDress;
    moves: SoldierMoves;
    /** Seconds a level-up's swell takes, and a hit's recoil. */
    levelUpSeconds: number;
    recoilSeconds: number;
    /** Seconds a dash's copy takes to fade. */
    ghostSeconds: number;
}

/** The soldier's look over the Player's model, drawn beside it in the
 *  hero's group: its guns, its echo, its dash's copies and the floor's
 *  light. */
export function SoldierModel({
    hero,
    dress,
    moves,
    levelUpSeconds,
    recoilSeconds,
    ghostSeconds,
}: SoldierModelProps) {
    const world = useWorld();
    const rims = useLook((look) => look.rims);
    const { scene } = useModel(soldierModel);
    const gunModels = useModel(gunUrls);
    const armLength = useMemo(
        () => measureArmLength(scene, soldierScale),
        [scene],
    );
    //  Where the hips stand in the file's rest pose, which the shared file
    //  keeps: the engine poses copies of it.
    const hipsRest = useMemo(
        () => scene.getObjectByName("Hips")?.position.clone() ?? new Vector3(),
        [scene],
    );
    const echo = useMemo(
        () =>
            copyBody(scene, (map) => {
                const material = createModelMaterial(rims, map);
                material.color.set("#abd9ff");
                return material;
            }),
        [scene, rims],
    );
    const ghosts = useMemo(
        () =>
            Array.from({ length: ghostCount }, () =>
                copyBody(
                    scene,
                    () =>
                        new MeshBasicMaterial({
                            transparent: true,
                            blending: AdditiveBlending,
                            depthWrite: false,
                            toneMapped: false,
                        }),
                ),
            ),
        [scene],
    );
    const guns = useMemo(() => {
        const hands = new Map<WeaponId, Gun>();
        const spares = new Map<WeaponId, Gun>();
        weaponIds.forEach((id, index) => {
            const geometry = findGeometry(gunModels[index].scene);
            hands.set(id, buildGun(geometry, id, rims));
            spares.set(id, buildGun(geometry, id, rims));
        });
        return { hands, spares };
    }, [gunModels, rims]);
    const floorLight = useMemo(
        () =>
            new Mesh(
                new CircleGeometry(1.5, 32),
                new MeshBasicMaterial({
                    map: readGlowTexture(),
                    transparent: true,
                    blending: AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false,
                }),
            ),
        [],
    );
    useEffect(
        () => () => {
            for (const body of [echo, ...ghosts])
                for (const material of body.materials) material.dispose();
        },
        [echo, ghosts],
    );
    useEffect(
        () => () => {
            for (const gun of [...guns.hands.values(), ...guns.spares.values()])
                gun.group.traverse((node) => {
                    if (node instanceof Mesh || node instanceof Sprite)
                        node.material.dispose();
                });
        },
        [guns],
    );
    const groupRef = useRef<Group>(null);
    const state = useMemo(
        () => ({
            rig: null as Rig | null,
            shots: new Map<WeaponId, LastShot>(),
            echoShot: null as LastShot | null,
            ghostOf: new Map<DashCopy, Body<MeshBasicMaterial>>(),
            nextGhost: 0,
            lastGhost: null as DashCopy | null,
            floorAge: floorLightSeconds,
            floorColor: "#ffffff",
            kick: 0,
            /** How far the gun is raised, from 0 at rest to 1 aiming. */
            ready: 0,
            /** Seconds the spare guns have floated. */
            orbitSeconds: 0,
        }),
        [],
    );
    //  The look as the last frame left it, for a check that reads it.
    useInspect("soldier pose", () => ({
        kick: state.kick,
        ready: state.ready,
        handMiss: state.rig && readHandMiss(state.rig),
        shotAges: Object.fromEntries(
            [...state.shots].map(([weapon, shot]) => [weapon, shot.age]),
        ),
    }));
    useEventRecords(
        ShotsTrait,
        (entity) => entity.get(ShotsTrait)?.list,
        (shot) => {
            const last = { age: 0, toX: shot.toX, toZ: shot.toZ };
            if (shot.owner === Shooter.Echo) {
                state.echoShot = last;
                return;
            }
            state.shots.set(shot.weapon, last);
            if (useLook.getState().muzzle === MuzzleLook.FlashAndLight) {
                state.floorAge = 0;
                state.floorColor = gunLooks[shot.weapon].glow;
            }
        },
    );

    useAfterPose(hero, (posed, delta) => {
        const run = findRun(world);
        const group = groupRef.current;
        if (!run || !group?.parent) return;
        if (state.rig?.root !== posed.root)
            state.rig = readRig(posed, armLength);
        const rig = state.rig;
        //  Reached each frame, so the engine puts back what the look moves.
        for (const name of lookBones) posed.bone(name);
        const look = useLook.getState();
        for (const shot of state.shots.values()) shot.age += delta;
        if (state.echoShot) state.echoShot.age += delta;

        //  This group stands at the hero in the world's axes; the hero's
        //  group turns to its facing, along its -z.
        group.parent.updateWorldMatrix(true, false);
        group.parent.getWorldQuaternion(heroTurn);
        group.quaternion.copy(heroTurn).invert();
        group.updateMatrixWorld(true);
        group.getWorldPosition(heroSpot);
        forward.set(0, 0, -1).applyQuaternion(heroTurn);
        const yaw = Math.atan2(forward.x, forward.z);

        const dying =
            run.phase === RunPhase.Dying || run.phase === RunPhase.Defeated;
        const handWeapon = readHandWeapon(run, look.spareGuns, state.shots);
        const handShot = state.shots.get(handWeapon);
        const held = dying || isRolling(run) ? 0 : 1;
        const aiming = hero.get(AimPointTrait)?.active === true;
        state.ready +=
            ((aiming ? 1 : 0) - state.ready) * (1 - Math.exp(-delta * 14));
        //  The hand gun's last shot kicks the soldier: its body jolts back and
        //  squashes, its chest rocks back, and the gun slides back and lifts,
        //  the hands following it.
        const kick = handShot
            ? readGunKick(handWeapon, handShot.age) * held
            : 0;
        state.kick = kick;

        //  Its lean, a level-up's swell, a hit's knock back and a shot's
        //  kick, laid over the engine's turn; its hips held over its spot,
        //  where the rig's clips walk and roll forward.
        readLeanTurn(look.lean, lean);
        yawTurn.setFromAxisAngle(up, yaw);
        bodyTurn.copy(lean).multiply(yawTurn);
        const { root } = rig;
        root.quaternion.copy(group.quaternion).multiply(bodyTurn);
        const swell =
            moves.levelAge < levelUpSeconds
                ? Math.sin((Math.PI * moves.levelAge) / levelUpSeconds) * 0.25
                : 0;
        const recoil = Math.max(0, 1 - moves.recoilAge / recoilSeconds);
        root.scale.set(
            soldierScale * (1 + swell + recoil * 0.1 + kick * 0.06),
            soldierScale * (1 + swell - recoil * 0.12 - kick * 0.08),
            soldierScale * (1 + swell + recoil * 0.1 + kick * 0.06),
        );
        offset
            .set(
                -run.faceX * 0.3 * recoil - Math.sin(yaw) * kick * 0.1,
                0,
                -run.faceZ * 0.3 * recoil - Math.cos(yaw) * kick * 0.1,
            )
            .applyQuaternion(group.quaternion);
        root.position.set(offset.x, rig.standing, offset.z);
        rig.hips.position.x = hipsRest.x;
        rig.hips.position.z = hipsRest.z;
        root.updateMatrixWorld(true);
        for (const material of dress.materials)
            if (recoil > 0.5 || run.invul > 0.9)
                liftNeon("#ffffff", material.color, 1.6);
            else material.color.set("#ffffff");
        dress.hue.value = readLookTurn(run.look);

        //  The gun held at its chest along its aim, both hands reaching for
        //  it; in a roll it rides the right hand, which the roll swings.
        for (const [id, gun] of guns.hands) {
            gun.group.visible = id === handWeapon && !dying;
            if (!gun.group.visible) continue;
            holdGunInHands({
                body: rig,
                gun: gun.group,
                weapon: id,
                ready: state.ready,
                held,
                facing: bodyTurn,
                kick,
            });
            showFlash(gun, state.shots.get(id), look.muzzle);
        }

        //  The spare guns, floating round it, each turned to its shots.
        state.orbitSeconds += delta;
        const owned = run.loadout.filter(
            (id) => id !== handWeapon && run.weapons[id].owned,
        );
        let slot = 0;
        for (const [id, gun] of guns.spares) {
            const place = owned.indexOf(id);
            gun.group.visible =
                look.spareGuns === SpareGuns.Orbit && place >= 0 && !dying;
            if (!gun.group.visible) continue;
            const angle =
                state.orbitSeconds * 0.7 +
                (slot++ / owned.length) * Math.PI * 2;
            const shot = state.shots.get(id);
            const gunYaw =
                shot && shot.age < aimSeconds
                    ? Math.atan2(shot.toX - heroSpot.x, shot.toZ - heroSpot.z)
                    : yaw;
            const kick = shot ? Math.max(0, 1 - shot.age / 0.12) * 0.15 : 0;
            gun.group.position.set(
                Math.sin(angle) * orbitMetres - Math.sin(gunYaw) * kick,
                orbitHeight + Math.sin(state.orbitSeconds * 2.4 + slot) * 0.06,
                Math.cos(angle) * orbitMetres - Math.cos(gunYaw) * kick,
            );
            gun.group.quaternion.setFromAxisAngle(up, gunYaw).premultiply(lean);
            showFlash(gun, shot, look.muzzle);
        }

        //  The floor's light round it as a shot fires.
        state.floorAge += delta;
        floorLight.visible = state.floorAge < floorLightSeconds;
        if (floorLight.visible) {
            const material = floorLight.material;
            material.color.set(state.floorColor);
            material.opacity = 0.2 * (1 - state.floorAge / floorLightSeconds);
        }

        //  The dash's copies, each in the pose it left.
        const newest = moves.ghosts[0];
        if (
            newest &&
            newest !== state.lastGhost &&
            look.dash !== DashLook.Roll
        ) {
            const body = ghosts[state.nextGhost++ % ghostCount];
            copyPose(rig.bones, body);
            body.root.quaternion.copy(bodyTurn);
            body.root.scale.copy(root.scale);
            state.ghostOf.set(newest, body);
        }
        state.lastGhost = newest ?? null;
        const glow = findLook(run.look).color;
        for (const body of ghosts) body.root.visible = false;
        for (const ghost of moves.ghosts) {
            const body = state.ghostOf.get(ghost);
            if (!body || ghost.age >= ghostSeconds) continue;
            body.root.visible = true;
            body.root.position.set(
                ghost.x - heroSpot.x,
                rig.standing,
                ghost.z - heroSpot.z,
            );
            for (const material of body.materials) {
                liftNeon(glow, material.color, 1.2);
                material.opacity = 0.45 * (1 - ghost.age / ghostSeconds);
            }
        }
        for (const ghost of state.ghostOf.keys())
            if (!moves.ghosts.includes(ghost)) state.ghostOf.delete(ghost);

        //  The Prismatic echo: its pose, turned to its own shots.
        echo.root.visible = run.hasTwin;
        if (run.hasTwin) {
            copyPose(rig.bones, echo);
            const echoYaw =
                state.echoShot && state.echoShot.age < aimSeconds
                    ? Math.atan2(
                          state.echoShot.toX - heroSpot.x - echoOffsetX,
                          state.echoShot.toZ - heroSpot.z - echoOffsetZ,
                      )
                    : yaw;
            yawTurn.setFromAxisAngle(up, echoYaw);
            echo.root.quaternion.copy(lean).multiply(yawTurn);
            echo.root.scale.setScalar(soldierScale);
            echo.root.position.set(echoOffsetX, rig.standing, echoOffsetZ);
        }
    });

    return (
        <group ref={groupRef}>
            <primitive object={echo.root} />
            {ghosts.map((body, index) => (
                <primitive key={index} object={body.root} />
            ))}
            {[...guns.hands.values(), ...guns.spares.values()].map(
                (gun, index) => (
                    <primitive key={index} object={gun.group} />
                ),
            )}
            <primitive
                object={floorLight}
                rotation-x={-Math.PI / 2}
                position-y={0.05}
            />
        </group>
    );
}

/** Shows `gun`'s muzzle flash for a moment after its shot. */
function showFlash(gun: Gun, shot: LastShot | undefined, muzzle: MuzzleLook) {
    const age = shot?.age ?? Infinity;
    gun.flash.visible = muzzle !== MuzzleLook.Off && age < flashSeconds;
    if (!gun.flash.visible) return;
    const size = (0.55 * (1 - age / flashSeconds) + 0.25) / gun.group.scale.x;
    gun.flash.scale.setScalar(size);
}
