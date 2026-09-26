import { Shader } from "@spawnite/engine";

//  Edit from void main() on. The engine declares uTime, uPointer and vUv
//  ahead of it, and one uniform per uniforms key below.
const fragment = `#include "lygia/generative/snoise.glsl"

void main() {
    float noise = 0.5 + 0.5 * snoise(vec3(vUv * uScale, uTime * uSpeed));
    gl_FragColor = vec4(vec3(noise), 1.0);
}`;

export interface FeatureMaterialProps {
    /** How fast the pattern changes, per second of world time. */
    speed?: number;
    /** How many cells of the pattern cross the mesh. */
    scale?: number;
}

/** The material of the mesh it sits in: what Feature draws, in one line. */
export function FeatureMaterial({
    speed = 0.5,
    scale = 4,
}: FeatureMaterialProps) {
    return (
        <Shader
            fragment={fragment}
            uniforms={{ uSpeed: speed, uScale: scale }}
        />
    );
}
