import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    Color,
    BufferGeometry,
    DynamicDrawUsage,
    Euler,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshBasicMaterial,
    PlaneGeometry,
    Quaternion,
    TetrahedronGeometry,
    Vector3,
    type PointLight,
    type Texture,
} from "three";
import { useHeadless } from "@spawnite/engine";
import { readGlowTexture, readRingTexture } from "../glowTexture";

//  The short-lived bits every effect throws: streaks of spark, soft glows,
//  rings and tumbling shards, each kind one instanced draw from a fixed pool, and a fixed
//  pair of lights a burst borrows. An effect writes into a pool and forgets
//  it; the pool ages, moves and fades what is in it.

/** How a pooled particle is drawn. */
enum Shape {
    /** A glow stretched along its flight, facing the camera. */
    Streak = "streak",
    /** A round glow facing the camera. */
    Glow = "glow",
    /** A ring facing the camera. */
    Ring = "ring",
    /** A tumbling shard that falls and comes to rest on the ground. */
    Shard = "shard",
}

/** Metres a second squared the world pulls a spark down. */
const gravity = 9.8;
/** Metres above the ground a shard comes to rest. */
const restMetres = 0.06;

interface Pool {
    shape: Shape;
    capacity: number;
    /** The next slot to write: the oldest particle gives way. */
    next: number;
    live: number;
    position: Float32Array;
    velocity: Float32Array;
    color: Float32Array;
    /** Seconds lived and seconds to live; a particle with no life left is
     *  idle. */
    age: Float32Array;
    life: Float32Array;
    /** Metres across at birth and at death. */
    size: Float32Array;
    endSize: Float32Array;
    /** How much of gravity pulls it: 1 for a spark, 0 for a glow. */
    weight: Float32Array;
    /** A shard's height of rest, its tumble in radians a second on each
     *  axis, and the age it came to rest at. */
    floor: Float32Array;
    spin: Float32Array;
    restAge: Float32Array;
}

function createPool(shape: Shape, capacity: number): Pool {
    return {
        shape,
        capacity,
        next: 0,
        live: 0,
        position: new Float32Array(capacity * 3),
        velocity: new Float32Array(capacity * 3),
        color: new Float32Array(capacity * 3),
        age: new Float32Array(capacity),
        life: new Float32Array(capacity),
        size: new Float32Array(capacity),
        endSize: new Float32Array(capacity),
        weight: new Float32Array(capacity),
        floor: new Float32Array(capacity).fill(-Infinity),
        spin: new Float32Array(capacity * 3),
        restAge: new Float32Array(capacity),
    };
}

//  Sized for four wardens firing into a crowd and a few deaths at once.
const pools: Record<Shape, Pool> = {
    [Shape.Streak]: createPool(Shape.Streak, 192),
    [Shape.Glow]: createPool(Shape.Glow, 64),
    [Shape.Ring]: createPool(Shape.Ring, 16),
    [Shape.Shard]: createPool(Shape.Shard, 160),
};

interface Particle {
    position: Vector3;
    velocity?: Vector3;
    color: Color;
    seconds: number;
    size: number;
    endSize?: number;
    weight?: number;
    floor?: number;
}

function addParticle(pool: Pool, particle: Particle) {
    const slot = pool.next;
    pool.next = (slot + 1) % pool.capacity;
    if (pool.life[slot] <= pool.age[slot]) pool.live++;
    particle.position.toArray(pool.position, slot * 3);
    if (particle.velocity) particle.velocity.toArray(pool.velocity, slot * 3);
    else pool.velocity.fill(0, slot * 3, slot * 3 + 3);
    particle.color.toArray(pool.color, slot * 3);
    pool.age[slot] = 0;
    pool.life[slot] = particle.seconds;
    pool.size[slot] = particle.size;
    pool.endSize[slot] = particle.endSize ?? particle.size;
    pool.weight[slot] = particle.weight ?? 0;
    pool.floor[slot] = particle.floor ?? -Infinity;
    pool.restAge[slot] = Infinity;
    return slot;
}

//  Written in place for each particle an effect adds.
const way = new Vector3();

interface SparkSpray {
    position: Vector3;
    color: Color;
    count: number;
    /** Metres a second the fastest spark leaves at. */
    speed: number;
    /** Which way the spray leans; none throws them all round. */
    toward?: Vector3;
    /** How far a spark may stray from `toward`: 0 a line, 1 a half sphere. */
    spread?: number;
    seconds?: number;
    /** Metres across a streak. */
    width?: number;
    weight?: number;
}

/** Throws `count` streaks of spark out of `position`, falling as they go. */
export function emitSparks({
    position,
    color,
    count,
    speed,
    toward,
    spread = 1,
    seconds = 0.35,
    width = 0.07,
    weight = 1,
}: SparkSpray) {
    const pool = pools[Shape.Streak];
    for (let index = 0; index < count; index++) {
        way.set(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
        );
        if (toward) way.multiplyScalar(spread).add(toward);
        way.setLength(speed * (0.45 + Math.random() * 0.55));
        addParticle(pool, {
            position,
            velocity: way,
            color,
            seconds: seconds * (0.6 + Math.random() * 0.4),
            size: width,
            weight,
        });
    }
}

interface GlowPuff {
    position: Vector3;
    color: Color;
    seconds: number;
    size: number;
    endSize?: number;
    /** Metres a second it drifts up. */
    rise?: number;
    /** A ring rather than a round glow. */
    ring?: boolean;
}

/** A glow or a ring at `position` that grows from `size` to `endSize` and
 *  fades over `seconds`. */
export function emitGlow({ ring = false, rise = 0, ...glow }: GlowPuff) {
    addParticle(pools[ring ? Shape.Ring : Shape.Glow], {
        ...glow,
        velocity: way.set(0, rise, 0),
    });
}

interface ShardThrow {
    /** Where the shards leave from; they come to rest `height` below it. */
    position: Vector3;
    height: number;
    color: Color;
    count: number;
    /** The burst's size: how far the shards fly and how big they are. */
    size: number;
    seconds: number;
}

/** Throws `count` shards out and up of `position`, tumbling, to fall and
 *  rest on the ground `height` below it. */
export function emitShards({
    position,
    height,
    color,
    count,
    size,
    seconds,
}: ShardThrow) {
    const pool = pools[Shape.Shard];
    const shardSize = 0.12 * Math.sqrt(size);
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2 + Math.random();
        const reach = (1.5 + Math.random() * 2.5) * size;
        way.set(
            Math.sin(angle) * reach,
            2.5 + Math.random() * 3.5,
            Math.cos(angle) * reach,
        );
        const slot = addParticle(pool, {
            position,
            velocity: way,
            color,
            seconds,
            size: shardSize,
            endSize: shardSize * 0.4,
            weight: 1,
            floor: position.y - height + restMetres,
        });
        for (let axis = 0; axis < 3; axis++)
            pool.spin[slot * 3 + axis] = (Math.random() - 0.5) * 24;
    }
}

/** Lights a burst may borrow: fixed, so the scene's light count never
 *  changes and no lit material recompiles. */
const lightCount = 2;

interface Flash {
    position: Vector3;
    color: Color;
    intensity: number;
    seconds: number;
}

const flashes = Array.from({ length: lightCount }, (_, index) => ({
    key: `flash-${index}`,
    position: new Vector3(),
    color: new Color(),
    intensity: 0,
    age: 0,
    seconds: 1,
}));

/** Lights `position` in `color` for `seconds`, fading, with the pool's
 *  light that has least left to show. */
export function borrowLight({ position, color, intensity, seconds }: Flash) {
    let weakest = flashes[0];
    for (const flash of flashes)
        if (
            flash.intensity * (1 - flash.age / flash.seconds) <
            weakest.intensity * (1 - weakest.age / weakest.seconds)
        )
            weakest = flash;
    weakest.position.copy(position);
    weakest.color.copy(color);
    weakest.intensity = intensity;
    weakest.age = 0;
    weakest.seconds = seconds;
}

const quad = new PlaneGeometry(1, 1);
const tetrahedron = new TetrahedronGeometry(1);
//  Written in place for each particle each frame.
const matrix = new Matrix4();
const along = new Vector3();
const side = new Vector3();
const facing = new Vector3();
const toCamera = new Vector3();
const place = new Vector3();
const tumble = new Euler();
const turn = new Quaternion();
const scale = new Vector3();

interface ParticleLook {
    geometry: BufferGeometry;
    map?: Texture;
}

function createParticleMesh(pool: Pool, { geometry, map }: ParticleLook) {
    const material = new MeshBasicMaterial({
        map: map ?? null,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
    const mesh = new InstancedMesh(geometry, material, pool.capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.instanceColor = new InstancedBufferAttribute(
        new Float32Array(pool.capacity * 3),
        3,
    ).setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
}

/** This frame's step and the camera's place and axes, written each frame. */
const frame = {
    deltaSeconds: 0,
    camera: new Vector3(),
    cameraRight: new Vector3(),
    cameraUp: new Vector3(),
};

/** Ages, moves and draws every particle in `pool`. */
function stepPool(pool: Pool, mesh: InstancedMesh) {
    const { deltaSeconds, camera, cameraRight, cameraUp } = frame;
    mesh.visible = pool.live > 0;
    if (!mesh.visible) return;
    const colors = mesh.instanceColor;
    if (!colors) return;
    let live = 0;
    for (let slot = 0; slot < pool.capacity; slot++) {
        const life = pool.life[slot];
        let age = pool.age[slot];
        if (age >= life) {
            matrix.makeScale(0, 0, 0);
            mesh.setMatrixAt(slot, matrix);
            continue;
        }
        age = Math.min(life, age + deltaSeconds);
        pool.age[slot] = age;
        if (age < life) live++;
        const offset = slot * 3;
        pool.velocity[offset + 1] -= gravity * pool.weight[slot] * deltaSeconds;
        for (let axis = 0; axis < 3; axis++)
            pool.position[offset + axis] +=
                pool.velocity[offset + axis] * deltaSeconds;
        //  A shard that reaches the ground stops there and stops turning.
        if (pool.position[offset + 1] <= pool.floor[slot]) {
            pool.position[offset + 1] = pool.floor[slot];
            pool.velocity.fill(0, offset, offset + 3);
            pool.restAge[slot] = Math.min(pool.restAge[slot], age);
        }
        const progress = age / life;
        const fade = 1 - progress;
        colors.setXYZ(
            slot,
            pool.color[offset] * fade,
            pool.color[offset + 1] * fade,
            pool.color[offset + 2] * fade,
        );
        const size =
            pool.size[slot] +
            (pool.endSize[slot] - pool.size[slot]) * (1 - fade * fade);
        place.fromArray(pool.position, offset);
        if (pool.shape === Shape.Streak) {
            along.fromArray(pool.velocity, offset);
            //  A streak as long as the way it covers in a thirtieth of a
            //  second, so a fast spark reads as a line and a slow one a dot.
            const length = Math.max(size, along.length() / 30);
            along.normalize();
            toCamera.subVectors(camera, place);
            side.crossVectors(along, toCamera).normalize();
            facing.crossVectors(side, along);
            side.multiplyScalar(size);
            along.multiplyScalar(length);
            matrix.makeBasis(side, along, facing);
        } else if (pool.shape === Shape.Shard) {
            const turned = Math.min(age, pool.restAge[slot]);
            tumble.set(
                pool.spin[offset] * turned,
                pool.spin[offset + 1] * turned,
                pool.spin[offset + 2] * turned,
            );
            matrix.compose(
                place,
                turn.setFromEuler(tumble),
                scale.setScalar(size),
            );
        } else {
            side.copy(cameraRight).multiplyScalar(size);
            along.copy(cameraUp).multiplyScalar(size);
            matrix.makeBasis(side, along, facing.set(0, 0, 0));
        }
        matrix.setPosition(place);
        mesh.setMatrixAt(slot, matrix);
    }
    pool.live = live;
    mesh.instanceMatrix.needsUpdate = true;
    colors.needsUpdate = true;
}

/** Draws every pool, and holds the lights a burst borrows. Mounted once,
 *  for the whole scene; the room, which draws nothing, mounts none. */
export function EffectPools() {
    return useHeadless() ? null : <DrawnPools />;
}

function DrawnPools() {
    const meshes = useMemo(
        () => ({
            streak: createParticleMesh(pools[Shape.Streak], {
                geometry: quad,
                map: readGlowTexture(),
            }),
            glow: createParticleMesh(pools[Shape.Glow], {
                geometry: quad,
                map: readGlowTexture(),
            }),
            ring: createParticleMesh(pools[Shape.Ring], {
                geometry: quad,
                map: readRingTexture(),
            }),
            shard: createParticleMesh(pools[Shape.Shard], {
                geometry: tetrahedron,
            }),
        }),
        [],
    );
    useLayoutEffect(
        () => () => {
            for (const mesh of Object.values(meshes)) {
                mesh.dispose();
                if (mesh.material instanceof MeshBasicMaterial)
                    mesh.material.dispose();
            }
        },
        [meshes],
    );
    const lightsRef = useRef<(PointLight | null)[]>([]);

    useFrame(({ camera }, delta) => {
        //  A long stall, a hidden tab, ends every effect rather than
        //  leaping it forward.
        const deltaSeconds = Math.min(delta, 0.1);
        frame.deltaSeconds = deltaSeconds;
        frame.camera.setFromMatrixPosition(camera.matrixWorld);
        frame.cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
        frame.cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
        stepPool(pools[Shape.Streak], meshes.streak);
        stepPool(pools[Shape.Glow], meshes.glow);
        stepPool(pools[Shape.Ring], meshes.ring);
        stepPool(pools[Shape.Shard], meshes.shard);
        for (let index = 0; index < lightCount; index++) {
            const flash = flashes[index];
            const light = lightsRef.current[index];
            if (!light) continue;
            flash.age = Math.min(flash.seconds, flash.age + deltaSeconds);
            const left = 1 - flash.age / flash.seconds;
            light.intensity = flash.intensity * left * left;
            light.position.copy(flash.position);
            light.color.copy(flash.color);
        }
    });

    return (
        <>
            <primitive object={meshes.streak} />
            <primitive object={meshes.glow} />
            <primitive object={meshes.ring} />
            <primitive object={meshes.shard} />
            {flashes.map((flash, index) => (
                <pointLight
                    key={flash.key}
                    ref={(light) => {
                        lightsRef.current[index] = light;
                    }}
                    intensity={0}
                    distance={12}
                    decay={1.5}
                />
            ))}
        </>
    );
}
