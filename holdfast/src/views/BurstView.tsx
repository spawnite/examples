import { useFrame, useThree } from "@react-three/fiber";
import type { Entity } from "koota";
import { useWorld } from "koota/react";
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
} from "react";
import {
    AdditiveBlending,
    Color,
    CylinderGeometry,
    MeshBasicMaterial,
    PlaneGeometry,
    RingGeometry,
    SpriteMaterial,
    Vector3,
    type Group,
    type Mesh,
    type Sprite,
} from "three";
import { TransformTrait } from "@spawnite/engine";
import { measureHearing, playSound, Sound } from "../audio/sounds";
import { burstSeconds } from "../siege/effects";
import { BurstKind, BurstTrait, MonsterKind } from "../siege/traits";
import { borrowLight, emitShards, emitSparks } from "./effects/EffectPools";
import { shakeView } from "./shakes";
import {
    readGlowTexture,
    readPuffTexture,
    readTearTexture,
} from "./glowTexture";
import { recallCorpse } from "./monsters/Corpses";
import { monsterLooks } from "./palette";

//  The short effects the room spawns: a monster's death, a rift tearing
//  open in the ground with light spilling up and dust as one rises or sinks
//  back, and a pillar of light as a warden gets up. Each runs its whole show
//  from when it mounts, whatever the stream does after, and builds only
//  what its kind draws.
//
//  A death is ranked by what fell, so the moments that matter stand out of
//  a crowd, as Vampire Survivors and Hades keep a full screen readable: the
//  many plain deaths of a wave are a puff of dust and a few motes, a brute
//  throws dust and debris, and only a colossus bursts with a flash, a
//  shockwave and a light. Reactions, capstones and crits own the flashes.

/** Shards a colossus's death throws. */
const shardCount = 14;
/** Sparks a colossus's death throws, at size 1. */
const deathSparks = 14;
/** Motes a plain death lets go, drifting up in the monster's color. */
const moteCount = 5;
/** Pieces a brute's death throws. */
const debrisCount = 7;
/** Seconds a death's dust takes to spread and fade. */
const dustSeconds = 0.7;
/** Seconds a death's flash and light last: the burst's heart, over well
 *  before its shards land. */
const flashSeconds = 0.33;
/** Seconds a rift takes to tear fully open. */
const tearSeconds = 0.14;
/** Puffs of dust a rift throws up. */
const dustCount = 5;

const reviveTint = "#ffe7a3";
/** How far toward white a burst's colours go, so their brightest part
 *  burns toward white under the tone mapping, as a hot light does. */
const tintWhiteness = 0.25;
/** How hard a colossus's fall shakes the camera, and the metres from it at
 *  which the shake fades to none: the whole circle feels it. */
const colossusFallShake = 0.6;
const colossusFallMetres = 45;
/** A colossus's rising: the ground shakes a little less than at its fall,
 *  and the rift lights the ground round it in its seams' colour for a
 *  moment, with thunder an octave under the Storm strike's, so the night's
 *  boss arrives rather than appears. */
const colossusRiseShake = 0.45;
const colossusRiseLight = { color: "#ff5a14", candela: 220, seconds: 1.6 };

const white = new Color("#ffffff");
const upward = new Vector3(0, 1, 0);
const riseLightColor = new Color(colossusRiseLight.color);
//  Written in place for each rising.
const riseLightAt = new Vector3();
/** A death's shockwave: a thin ring, so it reads as a wave and not a disc. */
const waveGeometry = new RingGeometry(0.86, 1, 48);
const tearGeometry = new PlaneGeometry(1, 1);
const pillarGeometry = new CylinderGeometry(0.5, 0.7, 1, 16, 1, true);
/** A rift's dust: warm and a little lighter than the dusk ground, so it
 *  reads against it without glowing. */
const riftDust = new Color("#6a5244");
//  Written in place as a burst starts.
const origin = new Vector3();
const sparkColor = new Color();
const shardColor = new Color();
const lightColor = new Color();

/** A burst's glow on a mesh, added over what is behind it. */
export function createGlow(color: Color) {
    return new MeshBasicMaterial({
        color,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
}

/** A burst's soft round glow, facing the camera. */
export function createGlowSprite(color: Color) {
    return new SpriteMaterial({
        map: readGlowTexture(),
        color,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
}

/** A rift's dust, drawn over the scene rather than added to it, so it
 *  darkens what is behind. */
export function createDust() {
    return new SpriteMaterial({
        map: readPuffTexture(),
        color: riftDust,
        transparent: true,
        depthWrite: false,
    });
}

/** Eases a 0 to 1 progress out: fast at first, settling at the end. */
function easeOut(progress: number) {
    return 1 - (1 - progress) * (1 - progress) * (1 - progress);
}

/** A material made once for a burst and disposed as it unmounts. */
function useOwnedMaterial<Material extends { dispose(): void }>(
    create: () => Material,
) {
    const [material] = useState(create);
    useLayoutEffect(() => () => material.dispose(), [material]);
    return material;
}

interface BurstClock {
    groupRef: RefObject<Group | null>;
    /** Runs once, on the first frame, once the burst stands where the
     *  stream put it. */
    start?: (group: Group) => void;
    /** Runs every frame with the seconds since the first, capped at the
     *  burst's life. */
    draw: (seconds: number) => void;
}

function useBurstClock({ groupRef, start, draw }: BurstClock) {
    const bornRef = useRef<number | null>(null);
    useFrame(({ clock }) => {
        const group = groupRef.current;
        if (!group) return;
        if (bornRef.current === null) {
            bornRef.current = clock.elapsedTime;
            start?.(group);
        }
        draw(Math.min(burstSeconds, clock.elapsedTime - bornRef.current));
    });
}

interface KindProps {
    tint: Color;
    size: number;
}

/** How a death shows, by what fell. */
enum DeathRank {
    /** The many: a husk, a skitter, a spitter. */
    Plain = "plain",
    /** A brute. */
    Heavy = "heavy",
    /** The night's boss. */
    Boss = "boss",
}

function readDeathRank(monster: MonsterKind | undefined) {
    if (monster === MonsterKind.Colossus) return DeathRank.Boss;
    if (monster === MonsterKind.Brute) return DeathRank.Heavy;
    return DeathRank.Plain;
}

const deathSounds: Record<DeathRank, Sound> = {
    [DeathRank.Plain]: Sound.Fall,
    [DeathRank.Heavy]: Sound.HeavyFall,
    [DeathRank.Boss]: Sound.ColossusFall,
};

interface DustProps extends KindProps {
    heavy: boolean;
}

/** A monster falling: a puff of dust at its feet and a few motes of its
 *  color drifting up as the body slumps, and for a brute, dark debris
 *  thrown wide. No flash and no light: the body's own fall is the show. */
function DustBurst({ tint, size, heavy }: DustProps) {
    const groupRef = useRef<Group>(null);
    const dustRef = useRef<Group>(null);
    const dustMaterial = useOwnedMaterial(createDust);
    const puffs = heavy ? 3 : 2;
    useBurstClock({
        groupRef,
        start: (group) => {
            group.getWorldPosition(origin);
            origin.y += size * 0.35;
            emitSparks({
                position: origin,
                color: sparkColor.copy(tint).multiplyScalar(0.9),
                count: heavy ? moteCount + 3 : moteCount,
                speed: 1.6,
                toward: upward,
                spread: 0.8,
                seconds: 0.8,
                width: 0.05,
                weight: -0.2,
            });
            if (heavy)
                emitShards({
                    position: origin,
                    height: size * 0.35,
                    color: shardColor.copy(riftDust).multiplyScalar(0.7),
                    count: debrisCount,
                    size: size * 0.45,
                    seconds: burstSeconds,
                });
        },
        draw: (seconds) => {
            const age = Math.min(1, seconds / dustSeconds);
            const spread = easeOut(age);
            const children = dustRef.current?.children ?? [];
            for (let index = 0; index < children.length; index++) {
                const lean =
                    children.length === 1
                        ? 0
                        : index / (children.length - 1) - 0.5;
                children[index].position.set(
                    lean * size * (0.5 + spread),
                    size * (0.15 + spread * 0.35),
                    (index % 2 === 0 ? 0.2 : -0.2) * size,
                );
                children[index].scale.setScalar(size * (0.6 + spread * 1.1));
            }
            dustMaterial.opacity = 0.55 * (1 - age) * (1 - age);
        },
    });

    return (
        <group ref={groupRef}>
            <group ref={dustRef}>
                {Array.from({ length: puffs }, (_, index) => (
                    <sprite key={`puff-${index}`} material={dustMaterial} />
                ))}
            </group>
        </group>
    );
}

/** A colossus falling: a flash, a shockwave, and pooled shards, sparks and
 *  light. */
function DeathBurst({ tint, size }: KindProps) {
    const groupRef = useRef<Group>(null);
    const flashRef = useRef<Sprite>(null);
    const waveRef = useRef<Mesh>(null);
    //  The flash is white at its heart, in the monster's colour at its rim.
    const flashMaterial = useOwnedMaterial(() =>
        createGlowSprite(tint.clone().lerp(white, 0.3).multiplyScalar(1.5)),
    );
    const waveMaterial = useOwnedMaterial(() =>
        createGlow(tint.clone().lerp(white, 0.3).multiplyScalar(1.6)),
    );
    useBurstClock({
        groupRef,
        start: (group) => {
            group.getWorldPosition(origin);
            const height = size * 0.5;
            origin.y += height;
            emitShards({
                position: origin,
                height,
                color: shardColor.copy(tint).multiplyScalar(1.4),
                count: shardCount,
                size,
                seconds: burstSeconds,
            });
            emitSparks({
                position: origin,
                color: sparkColor.copy(tint).lerp(white, 0.3).multiplyScalar(3),
                count: Math.round(deathSparks * Math.min(2, size)),
                speed: 9 * Math.sqrt(size),
                seconds: 0.5,
                width: 0.08,
            });
            borrowLight({
                position: origin,
                color: lightColor.copy(tint).lerp(white, 0.2),
                intensity: 45 * size,
                seconds: flashSeconds,
            });
        },
        draw: (seconds) => {
            const age = seconds / burstSeconds;
            const flash = Math.min(1, seconds / flashSeconds);
            flashRef.current?.scale.setScalar(
                size * (1 + easeOut(flash) * 1.2),
            );
            flashMaterial.opacity = (1 - flash) * (1 - flash);
            waveRef.current?.scale.setScalar(size * (0.3 + easeOut(age) * 2.6));
            waveMaterial.opacity = (1 - age) * (1 - age);
        },
    });

    return (
        <group ref={groupRef}>
            <sprite
                ref={flashRef}
                material={flashMaterial}
                position-y={size * 0.5}
            />
            <mesh
                ref={waveRef}
                geometry={waveGeometry}
                material={waveMaterial}
                rotation-x={-Math.PI / 2}
                position-y={0.06}
            />
        </group>
    );
}

interface RiftBurstProps extends KindProps {
    /** Turns the tear, so no two rifts lie the same way. */
    turn: number;
    /** Whether the rift takes a monster back rather than lets one out:
     *  its body sinks into it, so the light spills lower. */
    closing?: boolean;
}

/** A monster rising: a jagged tear that rips open in the ground, light
 *  spilling up out of it with embers, and dark dust thrown up. */
function RiftBurst({ tint, size, turn, closing = false }: RiftBurstProps) {
    const groupRef = useRef<Group>(null);
    const tearRef = useRef<Mesh>(null);
    const spillRef = useRef<Sprite>(null);
    const dustRef = useRef<Group>(null);
    const tearMaterial = useOwnedMaterial(() => {
        //  A wave's batch rises together, so each rift stays a glint in the
        //  ground rather than a flare.
        const tear = createGlow(tint.clone().multiplyScalar(1.5));
        tear.map = readTearTexture();
        return tear;
    });
    const spillMaterial = useOwnedMaterial(() =>
        createGlowSprite(tint.clone().lerp(white, 0.1).multiplyScalar(0.8)),
    );
    const dustMaterial = useOwnedMaterial(createDust);
    useBurstClock({
        groupRef,
        start: (group) => {
            group.getWorldPosition(origin);
            emitSparks({
                position: origin,
                color: sparkColor.copy(tint).multiplyScalar(2.2),
                count: 8,
                speed: 3.5,
                toward: upward,
                spread: 0.5,
                seconds: burstSeconds,
                width: 0.06,
                weight: -0.15,
            });
        },
        draw: (seconds) => {
            const age = seconds / burstSeconds;
            //  The tear rips open fast, holds, then closes and fades.
            const open = easeOut(Math.min(1, seconds / tearSeconds));
            const fade = 1 - Math.max(0, (age - 0.45) / 0.55);
            tearRef.current?.scale.set(
                size * 2.2 * open,
                size * (0.8 + 1.6 * open) * (0.4 + 0.6 * fade),
                1,
            );
            tearMaterial.opacity = fade;
            const reach = closing ? 0.5 : 1;
            spillRef.current?.scale.set(
                size * 0.55 * open,
                size * (0.6 + 1.9 * open) * reach,
                1,
            );
            spillRef.current?.position.setY(size * (0.3 + 0.95 * open) * reach);
            spillMaterial.opacity = fade * 0.45;
            const puffs = dustRef.current?.children ?? [];
            for (let index = 0; index < puffs.length; index++) {
                const lean = (index / dustCount - 0.5) * 2;
                puffs[index].position.set(
                    lean * size * (0.6 + seconds * 1.2),
                    0.2 + seconds * (1.2 + (index % 2) * 0.6),
                    (index % 2 === 0 ? 0.3 : -0.3) * size,
                );
                puffs[index].scale.setScalar(size * (1 + seconds * 2.4));
            }
            dustMaterial.opacity = 0.8 * (1 - age);
        },
    });

    return (
        <group ref={groupRef}>
            <mesh
                ref={tearRef}
                geometry={tearGeometry}
                material={tearMaterial}
                rotation-x={-Math.PI / 2}
                rotation-z={turn}
                position-y={0.05}
            />
            <sprite ref={spillRef} material={spillMaterial} />
            <group ref={dustRef}>
                {Array.from({ length: dustCount }, (_, index) => (
                    <sprite key={`puff-${index}`} material={dustMaterial} />
                ))}
            </group>
        </group>
    );
}

/** A warden getting up: a pillar of light that stretches up and fades. */
function ReviveBurst({ tint }: KindProps) {
    const groupRef = useRef<Group>(null);
    const material = useOwnedMaterial(() =>
        createGlow(tint.clone().multiplyScalar(1.4)),
    );
    useBurstClock({
        groupRef,
        draw: (seconds) => {
            const age = seconds / burstSeconds;
            material.opacity = 1 - age;
            groupRef.current?.scale.set(1, 1 + age * 5, 1);
        },
    });

    return (
        <group ref={groupRef}>
            <mesh
                geometry={pillarGeometry}
                material={material}
                position-y={0.5}
            />
        </group>
    );
}

interface BurstViewProps {
    entity: Entity;
}

export function BurstView({ entity }: BurstViewProps) {
    //  Read once: the stream writes a new entity's traits in the delta that
    //  spawns it, and a burst never changes.
    const [burst] = useState(() => entity.get(BurstTrait));
    const kind = burst?.kind ?? BurstKind.Death;
    const size = burst?.size ?? 1;
    const rank = readDeathRank(burst?.monster);
    const tint = useMemo(
        () =>
            new Color(
                kind === BurstKind.Revive
                    ? reviveTint
                    : monsterLooks[burst?.monster ?? MonsterKind.Husk].eyes,
            ).lerp(white, tintWhiteness),
        [kind, burst?.monster],
    );
    const readThree = useThree((state) => state.get);
    //  A fall or a rise is heard, quieter the farther it is from the
    //  camera; a recall's body sinks into its rift.
    const world = useWorld();
    useEffect(() => {
        const at = entity.get(TransformTrait);
        if (kind === BurstKind.Revive || !at) return;
        if (kind === BurstKind.Recall && burst?.monsterId)
            recallCorpse(burst.monsterId);
        //  A colossus's fall shakes the ground under the whole circle.
        if (kind === BurstKind.Death && rank === DeathRank.Boss)
            shakeView(world, {
                strength: colossusFallShake,
                at,
                radius: colossusFallMetres,
            });
        const metres = readThree().camera.position.distanceTo(at);
        if (
            kind === BurstKind.Rift &&
            burst?.monster === MonsterKind.Colossus
        ) {
            shakeView(world, {
                strength: colossusRiseShake,
                at,
                radius: colossusFallMetres,
            });
            borrowLight({
                position: riseLightAt.set(at.x, at.y + 2, at.z),
                color: riseLightColor,
                intensity: colossusRiseLight.candela,
                seconds: colossusRiseLight.seconds,
            });
            playSound(Sound.Thunderhead, {
                volume: measureHearing(metres),
                pitch: 0.5,
            });
        }
        const death = kind === BurstKind.Death;
        playSound(death ? deathSounds[rank] : Sound.Rift, {
            volume: measureHearing(metres),
        });
    }, [entity, world, kind, rank, burst, readThree]);

    if (kind === BurstKind.Death)
        return rank === DeathRank.Boss ? (
            <DeathBurst tint={tint} size={size} />
        ) : (
            <DustBurst
                tint={tint}
                size={size}
                heavy={rank === DeathRank.Heavy}
            />
        );
    if (kind === BurstKind.Rift || kind === BurstKind.Recall)
        return (
            <RiftBurst
                tint={tint}
                size={size}
                turn={entity.id()}
                closing={kind === BurstKind.Recall}
            />
        );
    return <ReviveBurst tint={tint} size={size} />;
}
