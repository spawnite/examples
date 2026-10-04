import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    Color,
    BufferGeometry,
    DoubleSide,
    DynamicDrawUsage,
    Euler,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshBasicMaterial,
    NormalBlending,
    PlaneGeometry,
    Quaternion,
    TetrahedronGeometry,
    Vector3,
    type PointLight,
    type Texture,
    type WebGLProgramParametersWithUniforms,
} from "three";
import { useHeadless } from "@spawnite/engine";
import {
    readFlameTexture,
    readGlowTexture,
    readRingTexture,
    readScorchTexture,
    readSparkleTexture,
    readStreakTexture,
} from "../glowTexture";

//  The short-lived bits every effect throws: streaks of spark, soft glows,
//  rings, licks of flame, scorches on the ground, tumbling shards and the
//  jagged segments of a bolt of lightning,
//  each kind one instanced draw from a fixed pool, and a fixed pair of
//  lights a burst borrows. An effect writes into a pool and forgets
//  it; the pool ages, moves and fades what is in it.

/** How a pooled particle is drawn. */
enum Shape {
    /** A glow stretched along its flight, facing the camera. */
    Streak = "streak",
    /** A round glow facing the camera. */
    Glow = "glow",
    /** A ring facing the camera. */
    Ring = "ring",
    /** A lick of flame facing the camera, taller than it is wide. */
    Flame = "flame",
    /** A glint of light facing the camera: a sparkle of thin rays that
     *  flashes and goes, as frost catches the light. */
    Glint = "glint",
    /** A dark scorch lying flat on the ground, which holds and then fades. */
    Scorch = "scorch",
    /** A tumbling shard that falls and comes to rest on the ground. */
    Shard = "shard",
    /** A glow stretched between two fixed points, facing the camera: one
     *  length of a bolt of lightning. */
    Segment = "segment",
}

/** Metres a second squared the world pulls a spark down. */
const gravity = 9.8;
/** An afterglow bolt's flash, as a share of its life, and the share of
 *  its brightness it lingers at after. */
const flashShare = 0.3;
const afterglowLevel = 0.3;
/** Metres from the camera at which a bolt is drawn its full width, and the
 *  share of it a bolt keeps however near it is. */
const fullWidthMetres = 8;
const nearestShare = 0.3;
/** Metres above the ground a shard comes to rest. */
const restMetres = 0.06;
/** Times its width a lick of flame stands. */
const flameAspect = 1.6;
/** The share of its life a scorch or a shard fades over, at its end. */
const scorchFadeShare = 0.4;

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
    /** A segment's run from one end to the other, about its middle. */
    extent: Float32Array;
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
        extent: new Float32Array(shape === Shape.Segment ? capacity * 3 : 0),
    };
}

//  Sized for four wardens firing into a crowd and a few deaths at once.
const pools: Record<Shape, Pool> = {
    [Shape.Streak]: createPool(Shape.Streak, 192),
    [Shape.Glow]: createPool(Shape.Glow, 64),
    [Shape.Ring]: createPool(Shape.Ring, 16),
    [Shape.Flame]: createPool(Shape.Flame, 64),
    //  A Horde's chilled monsters glint a few times a second each.
    [Shape.Glint]: createPool(Shape.Glint, 128),
    //  A Horde of burning husks each leaves one as its burn ends.
    [Shape.Scorch]: createPool(Shape.Scorch, 48),
    [Shape.Shard]: createPool(Shape.Shard, 160),
    //  An arc's leap is about fifty segments, its glow and core, a fork or
    //  two and a crackle where it lands: four four-leap chains at once and
    //  the crackles of their hits.
    [Shape.Segment]: createPool(Shape.Segment, 896),
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

/** A lick of flame: a glow's fields, its colour over the flame's own,
 *  where white keeps the flame's. */
type FlameLick = Omit<GlowPuff, "ring">;

/** A lick of flame at `position` that rises and goes out over
 *  `seconds`. */
export function emitFlame({ rise = 1, ...lick }: FlameLick) {
    addParticle(pools[Shape.Flame], {
        ...lick,
        velocity: way.set(0, rise, 0),
    });
}

/** A glint: where, its colour, how long and how many metres across. */
type Glint = Pick<GlowPuff, "position" | "color" | "seconds" | "size">;

/** A glint at `position` that flashes up and goes over `seconds`. */
export function emitGlint(glint: Glint) {
    addParticle(pools[Shape.Glint], {
        ...glint,
        velocity: way.set(0, 0, 0),
        endSize: glint.size * 0.3,
    });
}

interface ScorchMark {
    /** Where it lies, on the ground. */
    position: Vector3;
    /** Metres across. */
    size: number;
    seconds: number;
}

/** A scorch's strength at birth, which its fade writes down to none. */
const fullStrength = new Color(1, 1, 1);

/** A scorch lying on the ground at `position`, turned at random, which
 *  holds and fades over the last of its `seconds`. */
export function emitScorch({ position, size, seconds }: ScorchMark) {
    const pool = pools[Shape.Scorch];
    const slot = addParticle(pool, {
        position,
        color: fullStrength,
        seconds,
        size: size * 0.85,
        endSize: size,
    });
    pool.spin[slot * 3] = Math.random() * Math.PI * 2;
}

interface ShardThrow {
    /** Where the shards leave from; they come to rest `height` below it. */
    position: Vector3;
    height: number;
    color: Color;
    count: number;
    /** The burst's size: how far the shards fly and how big they are. */
    size: number;
    /** How far out and up they fly, times their size's: 1 unless a burst
     *  of large shards should stay close. */
    reach?: number;
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
    reach = 1,
    seconds,
}: ShardThrow) {
    const pool = pools[Shape.Shard];
    const shardSize = 0.12 * Math.sqrt(size);
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2 + Math.random();
        const out = (1.5 + Math.random() * 2.5) * size * reach;
        way.set(
            Math.sin(angle) * out,
            (2.5 + Math.random() * 3.5) * (0.5 + 0.5 * Math.min(1, reach)),
            Math.cos(angle) * out,
        );
        const slot = addParticle(pool, {
            position,
            velocity: way,
            color,
            seconds,
            size: shardSize,
            endSize: shardSize * 0.7,
            weight: 1,
            floor: position.y - height + restMetres,
        });
        for (let axis = 0; axis < 3; axis++)
            pool.spin[slot * 3 + axis] = (Math.random() - 0.5) * 24;
    }
}

interface BoltStroke {
    from: Vector3;
    to: Vector3;
    color: Color;
    /** Metres across its glow. */
    width: number;
    seconds: number;
    /** Metres its bends stray from the straight line, at most. */
    jag?: number;
    /** Lengths it is drawn in. */
    bends?: number;
    /** Large kinks it takes on top of its bends, each up to `kinkShare` of
     *  its length off the straight line. */
    kinks?: number;
    kinkShare?: number;
    /** Whether it flashes at full for the first part of its life, then
     *  lingers as a dim afterglow, as lightning does, rather than fading
     *  evenly. */
    afterglow?: boolean;
    /** A thinner, brighter line drawn along the same bends: the bolt's
     *  white-hot core inside its glow. */
    core?: Pick<BoltStroke, "color" | "width" | "seconds">;
}

//  Written in place for each bolt.
const boltStart = new Vector3();
const boltEnd = new Vector3();
const boltRun = new Vector3();
const boltSide = new Vector3();
const boltUp = new Vector3();
const boltMiddle = new Vector3();
const kinkSide: number[] = [];
const kinkUp: number[] = [];

/** A jagged bolt of lightning from `from` to `to`: `bends` segments, each
 *  end but the first and last pushed off the line at random, fading over
 *  `seconds`. Its jag is drawn afresh for each bolt, so no two look
 *  alike. */
export function emitBolt({
    from,
    to,
    color,
    width,
    seconds,
    jag = 0.35,
    bends = 5,
    afterglow = false,
    core,
    kinks = 0,
    kinkShare = 0.12,
}: BoltStroke) {
    const pool = pools[Shape.Segment];
    boltRun.subVectors(to, from);
    //  Two axes across the bolt, for its bends to stray along.
    boltSide.set(-boltRun.z, 0, boltRun.x);
    if (boltSide.lengthSq() < 1e-6) boltSide.set(1, 0, 0);
    boltSide.normalize();
    boltUp.crossVectors(boltRun, boltSide).normalize();
    boltStart.copy(from);
    //  Each kink's push off the line, across and up; the ends stay put.
    const kinkReach = boltRun.length() * kinkShare;
    for (let kink = 0; kink <= kinks + 1; kink++) {
        const inner = kink > 0 && kink <= kinks;
        kinkSide[kink] = inner ? (Math.random() * 2 - 1) * kinkReach : 0;
        kinkUp[kink] = inner ? (Math.random() * 2 - 1) * kinkReach : 0;
    }
    for (let bend = 1; bend <= bends; bend++) {
        //  Bends at uneven spacing and of uneven size, so the bolt never
        //  settles into a regular wave.
        const along =
            bend < bends ? (bend + (Math.random() - 0.5) * 0.7) / bends : 1;
        boltEnd.copy(from).addScaledVector(boltRun, along);
        if (kinks > 0) {
            const at = along * (kinks + 1);
            const low = Math.min(kinks, Math.floor(at));
            const blend = at - low;
            boltEnd
                .addScaledVector(
                    boltSide,
                    kinkSide[low] + (kinkSide[low + 1] - kinkSide[low]) * blend,
                )
                .addScaledVector(
                    boltUp,
                    kinkUp[low] + (kinkUp[low + 1] - kinkUp[low]) * blend,
                );
        }
        if (bend < bends) {
            const reach = jag * (0.25 + 0.75 * Math.random() ** 0.6);
            boltEnd
                .addScaledVector(boltSide, (Math.random() * 2 - 1) * reach)
                .addScaledVector(boltUp, (Math.random() * 2 - 1) * reach);
        }
        boltMiddle.addVectors(boltStart, boltEnd).multiplyScalar(0.5);
        //  A segment never falls: its weight carries the afterglow.
        for (const layer of core
            ? [{ color, width, seconds }, core]
            : [{ color, width, seconds }]) {
            const slot = addParticle(pool, {
                position: boltMiddle,
                color: layer.color,
                seconds: layer.seconds,
                size: layer.width,
                endSize: layer.width * (afterglow ? 0.7 : 0.4),
                weight: afterglow ? 1 : 0,
            });
            pool.extent[slot * 3] = boltEnd.x - boltStart.x;
            pool.extent[slot * 3 + 1] = boltEnd.y - boltStart.y;
            pool.extent[slot * 3 + 2] = boltEnd.z - boltStart.z;
        }
        boltStart.copy(boltEnd);
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
    /** Drawn over what is behind it rather than added to it, the red of its
     *  colour its strength: a scorch, which darkens the ground. */
    laidOver?: boolean;
    /** Drawn over whatever stands in front of it: a bolt of lightning,
     *  which a body between it and the camera would otherwise cut. */
    overAll?: boolean;
}

/** Keeps a laid-over particle's texture colour and scales its alpha by
 *  the red channel its fade writes. */
function fadeByColor(shader: WebGLProgramParametersWithUniforms) {
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "diffuseColor.a *= vColor.r;",
    );
}

function createParticleMesh(
    pool: Pool,
    { geometry, map, laidOver = false, overAll = false }: ParticleLook,
) {
    const material = new MeshBasicMaterial({
        map: map ?? null,
        //  Both faces: each quad turns to the player's camera, and a shot
        //  from another camera sees its back.
        side: DoubleSide,
        //  One pass for both faces: added light draws the same in any
        //  order. Without it three draws the pool twice and rebuilds its
        //  program's key on each draw, every frame an effect is live.
        forceSinglePass: true,
        transparent: true,
        blending: laidOver ? NormalBlending : AdditiveBlending,
        depthWrite: false,
        depthTest: !overAll,
        toneMapped: laidOver,
    });
    if (laidOver) {
        material.polygonOffset = true;
        material.polygonOffsetFactor = -2;
        material.polygonOffsetUnits = -2;
        material.onBeforeCompile = fadeByColor;
        material.customProgramCacheKey = () => "holdfast-scorch";
    }
    const mesh = new InstancedMesh(geometry, material, pool.capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.instanceColor = new InstancedBufferAttribute(
        new Float32Array(pool.capacity * 3),
        3,
    ).setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.visible = false;
    //  A scorch lies under every glow, as the ground does.
    if (laidOver) mesh.renderOrder = -1;
    return mesh;
}

/** This frame's step and the camera's place and axes, written each frame. */
const frame = {
    deltaSeconds: 0,
    camera: new Vector3(),
    cameraRight: new Vector3(),
    cameraUp: new Vector3(),
};

/** An afterglow bolt's brightness at `progress` through its life: full
 *  through its flash, then a dim glow that fades out. */
function readAfterglow(progress: number) {
    if (progress < flashShare) return 1;
    return (afterglowLevel * (1 - progress)) / (1 - flashShare);
}

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
        //  A slot gone idle is hidden once, then passed over until it is
        //  written again, so a large pool costs little while it is quiet.
        if (life < 0) continue;
        if (age >= life) {
            matrix.makeScale(0, 0, 0);
            mesh.setMatrixAt(slot, matrix);
            pool.life[slot] = -1;
            continue;
        }
        age = Math.min(life, age + deltaSeconds);
        pool.age[slot] = age;
        if (age < life) live++;
        const offset = slot * 3;
        if (pool.shape !== Shape.Segment)
            pool.velocity[offset + 1] -=
                gravity * pool.weight[slot] * deltaSeconds;
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
        const fade =
            pool.shape === Shape.Scorch || pool.shape === Shape.Shard
                ? Math.min(1, (1 - progress) / scorchFadeShare)
                : pool.shape === Shape.Segment && pool.weight[slot] > 0
                  ? readAfterglow(progress)
                  : 1 - progress;
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
        } else if (pool.shape === Shape.Segment) {
            along.fromArray(pool.extent, offset);
            toCamera.subVectors(camera, place);
            //  Thinner the nearer it is, so a bolt stays a thin line on the
            //  screen up close rather than a band the bloom spreads.
            const near = Math.min(
                1,
                Math.max(nearestShare, toCamera.length() / fullWidthMetres),
            );
            side.crossVectors(along, toCamera).normalize();
            facing.crossVectors(side, along).normalize();
            side.multiplyScalar(size * near);
            matrix.makeBasis(side, along, facing);
        } else if (pool.shape === Shape.Scorch) {
            //  Flat on the ground, turned its own way.
            const turn = pool.spin[offset];
            side.set(Math.cos(turn), 0, -Math.sin(turn)).multiplyScalar(size);
            along.set(Math.sin(turn), 0, Math.cos(turn)).multiplyScalar(size);
            matrix.makeBasis(side, along, facing.set(0, 1, 0));
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
            along
                .copy(cameraUp)
                .multiplyScalar(
                    pool.shape === Shape.Flame ? size * flameAspect : size,
                );
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
            glint: createParticleMesh(pools[Shape.Glint], {
                geometry: quad,
                map: readSparkleTexture(),
            }),
            flame: createParticleMesh(pools[Shape.Flame], {
                geometry: quad,
                map: readFlameTexture(),
            }),
            scorch: createParticleMesh(pools[Shape.Scorch], {
                geometry: quad,
                map: readScorchTexture(),
                laidOver: true,
            }),
            shard: createParticleMesh(pools[Shape.Shard], {
                geometry: tetrahedron,
            }),
            segment: createParticleMesh(pools[Shape.Segment], {
                geometry: quad,
                map: readStreakTexture(),
                overAll: true,
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
        stepPool(pools[Shape.Glint], meshes.glint);
        stepPool(pools[Shape.Flame], meshes.flame);
        stepPool(pools[Shape.Scorch], meshes.scorch);
        stepPool(pools[Shape.Shard], meshes.shard);
        stepPool(pools[Shape.Segment], meshes.segment);
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
            <primitive object={meshes.glint} />
            <primitive object={meshes.flame} />
            <primitive object={meshes.scorch} />
            <primitive object={meshes.shard} />
            <primitive object={meshes.segment} />
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
