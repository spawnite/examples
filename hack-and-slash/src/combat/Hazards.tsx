import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "koota/react";
import type { Entity } from "koota";
import {
    AdditiveBlending,
    CircleGeometry,
    PlaneGeometry,
    RingGeometry,
    type BufferGeometry,
    type Group,
    type Mesh,
    type MeshBasicMaterial,
} from "@spawnite/engine/three";
import { elements, type Element } from "../monsters/kinds";
import { hazardFlashSeconds } from "./boss";
import { simmerHazard } from "./motes";
import { HazardTrait, HazardShape } from "./traits";

/** Drawn over the ground, as the sword's arc is, so a slope never hides a
 *  warning; under the hero, who draws after the effects. */
const overWorld = 10;
/** Metres over the ground the shapes lie. */
const lift = 0.06;

/** Each element's fill as it warns, and its flash as it goes off: always
 *  inside the same red edge, which says danger whatever the boss. */
const fills: Record<Element, string> = {
    fire: "#ff5a1f",
    moss: "#8ddc2c",
    shadow: "#a34dff",
    venom: "#b6e62a",
    grave: "#7fd8c8",
};
const flashes: Record<Element, string> = {
    fire: "#fff1c9",
    moss: "#efffd2",
    shadow: "#f0dcff",
    venom: "#f6ffd0",
    grave: "#e6fff9",
};

/** Every boss attack waiting on the ground. */
export function Hazards() {
    const hazards = useQuery(HazardTrait);
    return (
        <>
            {hazards.map((entity) => (
                <HazardView key={entity.id()} entity={entity} />
            ))}
        </>
    );
}

/** The shape's outline for its kind, flat on the ground, facing +x before
 *  its turn: a disc, a ring, a wedge, or a bar starting at the origin. */
function shapeOf(hazard: {
    shape: HazardShape;
    size: number;
    inner: number;
    spread: number;
}): BufferGeometry {
    switch (hazard.shape) {
        case HazardShape.Circle:
            return new CircleGeometry(hazard.size, 48);
        case HazardShape.Ring:
            return new RingGeometry(hazard.inner, hazard.size, 48);
        case HazardShape.Cone:
            return new CircleGeometry(
                hazard.size,
                24,
                -hazard.spread,
                hazard.spread * 2,
            );
        case HazardShape.Bar:
            return new PlaneGeometry(hazard.size, hazard.inner).translate(
                hazard.size / 2,
                0,
                0,
            );
    }
}

/** One warning: the whole shape faint, a brighter fill in the boss's
 *  element that grows to it as the warning runs out, simmering with flame
 *  or spores, and a flash as it goes off. The fill grows out from the
 *  boss for a wedge and a bar, from the middle for a disc, and brightens
 *  for a ring. */
function HazardView({ entity }: { entity: Entity }) {
    const group = useRef<Group>(null);
    const fill = useRef<Mesh>(null);
    const fillMaterial = useRef<MeshBasicMaterial>(null);
    const areaMaterial = useRef<MeshBasicMaterial>(null);
    const hazard = entity.get(HazardTrait)!;
    const geometry = useMemo(
        () => shapeOf(hazard),
        //  A hazard's shape never changes once laid.
        // eslint-disable-next-line @eslint-react/exhaustive-deps
        [],
    );

    const element = elements[hazard.element] ?? "moss";

    useFrame((_, delta) => {
        if (
            !entity.isAlive() ||
            !group.current ||
            !fill.current ||
            !fillMaterial.current ||
            !areaMaterial.current
        )
            return;
        const now = entity.get(HazardTrait)!;
        group.current.position.set(now.x, now.y + lift, now.z);
        group.current.rotation.y = Math.atan2(-now.dirZ, now.dirX);
        if (now.fired) {
            //  The blast: the whole shape white-hot, fading.
            const flash = 1 - (now.age - now.delay) / hazardFlashSeconds;
            fill.current.scale.set(1, 1, 1);
            fillMaterial.current.color.set(flashes[element]);
            fillMaterial.current.opacity = 0.9 * Math.max(0, flash);
            areaMaterial.current.opacity = 0;
            return;
        }
        const filled = Math.min(1, now.age / now.delay);
        simmerHazard(now, filled, Math.min(delta, 0.1));
        switch (now.shape) {
            case HazardShape.Circle:
            case HazardShape.Cone:
                fill.current.scale.set(filled, filled, 1);
                break;
            case HazardShape.Bar:
                fill.current.scale.set(filled, 1, 1);
                break;
            case HazardShape.Ring:
                fill.current.scale.set(1, 1, 1);
                fillMaterial.current.opacity = 0.1 + 0.4 * filled;
                return;
        }
        fillMaterial.current.opacity = 0.42;
    });

    return (
        <group ref={group}>
            <group rotation-x={-Math.PI / 2}>
                <mesh geometry={geometry} renderOrder={overWorld}>
                    <meshBasicMaterial
                        ref={areaMaterial}
                        color="#ff2d1f"
                        transparent
                        opacity={0.18}
                        depthTest={false}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
                <mesh ref={fill} geometry={geometry} renderOrder={overWorld}>
                    <meshBasicMaterial
                        ref={fillMaterial}
                        color={fills[element]}
                        transparent
                        opacity={0.42}
                        blending={AdditiveBlending}
                        depthTest={false}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            </group>
        </group>
    );
}
