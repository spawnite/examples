import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait } from "koota/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { PlaneGeometry, ShaderMaterial } from "three";
import { Authority, Hero, useHeadless } from "@spawnite/engine";
import { SiegePhase, SiegeTrait, WardenTrait } from "../siege/traits";

//  Red at the edges of the screen when she takes a blow, fading in half a
//  second, and a slow red pulse while she is down: her own health read
//  without looking at the bar. A quad drawn straight into clip space, so it
//  covers the screen whatever the camera does.

const quadGeometry = new PlaneGeometry(2, 2);

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uStrength;
varying vec2 vUv;
void main() {
    float edge = smoothstep(0.3, 0.95, length((vUv - 0.5) * vec2(1.6, 1.2)));
    gl_FragColor = vec4(0.75, 0.04, 0.04, edge * uStrength);
}`;

/** Seconds a blow's red takes to fade. */
const fadeSeconds = 0.5;

export function HurtVignette() {
    const headless = useHeadless();
    const survivor = useTrait(useQueryFirst(Hero, Authority), WardenTrait);
    const health = survivor?.health ?? 0;
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    //  The end screen needs no reminder that she is down.
    const down = (survivor?.down ?? false) && siege?.phase !== SiegePhase.Over;
    const strengthRef = useRef(0);
    const lastHealthRef = useRef(health);
    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: vertex,
                fragmentShader: fragment,
                uniforms: { uStrength: { value: 0 } },
                transparent: true,
                depthTest: false,
                depthWrite: false,
            }),
        [],
    );
    useLayoutEffect(() => () => material.dispose(), [material]);

    useEffect(() => {
        const lost = lastHealthRef.current - health;
        lastHealthRef.current = health;
        if (lost <= 0.5) return;
        strengthRef.current = Math.min(1, 0.45 + lost / 30);
    }, [health]);

    useFrame(({ clock }, delta) => {
        strengthRef.current = Math.max(
            0,
            strengthRef.current - delta / fadeSeconds,
        );
        const pulse = down ? 0.45 + Math.sin(clock.elapsedTime * 3) * 0.15 : 0;
        material.uniforms.uStrength.value = Math.max(
            strengthRef.current,
            pulse,
        );
    });

    if (headless) return null;
    return (
        <mesh
            geometry={quadGeometry}
            material={material}
            frustumCulled={false}
            renderOrder={1000}
        />
    );
}
