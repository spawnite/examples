import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    Color,
    CylinderGeometry,
    MeshBasicMaterial,
    Quaternion,
    Vector3,
    type Group,
    type Mesh,
} from "three";
import { positiveY } from "@spawnite/engine";
import { blasterSettings } from "../siege/blaster";
import { emitGlow, emitSparks } from "./effects/EffectPools";

//  One shot's bolt: a white-hot core inside a glow of the shooter's colour,
//  from the muzzle to where it ended, thinning and fading over its life,
//  with a bright head that runs down it. Where the head lands it throws
//  sparks and a flash off a monster, or a puff off the ground or a stone.

/** Seconds a bolt takes to fade. */
export const beamSeconds = 0.14;
/** Seconds a lance's beam takes to fade, and times a bolt's width it
 *  burns: the heavy shot reads as heavy. */
export const heavyBeamSeconds = 0.45;
const heavyWidth = 3.5;
/** Metres a second the head runs: fast enough that it lands inside the
 *  bolt's life even at the blaster's full range. */
const headSpeed = 500;
/** Metres the head's bright streak runs along the bolt. */
const headMetres = 1.6;
/** Metres short of its range at which a bolt's end is something it struck
 *  rather than where it ran out. */
const struckMargin = 2;

const coreGeometry = new CylinderGeometry(0.025, 0.025, 1, 6, 1, true);
/** The glow narrows toward the muzzle: a warden's own bolt starts beside
 *  the camera, where a full-width glow would cover much of the screen. */
const glowGeometry = new CylinderGeometry(0.1, 0.015, 1, 8, 1, true);
const headGeometry = new CylinderGeometry(0.045, 0.045, 1, 6, 1, true);
/** How far past white the core, the head and the glow burn, so the bloom
 *  takes them. */
const coreHeat = new Color("#fffdf2").multiplyScalar(3);
const headHeat = new Color("#ffffff").multiplyScalar(6);
const glowHeat = 2.2;
const glowOpacity = 0.45;
/** How far toward white a hit's sparks and flash go from the shooter's
 *  colour, so the dusk grading keeps them bright. */
const sparkWhiteness = 0.55;
const flashWhiteness = 0.7;
const white = new Color("#ffffff");
/** A miss's puff: warm dust, dim, since it adds light to what is behind. */
const dustColor = new Color("#a08870").multiplyScalar(0.55);
const emberColor = new Color("#ffd2a0").multiplyScalar(1.6);

function createHeatMaterial(color: Color, opacity = 1) {
    return new MeshBasicMaterial({
        color,
        opacity,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
}

//  Shared by every bolt: one core and one head, and one glow a colour.
const coreMaterial = createHeatMaterial(coreHeat);
const headMaterial = createHeatMaterial(headHeat);
const glowMaterials = new Map<string, MeshBasicMaterial>();

function readGlowMaterial(color: string) {
    let material = glowMaterials.get(color);
    if (!material) {
        material = createHeatMaterial(
            new Color(color).multiplyScalar(glowHeat),
            glowOpacity,
        );
        glowMaterials.set(color, material);
    }
    return material;
}

const direction = new Vector3();
const turn = new Quaternion();
//  Written in place when a head lands.
const backward = new Vector3();
const sparkColor = new Color();
const flashColor = new Color();

interface BeamProps {
    from: Vector3;
    to: Vector3;
    color: string;
    /** Whether it ends on a monster: sparks where it lands. */
    hit?: boolean;
    /** Whether it is a lance's beam: wider, and slower to fade. */
    heavy?: boolean;
}

/** A bolt a view keeps mounted for its short life, under its own key. */
export interface DrawnBeam extends Required<BeamProps> {
    id: number;
}

/** Seconds a bolt of either weight stays mounted. */
export function measureBeamSeconds(heavy: boolean) {
    return heavy ? heavyBeamSeconds : beamSeconds;
}

interface Landing {
    from: Vector3;
    to: Vector3;
    color: Color;
    hit: boolean;
}

/** What the head throws where it lands: on a monster a spray of sparks
 *  back toward the shooter and a flash; on anything else within its
 *  range a small puff of dust and a few embers. */
function land({ from, to, color, hit }: Landing) {
    backward.subVectors(from, to).normalize();
    if (hit) {
        sparkColor.copy(color).lerp(white, sparkWhiteness).multiplyScalar(3);
        emitSparks({
            position: to,
            color: sparkColor,
            count: 6,
            speed: 8,
            toward: backward.setY(backward.y + 0.5).normalize(),
            spread: 0.9,
            seconds: 0.3,
        });
        flashColor.copy(color).lerp(white, flashWhiteness).multiplyScalar(2.5);
        emitGlow({
            position: to,
            color: flashColor,
            seconds: 0.1,
            size: 0.5,
            endSize: 1.3,
        });
        return;
    }
    if (from.distanceTo(to) > blasterSettings.range - struckMargin) return;
    emitGlow({
        position: to,
        color: dustColor,
        seconds: 0.45,
        size: 0.25,
        endSize: 0.9,
        rise: 0.5,
    });
    emitSparks({
        position: to,
        color: emberColor,
        count: 3,
        speed: 4,
        toward: backward.setY(backward.y + 0.8).normalize(),
        spread: 0.8,
        seconds: 0.25,
        width: 0.05,
    });
}

/** A bolt from `from` to `to`, placed once as it mounts, in the frame of
 *  the group the caller mounts it in. */
export function Beam({
    from,
    to,
    color,
    hit = false,
    heavy = false,
}: BeamProps) {
    const beamRef = useRef<Group>(null);
    const coreRef = useRef<Mesh>(null);
    const glowRef = useRef<Mesh>(null);
    const headRef = useRef<Mesh>(null);
    const bornRef = useRef(0);
    const landedRef = useRef(false);
    const lengthRef = useRef(0);
    const clock = useThree((state) => state.clock);
    const baseColor = useMemo(() => new Color(color), [color]);
    const glowMaterial = readGlowMaterial(color);

    useLayoutEffect(() => {
        //  The clock starts as the bolt mounts, so its head lands inside
        //  the life its caller gives it even when a frame runs long.
        bornRef.current = clock.elapsedTime;
        const beam = beamRef.current;
        if (!beam) return;
        direction.subVectors(to, from);
        const length = direction.length();
        lengthRef.current = length;
        beam.position.copy(from).addScaledVector(direction, 0.5);
        beam.quaternion.copy(
            turn.setFromUnitVectors(positiveY, direction.normalize()),
        );
        coreRef.current?.scale.set(1, length, 1);
        glowRef.current?.scale.set(1, length, 1);
    }, [from, to, clock]);

    //  A bolt taken away before its head lands still lands; a cleanup in
    //  the frame it mounted is a remount in development, not its end.
    useEffect(
        () => () => {
            if (landedRef.current) return;
            if (clock.elapsedTime <= bornRef.current) return;
            landedRef.current = true;
            land({ from, to, color: baseColor, hit });
        },
        [from, to, baseColor, hit, clock],
    );

    useFrame(() => {
        const seconds = clock.elapsedTime - bornRef.current;
        //  The materials are shared, so a bolt fades by thinning.
        const fade = Math.max(0, 1 - seconds / measureBeamSeconds(heavy));
        const width = fade * (heavy ? heavyWidth : 1);
        const length = lengthRef.current;
        coreRef.current?.scale.set(width, length, width);
        glowRef.current?.scale.set(width, length, width);
        //  The head runs from the muzzle to the end, then is gone.
        const run = (seconds * headSpeed) / Math.max(length, 0.01);
        const head = headRef.current;
        if (head) {
            const streak = Math.min(headMetres, length);
            head.visible = run < 1;
            const headWidth = heavy ? heavyWidth : 1;
            head.scale.set(headWidth, streak, headWidth);
            head.position.y =
                -length / 2 + Math.min(1, run) * length - streak / 2;
        }
        if (run >= 1 && !landedRef.current) {
            landedRef.current = true;
            land({ from, to, color: baseColor, hit });
        }
    });

    return (
        <group ref={beamRef}>
            <mesh
                ref={coreRef}
                geometry={coreGeometry}
                material={coreMaterial}
                frustumCulled={false}
            />
            <mesh
                ref={glowRef}
                geometry={glowGeometry}
                material={glowMaterial}
                frustumCulled={false}
            />
            <mesh
                ref={headRef}
                geometry={headGeometry}
                material={headMaterial}
                frustumCulled={false}
            />
        </group>
    );
}
