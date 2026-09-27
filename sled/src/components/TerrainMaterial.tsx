import { Color, type WebGLProgramParametersWithUniforms } from "three";
import { palette } from "../palette";

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

/** Snow on whatever faces up, stone on the steep faces, and the horizon's
 *  colour over the land with distance. The land is drawn in world space,
 *  so its own normal is the world's. */
function injectSnowAndHaze(shader: WebGLProgramParametersWithUniforms) {
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
            diffuseColor.rgb = mix(diffuseColor.rgb, ${glsl(palette.snowAlbedo)},
                smoothstep(${snowFrom}, ${snowTo}, vUp));`,
        )
        .replace(
            "#include <tonemapping_fragment>",
            `gl_FragColor.rgb = mix(gl_FragColor.rgb, ${glsl(palette.skyHorizon)},
                ${hazeMost} * smoothstep(${hazeNear}.0, ${hazeFar}.0, vAway));
            #include <tonemapping_fragment>`,
        );
}
const programKey = () => "sled-terrain";

/** The land's material, for the surface's `terrain` zone. */
export function TerrainMaterial({ attach }: { attach?: string }) {
    return (
        <meshStandardMaterial
            attach={attach}
            color={palette.stone}
            roughness={0.95}
            onBeforeCompile={injectSnowAndHaze}
            customProgramCacheKey={programKey}
        />
    );
}
