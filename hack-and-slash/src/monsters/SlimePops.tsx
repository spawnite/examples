import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, type Group, type Mesh } from "@spawnite/engine/three";
import type { SlimeLook } from "./slimeModel";

//  A slain slime's last moment: it swells, flashing, then bursts flat and
//  is gone, over the ring of light the fight draws where it fell. Its
//  Entity is gone by then, so the pop is drawn here, by one of a few meshes
//  kept for it.

/** Seconds a pop takes, and how many can play at once. */
const popSeconds = 0.3;
const popCount = 6;

type Pop = {
    look: SlimeLook | null;
    age: number;
    /** Where its body last stood, as the body's own matrix in the world. */
    place: Matrix4;
};

const pops: Pop[] = Array.from({ length: popCount }, () => ({
    look: null,
    age: popSeconds,
    place: new Matrix4(),
}));
let nextPop = 0;

/** Pops a slime drawn in `look` where its body last stood. */
export function popSlime(look: SlimeLook, place: Matrix4) {
    const pop = pops[nextPop];
    nextPop = (nextPop + 1) % popCount;
    pop.look = look;
    pop.age = 0;
    pop.place.copy(place);
}

//  Written in place each frame.
const parentInverse = new Matrix4();

/** The pops of the slimes that fall. Mounted once, beside them. */
export function SlimePops() {
    const groups = useRef<(Group | null)[]>([]);
    const meshes = useRef<(Mesh | null)[]>([]);

    //  A pop cut short by leaving the wilds does not finish on return.
    useEffect(() => {
        for (const pop of pops) pop.age = popSeconds;
    }, []);

    useFrame((_, delta) => {
        for (let index = 0; index < popCount; index++) {
            const pop = pops[index];
            const group = groups.current[index];
            const mesh = meshes.current[index];
            if (!group || !mesh) continue;
            const look = pop.look;
            mesh.visible = look !== null && pop.age < popSeconds;
            if (!look || !mesh.visible) continue;
            pop.age += delta;
            const done = Math.min(1, pop.age / popSeconds);
            let across: number;
            let tall: number;
            if (done < 0.3) {
                const swell = done / 0.3;
                across = 1 + 0.2 * swell;
                tall = 1 + 0.25 * swell;
            } else {
                //  Flattening out as it shrinks away to nothing.
                const burst = (done - 0.3) / 0.7;
                across = (1.2 + 0.5 * burst) * (1 - burst ** 3);
                tall = 1.25 * (1 - burst) ** 2;
            }
            mesh.geometry = look.geometry;
            const material = done < 0.25 ? look.hurt : look.rest;
            if (mesh.material !== material) mesh.material = material;
            mesh.scale.set(across, tall, across);
            parentInverse.copy(group.parent!.matrixWorld).invert();
            group.matrix.multiplyMatrices(parentInverse, pop.place);
            group.matrixWorldNeedsUpdate = true;
        }
    });

    return (
        <>
            {pops.map((_, index) => (
                <group
                    key={index}
                    ref={(node) => {
                        groups.current[index] = node;
                    }}
                    matrixAutoUpdate={false}
                >
                    <mesh
                        ref={(node) => {
                            meshes.current[index] = node;
                        }}
                        visible={false}
                    />
                </group>
            ))}
        </>
    );
}
