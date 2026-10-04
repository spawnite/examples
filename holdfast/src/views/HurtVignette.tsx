import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait, useWorld } from "koota/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { PlaneGeometry, ShaderMaterial } from "three";
import {
    AuthorityTrait,
    HeroTrait,
    screenOverlayUserData,
    useHeadless,
    useInspect,
    WelcomesTrait,
} from "@spawnite/engine";
import { WardenTrait } from "../siege/traits";
import { useWelcomed } from "./welcomed";
import { LifeMachine } from "../siege/life";
import { PhaseTrait, readPhase } from "../siege/phase";

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
    const survivor = useTrait(
        useQueryFirst(HeroTrait, AuthorityTrait),
        WardenTrait,
    );
    const health = survivor?.health ?? 0;
    const world = useWorld();
    const isWelcomed = useWelcomed();
    const strengthRef = useRef(0);
    const lastHealthRef = useRef(health);
    const welcomesRef = useRef(world.get(WelcomesTrait)?.count ?? 0);
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
    //  The red as the last frame drew it, for a check that reads it.
    useInspect("hurt vignette", () => ({
        strength: material.uniforms.uStrength.value as number,
    }));

    useEffect(() => {
        const lost = lastHealthRef.current - health;
        lastHealthRef.current = health;
        //  A welcome, a rejoin's or a replay's seek, brings her health as it
        //  stands: a drop across it is no blow.
        const welcomes = world.get(WelcomesTrait)?.count ?? 0;
        const welcomed = welcomes !== welcomesRef.current;
        welcomesRef.current = welcomes;
        if (lost <= 0.5 || welcomed) return;
        strengthRef.current = Math.min(1, 0.45 + lost / 30);
    }, [health, world]);

    useFrame(({ clock }, delta) => {
        //  A blow before a welcome is not the moment it shows.
        if (isWelcomed()) strengthRef.current = 0;
        strengthRef.current = Math.max(
            0,
            strengthRef.current - delta / fadeSeconds,
        );
        //  Read in the frame, which may come before a welcome's render. The
        //  end screen needs no reminder that she is down.
        const down =
            world
                .queryFirst(HeroTrait, AuthorityTrait)
                ?.has(LifeMachine.is.down) === true &&
            readPhase(world.queryFirst(PhaseTrait)) !== "over";
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
            userData={screenOverlayUserData}
            renderOrder={1000}
        />
    );
}
