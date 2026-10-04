import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createGlowMaterial } from "@spawnite/engine";
import {
    Color,
    type MeshStandardMaterial,
    OctahedronGeometry,
    SphereGeometry,
    TetrahedronGeometry,
    Vector3,
    type ColorRepresentation,
    type Group,
    type Mesh,
} from "three";

//  Realm's magic bolt, as its Bolt.ts drew it, copied into the mage kit
//  from the storybook's SpellLook story, for SpellLook's projectile
//  slot: a bright core, three runes orbiting it on a tilted ring, and a
//  spiral of crystal shards laid behind it every 25 ms, each shrinking
//  away over 0.3 s. It rides the projectile's group, and lays the shards
//  where the bolt has been in the world, so they stay behind as it flies.

const coreRadius = 0.16;
const runeCount = 3;
const runeOrbit = 0.32;
/** Radians a second the runes turn. */
const runeRate = 9;
const runeSize = 0.07;
const trailEverySeconds = 0.025;
const trailSeconds = 0.3;
const trailRadius = 0.2;
/** Radians round the spiral from one shard to the next. */
const trailTwist = 1.1;
const shardCount = Math.ceil(trailSeconds / trailEverySeconds);
const shardSize = 0.08;

const coreGeometry = new SphereGeometry(coreRadius, 16, 12);
const runeGeometry = new TetrahedronGeometry(runeSize);
//  An octahedron stretched along the flight and squeezed flat.
const shardGeometry = new OctahedronGeometry(shardSize).scale(1, 1.8, 0.5);

interface Shard {
    /** Seconds since it was laid; past `trailSeconds` it is free. */
    age: number;
    /** Where it was laid, in the world. */
    at: Vector3;
}

//  Written in place each frame.
const here = new Vector3();
const heading = new Vector3();
const side = new Vector3();
const lift = new Vector3();
const up = new Vector3(0, 1, 0);

export interface CrystalBoltProps {
    /** The runes' and the shards' colour; the core is near white. */
    color: ColorRepresentation;
}

//  One set per colour, shared by every bolt, as realm shared one per scene.
const glows = new Map<
    string,
    Record<"core" | "rune" | "shard", MeshStandardMaterial>
>();

function readGlowMaterials(color: ColorRepresentation) {
    const key = new Color(color).getHexString();
    let set = glows.get(key);
    if (!set) {
        set = {
            core: createGlowMaterial(
                new Color(color).lerp(new Color("#ffffff"), 0.8),
                2.5,
            ),
            rune: createGlowMaterial(color, 1.5),
            shard: createGlowMaterial(color, 1.4),
        };
        glows.set(key, set);
    }
    return set;
}

export function CrystalBolt({ color }: CrystalBoltProps) {
    const materials = readGlowMaterials(color);
    const boltRef = useRef<Group>(null);
    const runesRef = useRef<Group>(null);
    const trailRef = useRef<Group>(null);
    const state = useMemo(
        () => ({
            angle: 0,
            untilNextShard: 0,
            laid: 0,
            last: null as Vector3 | null,
            shards: Array.from({ length: shardCount }, (): Shard => ({
                age: trailSeconds,
                at: new Vector3(),
            })),
        }),
        [],
    );

    useFrame((_three, deltaSeconds) => {
        const group = boltRef.current;
        if (!group || !runesRef.current || !trailRef.current) return;
        group.updateWorldMatrix(true, false);
        group.getWorldPosition(here);
        //  The way it flies, from where it stood the frame before.
        if (state.last) {
            const moved = heading.copy(here).sub(state.last);
            if (moved.lengthSq() > 1e-8) moved.normalize();
            state.last.copy(here);
        } else state.last = here.clone();

        state.angle += runeRate * deltaSeconds;
        runesRef.current.children.forEach((rune, index) => {
            const angle = state.angle + (index * 2 * Math.PI) / runeCount;
            //  A tilted ring, so from the side it still turns.
            rune.position.set(
                Math.cos(angle) * runeOrbit,
                Math.sin(angle) * runeOrbit * 0.5,
                Math.sin(angle) * runeOrbit,
            );
            rune.rotation.set(angle, angle * 0.7, 0);
        });

        state.untilNextShard -= deltaSeconds;
        if (state.untilNextShard <= 0 && heading.lengthSq() > 0) {
            state.untilNextShard += trailEverySeconds;
            const free = state.shards.find(({ age }) => age >= trailSeconds);
            if (free) {
                //  On a spiral round the flight.
                const twist = state.laid++ * trailTwist;
                side.crossVectors(heading, up).normalize();
                lift.crossVectors(side, heading);
                free.age = 0;
                free.at
                    .copy(here)
                    .addScaledVector(side, Math.cos(twist) * trailRadius)
                    .addScaledVector(lift, Math.sin(twist) * trailRadius);
            }
        }
        state.shards.forEach((shard, index) => {
            const mesh = trailRef.current?.children[index] as Mesh | undefined;
            if (!mesh) return;
            shard.age += deltaSeconds;
            const life = Math.min(1, shard.age / trailSeconds);
            mesh.visible = life < 1;
            if (!mesh.visible) return;
            mesh.scale.setScalar(1 - life);
            mesh.position.copy(group.worldToLocal(lift.copy(shard.at)));
            mesh.rotation.set(index, 0, index * 0.5);
        });
    });

    return (
        <group ref={boltRef}>
            <mesh geometry={coreGeometry} material={materials.core} />
            <group ref={runesRef}>
                {Array.from({ length: runeCount }, (_, index) => (
                    <mesh
                        key={`rune-${index}`}
                        geometry={runeGeometry}
                        material={materials.rune}
                    />
                ))}
            </group>
            <group ref={trailRef}>
                {Array.from({ length: shardCount }, (_, index) => (
                    <mesh
                        key={`shard-${index}`}
                        geometry={shardGeometry}
                        material={materials.shard}
                        visible={false}
                    />
                ))}
            </group>
        </group>
    );
}
