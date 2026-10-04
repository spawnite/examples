import blasterModel from "@spawnite/assets/models/holdfast/blaster.glb?url";
import railModel from "@spawnite/assets/models/holdfast/rail.glb?url";
import scattergunModel from "@spawnite/assets/models/holdfast/scattergun.glb?url";
import { Clone } from "@react-three/drei";
import { readWeaponNumber, useModel, WeaponNumber } from "@spawnite/engine";
import type { Entity } from "koota";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    BoxGeometry,
    Color,
    CylinderGeometry,
    MeshBasicMaterial,
    PlaneGeometry,
    TorusGeometry,
    Vector3,
    type Group,
    type Object3D,
} from "three";
import { GunId, guns } from "../../siege/guns";
import { emitGlow, emitSparks } from "../effects/EffectPools";
import { readStarTexture } from "../glowTexture";
import {
    findMuzzle,
    findMuzzleAim,
    holdMuzzle,
    measureSinceShot,
} from "./muzzles";

//  The gun from the fire's rack in a warden's hand, in its own frame: the
//  grip at the origin, the barrel toward negative z, up positive y. Each
//  kicks back at each of her shots, as hard as the gun is heavy, and
//  flashes at its muzzles; its muzzle rings glow in her colour and heat up
//  while she fires; a band of light round the barrel for each upgrade tier
//  says how far she has raised it, gold at the top, and flares as she buys
//  one; and at rest it breathes in her hand. A gun she takes up swings up
//  into her hands. Each gun has its own beat between shots: the
//  scattergun racks a pump, and the rail's rings drain at each shot and
//  fill again as it charges, with a flash as it is ready, as Destiny's
//  heavy guns telegraph their charge.

/** How one gun is drawn and how it moves: its model, its size in her
 *  hand, where its grip and its barrels' ends are in the model's own
 *  units, measured off the file's vertices, its rings' radius, its vents,
 *  and its kick. */
interface GunLook {
    model: string;
    scale: number;
    grip: Vector3;
    /** Each barrel's end; the first is where her shots leave from, unless
     *  `muzzle` names another point between them. */
    barrels: Vector3[];
    muzzle?: Vector3;
    ringRadius: number;
    /** A glowing vent down each side of the body, where it has them. */
    vents?: { height: number; centre: number; side: number; length: number };
    /** Metres it slides back, radians it lifts, and seconds it settles. */
    kick: { back: number; lift: number; seconds: number };
    /** How hot one shot makes it, as a share of what is left to full. */
    heatPerShot: number;
    /** Metres across its muzzle flash. */
    flashSize: number;
    /** Radians her arms lift with each shot, on top of the gun's own. */
    bodyLift: number;
    /** What its muzzle throws at each shot beside the flash: sparks
     *  forward, a ring of heat, or nothing. */
    burst?: MuzzleBurst;
    /** Its beat between shots, where it has one. */
    beat?: GunBeat;
}

/** What a muzzle throws at each shot. */
enum MuzzleBurst {
    /** A spray of sparks along the cone its pellets fly in. */
    Sparks = "sparks",
    /** A ring of heat that swells off the muzzle. */
    Ring = "ring",
}

/** A gun's beat between shots. */
enum GunBeat {
    /** A pump racked back and forward, part way through its cycle. */
    Pump = "pump",
    /** Its rings drained at each shot and filled as it charges. */
    Charge = "charge",
}

const looks: Record<GunId, GunLook> = {
    //  Kenney's blaster-d: a long rifle.
    [GunId.Blaster]: {
        model: blasterModel,
        scale: 0.85,
        grip: new Vector3(0, -0.09, 0.16),
        barrels: [new Vector3(0, 0.057, -0.454)],
        ringRadius: 0.044,
        vents: { height: 0.12, centre: -0.16, side: 0.083, length: 0.36 },
        kick: { back: 0.07, lift: 0.25, seconds: 0.12 },
        heatPerShot: 0.3,
        flashSize: 0.22,
        bodyLift: 0.025,
    },
    //  Kenney's blaster-l: two short, broad barrels side by side.
    [GunId.Scattergun]: {
        model: scattergunModel,
        scale: 0.95,
        grip: new Vector3(0, -0.1, 0.19),
        barrels: [
            new Vector3(-0.08, 0.039, -0.275),
            new Vector3(0.08, 0.039, -0.275),
        ],
        muzzle: new Vector3(0, 0.039, -0.275),
        ringRadius: 0.04,
        kick: { back: 0.13, lift: 0.5, seconds: 0.26 },
        heatPerShot: 0.85,
        flashSize: 0.38,
        bodyLift: 0.12,
        burst: MuzzleBurst.Sparks,
        beat: GunBeat.Pump,
    },
    //  Kenney's blaster-f: a long rifle with a scope.
    [GunId.Rail]: {
        model: railModel,
        scale: 0.8,
        grip: new Vector3(0, -0.08, 0.36),
        barrels: [new Vector3(0, 0.052, -0.655)],
        ringRadius: 0.05,
        kick: { back: 0.16, lift: 0.3, seconds: 0.34 },
        heatPerShot: 1,
        flashSize: 0.42,
        bodyLift: 0.14,
        burst: MuzzleBurst.Ring,
        beat: GunBeat.Charge,
    },
};

/** Seconds a shot's flash stands. */
const flashSeconds = 0.06;
/** Seconds the barrel takes to cool from full. */
const coolSeconds = 0.6;
/** How bright the rings and the vents burn cold and at full heat: above 1
 *  blooms. */
const ringGlow = { cold: 1.3, hot: 4.5 };
const ventGlow = { cold: 0.45, hot: 4 };
/** How bright a tier's band burns, and the top tier's gold. */
const bandGlow = 2.2;
const topBand = new Color("#ffe3a0").multiplyScalar(3);
/** Metres behind the muzzle each tier's band sits, in model units. */
const bandStep = 0.045;
/** The idle sway's reach: metres of bob and radians of tilt at the grip. */
const swayBob = 0.003;
const swayTilt = 0.012;

/** Seconds a gun she takes up takes to swing into her hands, and how far
 *  below and pointed down it starts. */
const drawSeconds = 0.32;
const drawDrop = 0.14;
const drawTilt = 0.9;
/** Seconds a band she buys flares, and how bright it burns at the start. */
const flareSeconds = 0.7;
const flareGlow = 5;
/** The pump's rack: where in the cycle it starts and ends, as shares of
 *  it, and how far back and how far round it goes. */
const pump = { from: 0.28, to: 0.62, back: 0.06, roll: 0.35 };
/** The rail's charge: its rings' glow drained and full, and the ready
 *  flash's seconds and glow. */
const charge = { drained: 0.25, readySeconds: 0.18, readyGlow: 5 };
/** Seconds a shot's arm lift takes to settle, times the gun's kick. */
const liftSettle = 1.6;

/** A share eased out, fast then slow, overshooting a hair before it
 *  settles, as a hand swings a weight into place. */
function easeOutBack(share: number) {
    const overshoot = 1.4;
    const t = share - 1;
    return 1 + (overshoot + 1) * t * t * t + overshoot * t * t;
}

/** Radians her arms lift, on top of her aim, `since` seconds after a shot
 *  of `gun`: out fast and back slow, as the gun's own kick. */
export function measureBodyLift(gun: GunId, since: number) {
    const look = looks[gun];
    const settle = Math.max(0, 1 - since / (look.kick.seconds * liftSettle));
    return settle * settle * look.bodyLift;
}

//  Written in place for each shot's burst.
const burstAt = new Vector3();
const burstToward = new Vector3();

const flashGeometry = new PlaneGeometry(1, 1);
const sleeveGeometry = new CylinderGeometry(1.18, 1.14, 2.2, 16, 1, true);
sleeveGeometry.rotateX(Math.PI / 2);

interface GunProps {
    /** The warden who holds it, whose stats set the rail's charge. */
    entity: Entity;
    gun: GunId;
    /** Its upgrade tier, 0 to 3: a band of light for each. */
    tier: number;
    hue: number;
    color: string;
}

export function Gun({ entity, gun, tier, hue, color }: GunProps) {
    const look = looks[gun];
    const drawRef = useRef<Group>(null);
    const beatRef = useRef<Group>(null);
    const kickRef = useRef<Group>(null);
    //  Seconds on the frame clock it was taken up and its last band
    //  bought, set on the first frame; and the tier it last drew.
    const takenRef = useRef({ at: -1, flaredAt: -Infinity, tier });
    const flashRef = useRef<Group>(null);
    const muzzleRef = useRef<Object3D>(null);
    const swayRef = useRef<Group>(null);
    const heatRef = useRef({ heat: 0, since: Infinity });
    const shapes = useMemo(
        () => ({
            ring: new TorusGeometry(look.ringRadius, 0.009, 8, 24),
            band: new TorusGeometry(look.ringRadius * 1.25, 0.006, 6, 24),
            vent: look.vents
                ? new BoxGeometry(0.006, 0.014, look.vents.length)
                : undefined,
        }),
        [look],
    );
    useLayoutEffect(
        () => () => {
            shapes.ring.dispose();
            shapes.band.dispose();
            shapes.vent?.dispose();
        },
        [shapes],
    );
    const glow = useMemo(() => {
        //  Short of her colour's full saturation, so the look's grade keeps
        //  every channel.
        const base = new Color(color).lerp(new Color("#fff0d8"), 0.25);
        const glowing = (tint = base) =>
            new MeshBasicMaterial({ color: tint.clone(), toneMapped: false });
        return {
            base,
            ring: glowing(),
            vent: glowing(),
            band: glowing(base.clone().multiplyScalar(bandGlow)),
            top: glowing(topBand),
            sleeve: new MeshBasicMaterial({
                color: base.clone(),
                transparent: true,
                opacity: 0,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        };
    }, [color]);
    useLayoutEffect(
        () => () => {
            for (const material of Object.values(glow))
                if (material instanceof MeshBasicMaterial) material.dispose();
        },
        [glow],
    );
    const flash = useMemo(
        () =>
            new MeshBasicMaterial({
                map: readStarTexture(),
                color: new Color(color).lerp(new Color("#fff8e0"), 0.6),
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        [color],
    );
    useLayoutEffect(() => () => flash.dispose(), [flash]);
    useLayoutEffect(() => {
        const muzzle = muzzleRef.current;
        return muzzle ? holdMuzzle(hue, muzzle) : undefined;
    }, [hue, gun]);
    const placed = useMemo(() => {
        const muzzle = (look.muzzle ?? look.barrels[0])
            .clone()
            .sub(look.grip)
            .multiplyScalar(look.scale);
        return {
            model: look.grip.clone().multiplyScalar(-look.scale),
            muzzle,
            flash: muzzle.clone().add(new Vector3(0, 0, -0.08)),
        };
    }, [look]);

    useFrame(({ clock }, delta) => {
        const now = clock.elapsedTime;
        const since = measureSinceShot(hue);
        const barrel = heatRef.current;
        barrel.heat = Math.max(0, barrel.heat - delta / coolSeconds);
        const fired = since < barrel.since;
        if (fired) barrel.heat += (1 - barrel.heat) * look.heatPerShot;
        barrel.since = since;
        const heat = barrel.heat;
        if (fired && since < 0.1) throwBurst();
        //  Taken up: it swings up into her hands.
        const taken = takenRef.current;
        if (taken.at < 0) taken.at = now;
        if (tier > taken.tier) taken.flaredAt = now;
        taken.tier = tier;
        const draw = drawRef.current;
        if (draw) {
            const share = Math.min(1, (now - taken.at) / drawSeconds);
            const rest = 1 - easeOutBack(share);
            draw.position.y = -drawDrop * rest;
            draw.rotation.x = -drawTilt * rest;
        }
        //  Its beat between shots, over the cycle its rate gives it.
        const cycle =
            1 /
            readWeaponNumber(
                guns[gun].settings,
                entity,
                WeaponNumber.ShotsPerSecond,
            );
        const beat = beatRef.current;
        let charged = 1;
        let ready = 0;
        if (look.beat === GunBeat.Pump && beat) {
            const share = (since / cycle - pump.from) / (pump.to - pump.from);
            const rack = share > 0 && share < 1 ? Math.sin(share * Math.PI) : 0;
            beat.position.z = rack * pump.back;
            beat.rotation.z = rack * pump.roll;
        }
        if (look.beat === GunBeat.Charge) {
            charged = Math.min(1, since / cycle);
            const sinceReady = since - cycle;
            ready =
                sinceReady >= 0 && sinceReady < charge.readySeconds
                    ? 1 - sinceReady / charge.readySeconds
                    : 0;
        }
        const drained = charge.drained + (1 - charge.drained) * charged;
        glow.ring.color
            .copy(glow.base)
            .multiplyScalar(
                (ringGlow.cold + (ringGlow.hot - ringGlow.cold) * heat) *
                    drained +
                    charge.readyGlow * ready,
            );
        //  A band she just bought flares, and settles to its glow.
        const flare = Math.max(0, 1 - (now - taken.flaredAt) / flareSeconds);
        glow.band.color
            .copy(glow.base)
            .multiplyScalar(bandGlow * (1 + flareGlow * flare * flare));
        glow.top.color
            .copy(topBand)
            .multiplyScalar(1 + flareGlow * flare * flare);
        glow.vent.color
            .copy(glow.base)
            .multiplyScalar(
                ventGlow.cold + (ventGlow.hot - ventGlow.cold) * heat,
            );
        glow.sleeve.opacity = Math.min(1, heat * 0.8 + flare * 0.8);
        const sway = swayRef.current;
        if (sway) {
            //  Stiller while she fires, so the kick reads alone.
            const reach = 1 - heat;
            const time = clock.elapsedTime + hue * 1.7;
            sway.position.y = Math.sin(time * 1.3) * swayBob * reach;
            sway.rotation.x = Math.sin(time * 1.1) * swayTilt * reach;
            sway.rotation.z = Math.sin(time * 0.7) * swayTilt * reach;
        }
        //  Out fast and back slow, so a heavy gun's shot reads as a blow.
        const settle = Math.max(0, 1 - since / look.kick.seconds);
        const kick = settle * settle;
        const group = kickRef.current;
        if (group) {
            group.position.z = kick * look.kick.back;
            group.rotation.x = kick * look.kick.lift;
        }
        const flashGroup = flashRef.current;
        if (flashGroup) {
            const showing = since < flashSeconds;
            flashGroup.visible = showing;
            if (showing) {
                flashGroup.rotation.z = Math.random() * Math.PI;
                flashGroup.scale.setScalar(
                    look.flashSize * (1 + Math.random() * 0.5),
                );
                flash.opacity = 1 - since / flashSeconds;
            }
        }
    });

    /** What its muzzle throws as a shot leaves it, beside the flash. */
    function throwBurst() {
        if (
            !look.burst ||
            !findMuzzle(hue, burstAt) ||
            !findMuzzleAim(hue, burstToward)
        )
            return;
        const heat = glow.base.clone().lerp(new Color("#ffffff"), 0.5);
        if (look.burst === MuzzleBurst.Sparks) {
            emitSparks({
                position: burstAt,
                color: heat.multiplyScalar(3),
                count: 9,
                speed: 14,
                toward: burstToward,
                spread: 0.3,
                seconds: 0.16,
                width: 0.035,
            });
            return;
        }
        emitGlow({
            position: burstAt.addScaledVector(burstToward, 0.15),
            color: heat.multiplyScalar(2.2),
            seconds: 0.22,
            size: 0.25,
            endSize: 1.1,
        });
    }

    return (
        <group ref={drawRef}>
            <group ref={kickRef}>
                <group ref={beatRef}>
                    <group ref={swayRef}>
                        <group scale={look.scale} position={placed.model}>
                            <Clone
                                object={useModel(look.model).scene}
                                castShadow
                            />
                            {look.barrels.map((barrel) => (
                                <group key={`${barrel.x}`} position={barrel}>
                                    <mesh
                                        geometry={shapes.ring}
                                        material={glow.ring}
                                    />
                                    <mesh
                                        geometry={sleeveGeometry}
                                        material={glow.sleeve}
                                        scale={look.ringRadius}
                                        position-z={look.ringRadius * 1.2}
                                    />
                                    {Array.from(
                                        { length: tier },
                                        (_, index) => (
                                            <mesh
                                                key={index}
                                                geometry={shapes.band}
                                                material={
                                                    index === 2
                                                        ? glow.top
                                                        : glow.band
                                                }
                                                position-z={
                                                    bandStep * (index + 1.5)
                                                }
                                            />
                                        ),
                                    )}
                                </group>
                            ))}
                            {look.vents && shapes.vent && (
                                <>
                                    <mesh
                                        geometry={shapes.vent}
                                        material={glow.vent}
                                        position={[
                                            look.vents.side,
                                            look.vents.height,
                                            look.vents.centre,
                                        ]}
                                    />
                                    <mesh
                                        geometry={shapes.vent}
                                        material={glow.vent}
                                        position={[
                                            -look.vents.side,
                                            look.vents.height,
                                            look.vents.centre,
                                        ]}
                                    />
                                </>
                            )}
                        </group>
                        {/*  In the sway, so the shot and the flash leave the barrel
                    as it sways. */}
                        <object3D ref={muzzleRef} position={placed.muzzle} />
                        <group
                            ref={flashRef}
                            position={placed.flash}
                            visible={false}
                        >
                            {/*  Three crossed quads read as a star from any side. */}
                            <mesh geometry={flashGeometry} material={flash} />
                            <mesh
                                geometry={flashGeometry}
                                material={flash}
                                rotation-y={Math.PI / 2}
                            />
                            <mesh
                                geometry={flashGeometry}
                                material={flash}
                                rotation-x={Math.PI / 2}
                            />
                        </group>
                    </group>
                </group>
            </group>
        </group>
    );
}

/** The model of `gun`, to draw it anywhere the scene shows it. */
export function readGunModel(gun: GunId) {
    return looks[gun].model;
}

for (const look of Object.values(looks)) useModel.preload(look.model);
