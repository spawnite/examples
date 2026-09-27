import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial, PlaneGeometry } from "three";
import { Shader, useTime } from "@spawnite/engine";
import { Fire } from "./Fire";
import {
    hearthLeaningLogModel,
    hearthLogsModel,
    hearthStonesModel,
    useModelShape,
} from "./models";
import { createStoneMaterial } from "./stoneMaterial";

//  What a page draws of the hearth: a ring of fitted stones, a bed of logs
//  whose undersides glow with embers and four more leant in over it, and
//  the fire. The fire's light belongs to the hearth, mounted from the start.

/** The ring of stones, 0.54 across and 0.08 tall in its file, drawn 2.4 m
 *  across and chunkier. */
const stonesScale: [number, number, number] = [4.5, 6.5, 4.5];
/** The logs, 0.29 across and 0.06 tall in their file. */
const logsScale: [number, number, number] = [4.6, 6.5, 4.6];

const hearthStones = createStoneMaterial({ height: 0.078, runes: false });

const emberTime = { value: 0 };

/** Charred wood, glowing from below where the fire sits in it. */
const logMaterial = new MeshStandardMaterial({
    color: "#34241a",
    roughness: 0.9,
    flatShading: true,
});
logMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = emberTime;
    shader.vertexShader = shader.vertexShader
        .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vEmberLocal;",
        )
        .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvEmberLocal = position;",
        );
    shader.fragmentShader = shader.fragmentShader
        .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vEmberLocal;\nuniform float uTime;",
        )
        .replace(
            "#include <emissivemap_fragment>",
            /* glsl */ `#include <emissivemap_fragment>
float emberLow = 1.0 - smoothstep(0.0, 0.02, vEmberLocal.y);
float emberInner = 1.0 - smoothstep(0.03, 0.14, length(vEmberLocal.xz));
float emberFlicker = 0.65 + 0.35 * sin(uTime * 5.0 + vEmberLocal.x * 90.0 + vEmberLocal.z * 70.0);
totalEmissiveRadiance += vec3(1.0, 0.36, 0.08) * 2.4 * emberFlicker * emberLow * (0.35 + emberInner * 0.65);`,
        );
};

/** The logs leant in over the fire, their tops meeting above it. */
const leaningLogTurns = [0.3, 1.9, 3.4, 4.9];
const charMaterial = new MeshStandardMaterial({
    color: "#2e2119",
    roughness: 0.95,
    flatShading: true,
});

/** A soft round glow of embers under the logs. */
const bedFragment = /* glsl */ `
void main() {
    float fromMiddle = length(vUv - 0.5) * 2.0;
    float glow = pow(max(1.0 - fromMiddle, 0.0), 1.5);
    float flicker = 0.85 + 0.15 * sin(uTime * 7.0 + fromMiddle * 9.0);
    gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * 2.0 * flicker, glow);
}`;

const bedGeometry = new PlaneGeometry(1, 1);

export function HearthModel() {
    const stones = useModelShape(hearthStonesModel);
    const logs = useModelShape(hearthLogsModel);
    const leaningLog = useModelShape(hearthLeaningLogModel);
    useFrame(() => {
        emberTime.value = useTime.getState().seconds;
    });

    return (
        <>
            <mesh
                geometry={stones}
                material={hearthStones}
                scale={stonesScale}
                castShadow
                receiveShadow
            />
            <mesh
                geometry={logs}
                material={logMaterial}
                scale={logsScale}
                position-y={0.04}
                rotation-y={0.4}
                castShadow
            />
            {leaningLogTurns.map((turn) => (
                <group key={turn} rotation-y={turn}>
                    <mesh
                        geometry={leaningLog}
                        material={charMaterial}
                        scale={[1.1, 1.1, 1.7]}
                        position={[0, 0.3, 0.42]}
                        rotation-x={0.85}
                        castShadow
                    />
                </group>
            ))}
            <mesh
                geometry={bedGeometry}
                position-y={0.07}
                rotation-x={-Math.PI / 2}
                scale={1.5}
            >
                <Shader fragment={bedFragment} transparent />
            </mesh>
            <Fire />
        </>
    );
}
