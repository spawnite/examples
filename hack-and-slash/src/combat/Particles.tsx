import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    NormalBlending,
    Points,
    ShaderMaterial,
    Vector2,
} from "@spawnite/engine/three";
import { useDetail, type Detail } from "../view/graphics";
import {
    clearParticles,
    glowPool,
    setParticleShare,
    solidPool,
    stepPool,
    type Pool,
} from "./motes";

/** The share of the motes each graphics level draws. */
const shares: Record<Detail, number> = {
    minimum: 0.2,
    low: 0.4,
    medium: 0.7,
    high: 1,
};

/** Drawn with the fight's other effects, after the world. */
const overWorld = 11;

//  Each mote a round soft point, `size` metres across wherever it stands,
//  fading from its middle; the glowing pool adds its light, the solid one
//  covers what is behind it.
const vertexShader = /* glsl */ `
attribute vec4 tint;
attribute float size;
uniform float uScale;
varying vec4 vTint;
void main() {
    vTint = tint;
    vec4 place = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * place;
    gl_PointSize = size * uScale / max(0.1, -place.z);
}
`;
const fragmentShader = /* glsl */ `
varying vec4 vTint;
void main() {
    float out_ = length(gl_PointCoord - 0.5) * 2.0;
    if (out_ > 1.0) discard;
    float alpha = vTint.a * (1.0 - out_ * out_);
    #ifdef GLOWING
        gl_FragColor = vec4(vTint.rgb * alpha, alpha);
    #else
        gl_FragColor = vec4(vTint.rgb, alpha);
    #endif
}
`;

/** The points a pool is drawn by, and what writes them each frame. */
function usePoints(pool: Pool, glowing: boolean) {
    return useMemo(() => {
        const geometry = new BufferGeometry();
        const place = new BufferAttribute(new Float32Array(pool.size * 3), 3);
        const tint = new BufferAttribute(new Float32Array(pool.size * 4), 4);
        const size = new BufferAttribute(new Float32Array(pool.size), 1);
        for (const attribute of [place, tint, size]) attribute.setUsage(35048);
        geometry.setAttribute("position", place);
        geometry.setAttribute("tint", tint);
        geometry.setAttribute("size", size);
        geometry.setDrawRange(0, 0);
        const material = new ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: { uScale: { value: 1 } },
            defines: glowing ? { GLOWING: "" } : {},
            transparent: true,
            depthWrite: false,
            blending: glowing ? AdditiveBlending : NormalBlending,
        });
        const points = new Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = overWorld + (glowing ? 1 : 0);
        //  Writes the living motes to the front of the buffers.
        const write = () => {
            let count = 0;
            for (let at = 0; at < pool.size; at++) {
                const life = pool.life[at];
                if (life === 0) continue;
                const t = pool.age[at] / life;
                place.array[count * 3] = pool.x[at];
                place.array[count * 3 + 1] = pool.y[at];
                place.array[count * 3 + 2] = pool.z[at];
                tint.array[count * 4] =
                    pool.red[at] + (pool.redTo[at] - pool.red[at]) * t;
                tint.array[count * 4 + 1] =
                    pool.green[at] + (pool.greenTo[at] - pool.green[at]) * t;
                tint.array[count * 4 + 2] =
                    pool.blue[at] + (pool.blueTo[at] - pool.blue[at]) * t;
                //  In quickly, out slowly.
                tint.array[count * 4 + 3] =
                    pool.alpha[at] * Math.min(1, t * 8) * (1 - t);
                size.array[count] =
                    pool.sizeFrom[at] +
                    (pool.sizeTo[at] - pool.sizeFrom[at]) * t;
                count += 1;
            }
            geometry.setDrawRange(0, count);
            if (count === 0) return;
            place.addUpdateRange(0, count * 3);
            tint.addUpdateRange(0, count * 4);
            size.addUpdateRange(0, count);
            place.needsUpdate = true;
            tint.needsUpdate = true;
            size.needsUpdate = true;
        };
        return { points, material, geometry, write };
    }, [pool, glowing]);
}

//  Written in place each frame.
const buffer = new Vector2();

/** The fight's motes, moved and drawn each frame. Mounted once in the
 *  wilds. */
export function Particles() {
    const detail = useDetail();
    const glow = usePoints(glowPool, true);
    const solid = usePoints(solidPool, false);

    useEffect(() => setParticleShare(shares[detail]), [detail]);
    useEffect(
        () => () => {
            clearParticles();
            for (const each of [glow, solid]) {
                each.geometry.dispose();
                each.material.dispose();
            }
        },
        [glow, solid],
    );

    useFrame(({ gl, camera }, delta) => {
        const seconds = Math.min(delta, 0.1);
        //  A metre at a metre away, in the canvas's own pixels.
        const scale =
            (gl.getDrawingBufferSize(buffer).y *
                camera.projectionMatrix.elements[5]) /
            2;
        for (const [each, pool] of [
            [glow, glowPool],
            [solid, solidPool],
        ] as const) {
            stepPool(pool, seconds);
            each.write();
            each.material.uniforms.uScale.value = scale;
        }
    });

    return (
        <>
            <primitive object={solid.points} />
            <primitive object={glow.points} />
        </>
    );
}
