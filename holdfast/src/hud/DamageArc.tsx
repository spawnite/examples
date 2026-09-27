import { useFrame } from "@react-three/fiber";
import type { Entity, TraitRecord } from "koota";
import { useQueryFirst, useWorld } from "koota/react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { type Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from "three";
import {
    Authority,
    defaultWalkerBody,
    Hero,
    Transform,
    useHeadless,
} from "@spawnite/engine";
import { reachMetres } from "../siege/monsters";
import {
    BoltTrait,
    MonsterKind,
    MonsterTrait,
    SlamTrait,
    WardenTrait,
} from "../siege/traits";
import { monsterSettings } from "../siege/waves";

//  A red arc round the crosshair toward whatever just hurt her, held a
//  moment and faded within a second, as shooters show a hit's direction.
//  It turns as she does, so it keeps pointing at where the blow came from.
//  The room streams her health, each monster's count of claws and slams,
//  and each bolt in flight, not who struck whom: the source is a monster
//  whose claw count rose within its reach of her, or whose slam's ring
//  covered her, as her health fell; or where a bolt that vanished at her
//  was first seen, its spitter's mouth; the nearest monster when none is.
//  Drawn as a quad in clip space, like the hurt vignette, so it updates
//  every frame without a render of the HUD.

/** A point on the ground, as the arc reads one. */
export type GroundPoint = Pick<Vector3, "x" | "z">;

/** Where she stands, where the blow came from, and which way the camera
 *  faces on the ground. */
export interface ArcView {
    from: GroundPoint;
    to: GroundPoint;
    facing: GroundPoint;
}

/** Radians from the top of the screen, clockwise, toward `to`: 0 ahead,
 *  a quarter turn to her right, a half turn behind. */
export function measureArcAngle({ from, to, facing }: ArcView) {
    const length = Math.hypot(facing.x, facing.z) || 1;
    const forwardX = facing.x / length;
    const forwardZ = facing.z / length;
    const towardX = to.x - from.x;
    const towardZ = to.z - from.z;
    //  Her right on the ground is her forward turned a quarter clockwise
    //  seen from above.
    const across = towardX * -forwardZ + towardZ * forwardX;
    const along = towardX * forwardX + towardZ * forwardZ;
    return Math.atan2(across, along);
}

/** What might have hurt her, at the moment she was: where it came from,
 *  and whether it is seen to strike her. */
export interface BlowWitness {
    position: GroundPoint;
    struck: boolean;
}

/** The nearest that struck, else the nearest, else none. */
export function findBlowSource(hero: GroundPoint, monsters: BlowWitness[]) {
    let found: GroundPoint | null = null;
    let foundStruck = false;
    let foundDistance = Infinity;
    for (const { position, struck } of monsters) {
        const distance = Math.hypot(position.x - hero.x, position.z - hero.z);
        const better =
            struck !== foundStruck ? struck : distance < foundDistance;
        if (!better) continue;
        found = position;
        foundStruck = struck;
        foundDistance = distance;
    }
    return found;
}

/** Where a slam's ring lay. */
export type SlamRing = Pick<
    TraitRecord<typeof SlamTrait>,
    "x" | "z" | "radius"
>;

/** A monster's rising counts, where it and she stand, how far its claw
 *  reaches, and the ring its last slam covered. */
export interface StrikeCheck {
    monster: GroundPoint;
    hero: GroundPoint;
    clawReach: number;
    clawed: boolean;
    slammed: boolean;
    slam: SlamRing | null;
}

/** Whether a monster whose count rose struck her rather than a teammate:
 *  its claw within reach of her, or its slam's ring over her. */
export function didStrikeHer({
    monster,
    hero,
    clawReach,
    clawed,
    slammed,
    slam,
}: StrikeCheck) {
    if (
        clawed &&
        Math.hypot(monster.x - hero.x, monster.z - hero.z) <= clawReach
    )
        return true;
    return (
        slammed &&
        slam !== null &&
        Math.hypot(slam.x - hero.x, slam.z - hero.z) <= slam.radius
    );
}

/** Seconds an arc holds at full strength, then the second it fades by. */
const holdSeconds = 0.2;
const goneSeconds = 1;

/** An arc's strength, 0 to 1, `seconds` after its blow. */
export function fadeArc(seconds: number) {
    if (seconds <= holdSeconds) return 1;
    const faded = Math.min(
        1,
        (seconds - holdSeconds) / (goneSeconds - holdSeconds),
    );
    //  Eased out, so it lingers as a trace before it goes.
    return (1 - faded) * (1 - faded);
}

/** Arcs shown at once: a crowd's blows land a breath apart, so a fifth
 *  would take the oldest's place. */
const arcCount = 4;

const quadGeometry = new PlaneGeometry(2, 2);

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

//  Sizes in pixels at 1080 lines, scaled with the screen.
const fragment = /* glsl */ `
#define ARCS ${arcCount}
uniform vec2 uSize;
uniform float uAngles[ARCS];
uniform float uStrengths[ARCS];
varying vec2 vUv;
void main() {
    vec2 point = (vUv - 0.5) * uSize;
    float scale = min(uSize.x, uSize.y) / 1080.0;
    float radius = length(point);
    float angle = atan(point.x, point.y);
    float core = 0.0;
    float rim = 0.0;
    for (int index = 0; index < ARCS; index++) {
        float off = abs(mod(angle - uAngles[index] + 3.14159265, 6.2831853) - 3.14159265);
        // Thickest at its middle, tapering to points at its ends.
        float span = 1.0 - smoothstep(0.0, 0.55, off);
        float halfWidth = (4.0 + 14.0 * span) * scale;
        float away = abs(radius - 150.0 * scale);
        float strength = uStrengths[index] * step(0.001, span);
        core = max(core, strength * (1.0 - smoothstep(halfWidth * 0.7, halfWidth, away)));
        // A dark edge, so it reads on the red of a blow and on bright ground.
        rim = max(rim, strength * (1.0 - smoothstep(halfWidth, halfWidth + 3.0 * scale, away)));
    }
    vec3 color = mix(vec3(0.05, 0.0, 0.0), vec3(0.95, 0.12, 0.08), core);
    gl_FragColor = vec4(color, max(core * 0.95, rim * 0.55));
}`;

/** One arc: where its blow came from, and seconds since. */
interface ShownArc {
    source: Vector3;
    seconds: number;
}

/** A bolt in flight: where it was first seen, near its spitter's mouth,
 *  and last seen. */
interface SeenBolt {
    first: Vector3;
    last: Vector3;
}

/** Metres from her feet within which a bolt that vanished met her. */
const boltReachMetres = 2;

/** A monster's claws and slams, as last seen. */
interface SeenBlows {
    strikes: number;
    slams: number;
}

/** Metres past the room's own reach that a claw still counts: the page
 *  draws her and the monster a little behind where the room judged them. */
const drawnLagMetres = 0.6;

/** Metres between the two axes within which a monster's claw reaches her,
 *  as the siege's reach reads it, plus the drawn lag. */
function measureClawReach(kind: MonsterKind) {
    return (
        monsterSettings[kind].radius +
        defaultWalkerBody.radius +
        reachMetres +
        drawnLagMetres
    );
}

//  Written in place each frame.
const facing = new Vector3();

export function DamageArc() {
    const world = useWorld();
    const headless = useHeadless();
    const hero = useQueryFirst(Hero, Authority);
    const meshRef = useRef<Mesh>(null);
    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: vertex,
                fragmentShader: fragment,
                uniforms: {
                    uSize: { value: [1, 1] },
                    uAngles: { value: new Array<number>(arcCount).fill(0) },
                    uStrengths: { value: new Array<number>(arcCount).fill(0) },
                },
                transparent: true,
                depthTest: false,
                depthWrite: false,
            }),
        [],
    );
    useLayoutEffect(() => () => material.dispose(), [material]);
    const arcs = useMemo<ShownArc[]>(
        () =>
            Array.from({ length: arcCount }, () => ({
                source: new Vector3(),
                seconds: goneSeconds,
            })),
        [],
    );
    //  Each monster's count of blows and each bolt, when last seen, and
    //  her health.
    const blowsRef = useRef(new Map<Entity, SeenBlows>());
    const boltsRef = useRef(new Map<Entity, SeenBolt>());
    const healthRef = useRef<number | null>(null);

    useFrame(({ camera, size }, delta) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const blows = blowsRef.current;
        const bolts = boltsRef.current;
        const monsters = world.query(MonsterTrait, Transform);
        const health = hero?.get(WardenTrait)?.health;
        const feet = hero?.get(Transform);
        const hurt =
            health !== undefined &&
            healthRef.current !== null &&
            health < healthRef.current;
        healthRef.current = health ?? null;
        if (hurt && feet) {
            const witnesses: BlowWitness[] = [];
            for (const monster of monsters) {
                const position = monster.get(Transform);
                if (!position) continue;
                const settings = monster.get(MonsterTrait);
                const seen = blows.get(monster);
                if (!settings) continue;
                const slam = monster.get(SlamTrait);
                witnesses.push({
                    position,
                    struck:
                        seen !== undefined &&
                        didStrikeHer({
                            monster: position,
                            hero: feet,
                            clawReach: measureClawReach(settings.kind),
                            clawed: settings.strikes > seen.strikes,
                            slammed: (slam?.slams ?? 0) > seen.slams,
                            slam: slam ?? null,
                        }),
                });
            }
            for (const [bolt, { first, last }] of bolts)
                if (!bolt.isAlive())
                    witnesses.push({
                        position: first,
                        struck:
                            Math.hypot(last.x - feet.x, last.z - feet.z) <=
                            boltReachMetres,
                    });
            const source = findBlowSource(feet, witnesses);
            if (source) {
                let oldest = arcs[0];
                for (const arc of arcs)
                    if (arc.seconds > oldest.seconds) oldest = arc;
                oldest.source.set(source.x, 0, source.z);
                oldest.seconds = 0;
            }
            //  A hit is rare enough to sweep out the monsters that died.
            for (const monster of blows.keys())
                if (!monster.isAlive()) blows.delete(monster);
        }
        for (const monster of monsters) {
            const strikes = monster.get(MonsterTrait)?.strikes ?? 0;
            const slams = monster.get(SlamTrait)?.slams ?? 0;
            const seen = blows.get(monster);
            if (seen) {
                seen.strikes = strikes;
                seen.slams = slams;
            } else blows.set(monster, { strikes, slams });
        }
        for (const bolt of bolts.keys())
            if (!bolt.isAlive()) bolts.delete(bolt);
        for (const bolt of world.query(BoltTrait, Transform)) {
            const at = bolt.get(Transform);
            if (!at) continue;
            const seen = bolts.get(bolt);
            if (seen) seen.last.copy(at);
            else bolts.set(bolt, { first: at.clone(), last: at.clone() });
        }

        camera.getWorldDirection(facing);
        const { uAngles, uStrengths, uSize } = material.uniforms;
        let shown = false;
        arcs.forEach((arc, index) => {
            arc.seconds += delta;
            const strength = feet ? fadeArc(arc.seconds) : 0;
            uStrengths.value[index] = strength;
            if (strength <= 0 || !feet) return;
            shown = true;
            uAngles.value[index] = measureArcAngle({
                from: feet,
                to: arc.source,
                facing,
            });
        });
        uSize.value[0] = size.width;
        uSize.value[1] = size.height;
        mesh.visible = shown;
    });

    if (headless) return null;
    return (
        <mesh
            ref={meshRef}
            geometry={quadGeometry}
            material={material}
            frustumCulled={false}
            renderOrder={1001}
            visible={false}
        />
    );
}
