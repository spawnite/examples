import { Color, FrontSide, MeshStandardMaterial, type Material } from "three";
import { useTime } from "@spawnite/engine";

//  The void spirit's look, as its story in Storybook draws it with the
//  smoke body, at the glow and the speed the maintainer picked there.
//  ponytail: a second copy of the story's shader; the third user moves it
//  somewhere both can import.

const glow = 0.65;
/** How fast the smoke drifts, as a share of real time. */
const speed = 0.3;
const azure = new Color("#3f86ff");
const ember = new Color("#ff7414");

const uniforms = {
    //  Read by three each time it draws, so the clock needs no frame loop.
    uTime: {
        get value() {
            //  The world's own seconds, so the smoke holds while the game
            //  pauses and slows with it.
            return useTime.getState().seconds * speed;
        },
    },
    uGlow: { value: glow },
    uRim: { value: azure },
    uEmber: { value: ember },
};

/** For `<Player material>`: the spirit's own texture lit azure from within
 *  under drifting smoke, white at the outline, the scar burning amber, the
 *  eyes white, and the chest star's centre pitch black with faint stars
 *  behind it. */
export function makeSpiritGlowMaterial(original: Material): Material {
    const map = original instanceof MeshStandardMaterial ? original.map : null;
    const material = new MeshStandardMaterial({
        map,
        color: new Color(0.55, 0.6, 0.75),
        emissiveMap: map,
        emissive: new Color("#8fbcff"),
        emissiveIntensity: 1.3,
        roughness: 0.35,
        metalness: 0,
        transparent: true,
        opacity: 0.92,
        side: FrontSide,
    });
    //  Three keys the program by this each draw; its default, the source
    //  of onBeforeCompile as text, is a string of kilobytes every frame.
    material.customProgramCacheKey = () => "spirit-glow";
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec3 vSpaceWorld;\nvarying vec3 vSpaceLocal;",
            )
            //  The rest pose's place, before the skin moves it, so the void
            //  and the smoke stay on the body as it walks.
            .replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\nvSpaceLocal = transformed;",
            )
            .replace(
                "#include <project_vertex>",
                "#include <project_vertex>\nvSpaceWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
                uniform float uTime;
                uniform float uGlow;
                uniform vec3 uRim;
                uniform vec3 uEmber;
                #include "lygia/generative/fbm.glsl"
                //  A typical body texel, linear, painted over the scar's band.
                const vec3 bodyBlue = vec3(0.1, 0.26, 0.89);
                //  The chest star's centre in the model's frame, measured on
                //  this one model, and the reach round it that may turn void.
                const vec3 starCentre = vec3(0.0, 0.56, 0.1);
                const float starReach = 0.12;
                varying vec3 vSpaceWorld;
                varying vec3 vSpaceLocal;
                float spaceHash(vec3 cell) {
                    return fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
                }
                /** Stars in cells of \`size\` metres, \`depth\` metres behind the surface. */
                float spaceStars(vec3 into, float depth, float size) {
                    vec3 at = (vSpaceWorld + into * depth) / size;
                    float seed = spaceHash(floor(at));
                    float near = 1.0 - smoothstep(0.0, 0.25, length(fract(at) - 0.5));
                    float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + 3.0 * seed) + seed * 60.0);
                    return step(0.9, seed) * near * twinkle;
                }`,
            )
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
                float voidMask = 0.0;
                float warm = 0.0;
                float hot = 0.0;
                float eye = 0.0;
                #ifdef USE_MAP
                //  The texture is sRGB, so these texels are linear.
                vec3 texel = texture2D(map, vMapUv).rgb;
                float nearStar = 1.0 - smoothstep(starReach * 0.8, starReach, length(vSpaceLocal - starCentre));
                voidMask = nearStar * (1.0 - smoothstep(0.1, 0.16, max(texel.r, max(texel.g, texel.b))));
                //  Only the warmest core of the texture's wide scar band burns.
                warm = smoothstep(0.12, 0.35, texel.r - texel.b) * (1.0 - voidMask);
                hot = smoothstep(0.56, 0.66, texel.r - texel.b) * (1.0 - voidMask);
                eye = smoothstep(0.55, 0.75, min(texel.r, min(texel.g, texel.b)));
                #endif
                diffuseColor.rgb = mix(diffuseColor.rgb, bodyBlue * diffuse, warm);
                totalEmissiveRadiance = mix(totalEmissiveRadiance, bodyBlue * emissive, warm);
                //  Smoke, as the engine's energy orb draws it: two layers of
                //  noise, the second warped by the first, in the model's own
                //  space because Meshy cuts its UVs into small patches.
                vec3 body = vSpaceLocal * 5.0;
                float feature = max(max(voidMask, eye), warm);
                float near = 0.5 + 0.5 * fbm(body * 0.9 + vec3(0.0, uTime * 0.36, 0.0));
                float far = 0.5 + 0.5 * fbm(body * 1.6 - vec3(uTime * 0.24, 0.0, uTime * 0.15) + near * 1.8);
                float veil = smoothstep(0.35, 0.75, far);
                vec3 smoke = mix(vec3(0.02, 0.05, 0.25), vec3(0.15, 0.35, 1.0), near * 1.2);
                smoke = mix(smoke, vec3(0.3, 0.55, 1.2), veil * 0.65);
                totalEmissiveRadiance = mix(totalEmissiveRadiance, smoke, 0.6 * (1.0 - feature));
                float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
                float rim = pow(1.0 - facing, 2.0);
                float pulse = 0.85 + 0.15 * sin(uTime * 2.0);
                totalEmissiveRadiance *= uGlow;
                totalEmissiveRadiance += vec3(0.2, 0.4, 0.9) * 0.35 * uGlow;
                totalEmissiveRadiance += mix(uRim * 3.0, vec3(2.6), pow(rim, 3.0)) * rim * uGlow * pulse;
                //  Blue light on the scar's tan would read white or pink.
                totalEmissiveRadiance *= 1.0 - hot;
                diffuseColor.rgb *= 1.0 - hot;
                totalEmissiveRadiance += uEmber * hot * 3.2 * uGlow * (0.75 + 0.25 * sin(uTime * 3.1));
                totalEmissiveRadiance += vec3(3.0) * eye * uGlow;`,
            )
            //  After tone mapping, so the void stays pitch black whatever
            //  the lights or the rim.
            .replace(
                "#include <dithering_fragment>",
                `#include <dithering_fragment>
                vec3 into = normalize(vSpaceWorld - cameraPosition);
                float stars = spaceStars(into, 0.02, 0.006) + 0.7 * spaceStars(into, 0.06, 0.009) + 0.45 * spaceStars(into, 0.15, 0.014);
                gl_FragColor = mix(gl_FragColor, vec4(vec3(0.75, 0.85, 1.0) * stars, 1.0), voidMask);`,
            );
    };
    return material;
}
