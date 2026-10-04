import { useMemo } from "react";
import { Color, type WebGLProgramParametersWithUniforms } from "three";
import type { SledMap } from "../maps";

/** Metres from the camera where the haze starts and where it is thickest:
 *  with no fog, the far peaks would stand at full contrast. */
const hazeNear = 260;
const hazeFar = 1100;
/** Short of 1: land the sky's exact colour has no silhouette at all. */
const hazeMost = 0.92;
/** How far up a face turns before snow lies on it, from none to all. */
const snowFrom = 0.35;
const snowTo = 0.78;

const glsl = (hex: number) => `vec3(${new Color(hex).toArray().join(", ")})`;

/** The map's cover on whatever faces up, its rock on the steep faces, and
 *  its haze over the land with distance. The land is drawn in world
 *  space, so its own normal is the world's. */
function injectCoverAndHaze(
    shader: WebGLProgramParametersWithUniforms,
    { terrain }: SledMap,
) {
    shader.vertexShader = shader.vertexShader
        .replace(
            "#include <common>",
            "#include <common>\nvarying float vUp;\nvarying float vAway;",
        )
        .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            vUp = normal.y;
            vAway = length((modelMatrix * vec4(transformed, 1.0)).xyz - cameraPosition);`,
        );
    shader.fragmentShader = shader.fragmentShader
        .replace(
            "#include <common>",
            "#include <common>\nvarying float vUp;\nvarying float vAway;",
        )
        .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            diffuseColor.rgb = mix(diffuseColor.rgb, ${glsl(terrain.cover)},
                smoothstep(${snowFrom}, ${snowTo}, vUp));`,
        )
        .replace(
            "#include <tonemapping_fragment>",
            `gl_FragColor.rgb = mix(gl_FragColor.rgb, ${glsl(terrain.haze)},
                ${hazeMost} * smoothstep(${hazeNear}.0, ${hazeFar}.0, vAway));
            #include <tonemapping_fragment>`,
        );
}

interface TerrainMaterialProps {
    attach?: string;
    map: SledMap;
}

/** The land's material, for the surface's `terrain` zone, in the map's
 *  colours. */
export function TerrainMaterial({ attach, map }: TerrainMaterialProps) {
    const shader = useMemo(
        () => ({
            inject: (shader: WebGLProgramParametersWithUniforms) =>
                injectCoverAndHaze(shader, map),
            key: () => `sled-terrain-${map.name}`,
        }),
        [map],
    );
    return (
        <meshStandardMaterial
            attach={attach}
            color={map.terrain.rock}
            roughness={0.95}
            onBeforeCompile={shader.inject}
            customProgramCacheKey={shader.key}
        />
    );
}
