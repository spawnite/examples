import { useFrame } from "@react-three/fiber";
import type { Entity } from "koota";
import { useTrait, useWorld } from "koota/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    CircleGeometry,
    Color,
    MeshBasicMaterial,
    RingGeometry,
    Vector3,
    type Group,
    type Mesh,
} from "three";
import { fixedStepSeconds, TransformTrait, useRoom } from "@spawnite/engine";
import { slamRadiusMetres, slamWindUpSeconds } from "../../siege/attacks";
import { SlamTrait } from "../../siege/traits";
import { shakeView } from "../shakes";
import { measureProgress } from "./motion";

//  A colossus's slam as a page draws it: while it winds up, a ring on the
//  ground where the blow lands, filling in from its middle as the blow
//  comes, and as it lands, a shockwave running out from there. The fill
//  stands on the room's step the wind-up began on, so a page that joins
//  or seeks mid-wind-up shows it as far as the blow has come.

/** Seconds the shockwave takes to run out and fade. */
const shockSeconds = 0.5;
/** How far the shockwave runs, as a share of the slam's reach. */
const shockReach = 1.3;
/** How hard a landed blow shakes the camera, and the metres from it at
 *  which the shake fades to none. */
const slamShake = 0.45;
const slamShakeMetres = 20;

const white = new Color("#ffffff");
/** Short of full saturation, so its brightest part burns toward white
 *  under the tone mapping, as a hot light does. */
const warningColor = new Color("#ff5a3c").lerp(white, 0.3);
const fillGeometry = new CircleGeometry(1, 48);
const edgeGeometry = new RingGeometry(0.95, 1, 64);
const shockGeometry = new RingGeometry(0.82, 1, 64);

function createGlow(color: Color) {
    return new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
}

/** Eases a 0 to 1 progress out: fast at first, settling at the end. */
function easeOut(progress: number) {
    return 1 - (1 - progress) * (1 - progress) * (1 - progress);
}

/** What the view keeps between frames. Times are seconds of the page's
 *  clock: NaN marks one the next frame sets, -Infinity one not yet
 *  seen. */
interface SlamClock {
    winding: boolean;
    slams: number;
    /** The room's step the wind-up began on. */
    windUpStep: number;
    /** When the page saw the wind-up begin, for the fill before the room's
     *  first answer to a ping, while the page's clock names no step. */
    windingAt: number;
    slammedAt: number;
    /** Where the blow lands, on the ground, and how far it reaches. */
    place: Vector3;
    radius: number;
}

interface SlamViewProps {
    entity: Entity;
}

export function SlamView({ entity }: SlamViewProps) {
    const slam = useTrait(entity, SlamTrait);
    const winding = slam?.winding ?? false;
    const slams = slam?.slams ?? 0;
    const windUpStep = slam?.windUpStep ?? 0;
    const x = slam?.x ?? 0;
    const z = slam?.z ?? 0;
    const radius = slam?.radius || slamRadiusMetres;
    const materials = useMemo(
        () => ({
            fill: createGlow(warningColor),
            edge: createGlow(warningColor.clone().multiplyScalar(1.6)),
            shock: createGlow(warningColor.clone().multiplyScalar(1.8)),
        }),
        [],
    );
    useLayoutEffect(
        () => () => {
            for (const material of Object.values(materials)) material.dispose();
        },
        [materials],
    );
    const groupRef = useRef<Group>(null);
    const fillRef = useRef<Mesh>(null);
    const edgeRef = useRef<Mesh>(null);
    const shockRef = useRef<Mesh>(null);
    //  The first slam count the stream brings starts no shockwave.
    const clockRef = useRef<SlamClock>({
        winding: false,
        slams,
        windUpStep,
        windingAt: -Infinity,
        slammedAt: -Infinity,
        place: new Vector3(),
        radius,
    });

    const world = useWorld();
    useEffect(() => {
        const clock = clockRef.current;
        const landed = slams > clock.slams;
        if (winding && !clock.winding) clock.windingAt = Number.NaN;
        if (landed) clock.slammedAt = Number.NaN;
        clock.winding = winding;
        clock.slams = slams;
        clock.windUpStep = windUpStep;
        clock.radius = radius;
        clock.place.set(x, entity.get(TransformTrait)?.y ?? 0, z);
        //  The ground shakes under the blow, hardest for a warden in it.
        if (landed)
            shakeView(world, {
                strength: slamShake,
                at: clock.place,
                radius: slamShakeMetres,
            });
    }, [entity, world, winding, slams, windUpStep, x, z, radius]);

    useFrame(({ clock: pageClock }) => {
        const group = groupRef.current;
        const fill = fillRef.current;
        const edge = edgeRef.current;
        const shock = shockRef.current;
        if (!group || !fill || !edge || !shock) return;
        const now = pageClock.elapsedTime;
        const clock = clockRef.current;
        if (Number.isNaN(clock.windingAt)) clock.windingAt = now;
        if (Number.isNaN(clock.slammedAt)) clock.slammedAt = now;
        group.position.copy(clock.place);
        //  The ring fills in from its middle as the blow comes, throbbing
        //  as the colossus does.
        fill.visible = clock.winding;
        edge.visible = clock.winding;
        //  The room's step the page draws the colossus at.
        const step = useRoom.getState().readViewStep();
        const filled = measureProgress(
            step === null
                ? now - clock.windingAt
                : (step - clock.windUpStep) * fixedStepSeconds,
            slamWindUpSeconds,
        );
        const throb = 0.75 + 0.25 * Math.sin(now * 18);
        fill.scale.setScalar(clock.radius * Math.max(filled, 0.001));
        edge.scale.setScalar(clock.radius);
        materials.fill.opacity = (0.2 + 0.25 * filled) * throb;
        materials.edge.opacity = 0.9 * throb;
        const age = measureProgress(now - clock.slammedAt, shockSeconds);
        shock.visible = age < 1;
        shock.scale.setScalar(clock.radius * (0.2 + easeOut(age) * shockReach));
        materials.shock.opacity = (1 - age) * (1 - age);
    });

    return (
        <group ref={groupRef}>
            <mesh
                ref={fillRef}
                geometry={fillGeometry}
                material={materials.fill}
                rotation-x={-Math.PI / 2}
                position-y={0.05}
                visible={false}
            />
            <mesh
                ref={edgeRef}
                geometry={edgeGeometry}
                material={materials.edge}
                rotation-x={-Math.PI / 2}
                position-y={0.06}
                visible={false}
            />
            <mesh
                ref={shockRef}
                geometry={shockGeometry}
                material={materials.shock}
                rotation-x={-Math.PI / 2}
                position-y={0.07}
                visible={false}
            />
        </group>
    );
}
