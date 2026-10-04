import { createPortal, useFrame, useThree } from "@react-three/fiber";
import type { Entity } from "koota";
import { useHas, useQueryFirst, useTrait } from "koota/react";
import {
    Suspense,
    useLayoutEffect,
    useMemo,
    useRef,
    type ReactNode,
} from "react";
import { VRMHumanBoneName, type VRM } from "@pixiv/three-vrm";
import {
    AdditiveBlending,
    MathUtils,
    Quaternion,
    RingGeometry,
    Vector3,
} from "three";
import {
    GroundTrait,
    type GroundSurface,
    HeroAnimationView,
    isPlayerHero,
    ObstaclesTrait,
    VrmView,
} from "@spawnite/engine";
import { GunId, isGunId } from "../siege/guns";
import { isReadyAsked } from "../siege/gathering";
import { SiegeTrait, WardenGunTrait, WardenTrait } from "../siege/traits";
import { createWardenBody } from "./avatars";
import { readGlowTexture } from "./glowTexture";
import { readWardenColor } from "./palette";
import { Gun, measureBodyLift } from "./warden/Gun";
import { holdBlaster } from "./warden/aimPose";
import { addLatePose } from "./warden/latePoses";
import { measureSinceShot, settleMuzzle } from "./warden/muzzles";
import {
    layBody,
    measureGround,
    readChestRise,
    readHeadRise,
    type GroundUnder,
} from "./warden/lying";
import { LifeMachine } from "../siege/life";
import { usePhase } from "./phase";

//  A warden: an avatar playing the engine's clips, with her right arm held
//  out along her aim and her gun in that hand, a ring of her colour at
//  her feet so two players tell each other apart across the circle, and
//  down on the ground while she is down, lying along its slope, sat up from
//  the hips and still firing over her feet.

const ringGeometry = new RingGeometry(0.42, 0.56, 40);
/** The ring's strength, and her own page's while the ready ring is lit. */
const ringOpacity = 0.8;
const quietRingOpacity = 0.25;

/** Radians a downed warden's upper body sits up from where she lies. */
const downedLean = 1.15;

//  Written in place each frame.
const looking = new Vector3();

/** Each body's turn as the model rests, read before she first lies down:
 *  the loader hands one live VRM per body, which outlives a view. */
const restTurns = new WeakMap<VRM, Quaternion>();

function readRestTurn(vrm: VRM) {
    let rest = restTurns.get(vrm);
    if (!rest) {
        rest = vrm.scene.quaternion.clone();
        restTurns.set(vrm, rest);
    }
    return rest;
}

interface WardenRigProps {
    entity: Entity;
    vrm: VRM;
    hue: number;
    down: boolean;
    ground: GroundSurface | undefined;
}

/** Her two-handed hold on her gun, laid over the clips just before each
 *  draw, her fall, and the gun from the rack she holds in her hand. */
export function WardenRig({ entity, vrm, hue, down, ground }: WardenRigProps) {
    const held = useTrait(entity, WardenGunTrait);
    const gun = held && isGunId(held.gun) ? held.gun : GunId.Blaster;
    const { humanoid } = vrm;
    const hand = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightHand);
    //  A VRM 0.x body faces the other way in its own frame, so its right arm
    //  rests along positive x and forward is negative z.
    const side = vrm.meta.metaVersion === "0" ? 1 : -1;
    const own = isPlayerHero(entity);
    //  The late pose reads the gun she holds now, without a new pose.
    const gunRef = useRef(gun);
    gunRef.current = gun;

    const camera = useThree((state) => state.camera);
    const rest = readRestTurn(vrm);
    //  How far down she is, from 0 standing to 1 lying, and the ground
    //  under her there. One already down as her view mounts, as a join or
    //  a replay's seek finds her, lies there at once.
    const lyingRef = useRef<GroundUnder & { down: number }>({
        down: down ? 1 : 0,
        normal: new Vector3(0, 1, 0),
        lift: 0,
    });
    useLayoutEffect(() => {
        const upperBody = [
            humanoid.getRawBoneNode(VRMHumanBoneName.Spine),
            humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine),
        ];
        return addLatePose(() => {
            //  Her own page knows where she aims up or down, as far as the
            //  camera's stops let her look; another's holds the gun level.
            const aim = own
                ? Math.asin(camera.getWorldDirection(looking).y)
                : 0;
            //  Down, she lies on her back with her feet toward her aim, so
            //  level is as far below her body's as her chest faces above
            //  it, a quarter turn on flat ground, and she sits up to hold
            //  the gun there: as high whatever the slope, so less where the
            //  ground behind her already raises her head.
            //  Each shot lifts her arms with the gun, a heavy gun's most.
            const lift = measureBodyLift(gunRef.current, measureSinceShot(hue));
            holdBlaster(vrm, {
                pitch: aim - readChestRise(vrm.scene, rest) + lift,
                lean: MathUtils.clamp(
                    downedLean * lyingRef.current.down -
                        readHeadRise(vrm.scene, rest),
                    0,
                    Math.PI / 2,
                ),
            });
            humanoid.update();
            //  The renderer reads the bones' world matrices next, and the
            //  gun hangs from the normalized hand.
            for (const bone of upperBody) bone?.updateMatrixWorld(true);
            //  Her shots leave the barrel as this draw holds it.
            const place = vrm.scene.parent;
            if (place) settleMuzzle(hue, place);
        });
    }, [camera, hue, humanoid, own, rest, vrm]);

    useFrame((_state, delta) => {
        //  Down, she lies on her back along the ground; up, she stands.
        const lying = lyingRef.current;
        lying.down = MathUtils.damp(lying.down, down ? 1 : 0, 8, delta);
        const place = vrm.scene.parent;
        if (lying.down > 1e-3 && ground && place)
            measureGround(ground, place, lying);
        layBody(vrm.scene, { rest, ground: lying, down: lying.down });
    });

    const color = readWardenColor(hue);
    //  Her own ring steps back while the green ready ring is lit, so the
    //  ring the banner names is the brightest one on her screen.
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = usePhase();
    const quiet = own && isReadyAsked(phase, siege?.wave ?? 0);
    return (
        <>
            {hand &&
                createPortal(
                    //  The hand's frame: her arm runs along x, toward the
                    //  barrel once the arm is out, with up along y.
                    <group
                        position={[side * 0.06, -0.02, 0]}
                        rotation-y={(-side * Math.PI) / 2}
                    >
                        <Gun
                            key={gun}
                            entity={entity}
                            gun={gun}
                            tier={held?.tier ?? 0}
                            hue={hue}
                            color={color}
                        />
                    </group>,
                    hand,
                )}
            <mesh
                geometry={ringGeometry}
                rotation-x={-Math.PI / 2}
                position-y={0.04}
            >
                <meshBasicMaterial
                    color={color}
                    alphaMap={readGlowTexture()}
                    transparent
                    opacity={quiet ? quietRingOpacity : ringOpacity}
                    blending={AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
        </>
    );
}

interface WardenViewProps {
    entity: Entity;
    /** Drawn inside her body, so it follows her: what hangs over her. */
    children?: ReactNode;
}

function WardenBody({ entity, children }: WardenViewProps) {
    const survivor = useTrait(entity, WardenTrait);
    const hue = survivor?.hue ?? 0;
    const down = useHas(entity, LifeMachine.is.down);
    const body = useMemo(() => createWardenBody(hue), [hue]);
    const ground = useTrait(useQueryFirst(GroundTrait), GroundTrait);
    const obstacles = useTrait(useQueryFirst(ObstaclesTrait), ObstaclesTrait);
    return (
        <VrmView
            entity={entity}
            body={body}
            ground={ground?.surface}
            obstacles={obstacles?.bvh}
        >
            {({ vrm }) => (
                <>
                    <HeroAnimationView
                        entity={entity}
                        vrm={vrm}
                        armSpread={body.armSpread}
                    />
                    <WardenRig
                        entity={entity}
                        vrm={vrm}
                        hue={hue}
                        down={down}
                        ground={ground?.surface}
                    />
                    {children}
                </>
            )}
        </VrmView>
    );
}

/** Her own boundary, so a body still loading hides nothing else. */
export function WardenView(props: WardenViewProps) {
    return (
        <Suspense fallback={null}>
            <WardenBody {...props} />
        </Suspense>
    );
}
