import { useFrame, useThree } from "@react-three/fiber";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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
import { topTier } from "../siege/guns";
import { emitGlow, emitSparks } from "./effects/EffectPools";
import { addLatePose } from "./warden/latePoses";
import { findMuzzle } from "./warden/muzzles";

//  One shot's line: a white-hot core inside a glow of the shooter's colour,
//  from her barrel to where it ended, thinning and fading over its life,
//  with a bright head that runs down it. Where the head lands it throws
//  sparks and a flash off a monster, or a puff off the ground or a stone.
//  Each gun draws its own: the blaster a bolt, the scattergun a spray of
//  short, thin pellets, the rail a thick white line that hangs a moment,
//  and the lance a heavy beam. Each upgrade tier burns a gun's line a
//  little wider and throws more sparks, and the top tier's core and head
//  burn gold, the colour of the gold band on its barrel.

/** Which gun drew a line, which sets how it looks. */
export enum BeamKind {
    Bolt = "bolt",
    Pellet = "pellet",
    Rail = "rail",
    Lance = "lance",
}

/** How each kind draws: seconds it takes to fade, times a bolt's width
 *  it burns, and times a bolt's sparks where it lands. */
const beamLooks: Record<
    BeamKind,
    { seconds: number; width: number; sparks: number }
> = {
    [BeamKind.Bolt]: { seconds: 0.14, width: 1, sparks: 1 },
    [BeamKind.Pellet]: { seconds: 0.1, width: 0.55, sparks: 0.6 },
    [BeamKind.Rail]: { seconds: 0.55, width: 2.6, sparks: 1.8 },
    [BeamKind.Lance]: { seconds: 0.45, width: 3.5, sparks: 1.4 },
};

/** Metres a second the head runs: fast enough that it lands inside the
 *  bolt's life even at the blaster's full range. */
const headSpeed = 500;
/** Metres the head's bright streak runs along the bolt. */
const headMetres = 1.6;
/** Metres short of its range at which a line's end is something it struck
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
/** The top tier's core and head: gold, short of the weak spot's deeper
 *  amber, so a weak spot's mark still reads above it. */
const topCoreMaterial = createHeatMaterial(
    new Color("#ffe6b0").multiplyScalar(3),
);
const topHeadMaterial = createHeatMaterial(
    new Color("#fff0c8").multiplyScalar(6),
);
/** How much wider each tier burns a line, and how many more sparks it
 *  throws, as a share of its tier-0 look. */
const tierWidth = 0.15;
const tierSparks = 0.2;
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
/** Where a line starts this draw. */
const start = new Vector3();
//  Written in place when a head lands.
const backward = new Vector3();
const sparkColor = new Color();
const flashColor = new Color();

export interface BeamProps {
    from: Vector3;
    to: Vector3;
    color: string;
    /** Whether it ends on a monster: sparks where it lands. */
    hit?: boolean;
    kind?: BeamKind;
    /** Metres its gun reaches, past which its end is where it ran out. */
    range?: number;
    /** Its gun's upgrade tier, 0 to 3. */
    tier?: number;
    /** The hue of the warden who fired it: its start stays at her barrel
     *  as each draw holds it, wherever she moves, while it shows. Null
     *  keeps it at `from`. */
    shooter?: number | null;
}

/** A line a view keeps mounted for its short life, under its own key. */
export interface DrawnBeam extends Required<BeamProps> {
    id: number;
}

/** Seconds a line of `kind` stays mounted. */
export function measureBeamSeconds(kind: BeamKind) {
    return beamLooks[kind].seconds;
}

/** A line and the second on the canvas's clock it stays mounted until. */
interface ShownBeam {
    beam: DrawnBeam;
    until: number;
}

/** The lines a view keeps mounted, each until the canvas's clock has run
 *  its kind's life, so a held page or a replay held on a moment keeps
 *  them drawn. Returns the lines, a function that shows more from now,
 *  and one that rewrites the lines shown. */
export function useBeams() {
    const clock = useThree((state) => state.clock);
    const [shown, setShown] = useState<ShownBeam[]>([]);
    useFrame(() => {
        const now = clock.elapsedTime;
        if (shown.some(({ until }) => now >= until))
            setShown((lines) => lines.filter(({ until }) => now < until));
    });
    const beams = useMemo(() => shown.map(({ beam }) => beam), [shown]);
    //  Stable, so an effect may name them without running each render.
    const showBeams = useCallback(
        (drawn: readonly DrawnBeam[]) => {
            const now = clock.elapsedTime;
            setShown((lines) => [
                ...lines,
                ...drawn.map((beam) => ({
                    beam,
                    until: now + measureBeamSeconds(beam.kind),
                })),
            ]);
        },
        [clock],
    );
    const rewriteBeams = useCallback(
        (rewrite: (beam: DrawnBeam) => DrawnBeam) =>
            setShown((lines) =>
                lines.map((line) => ({ ...line, beam: rewrite(line.beam) })),
            ),
        [],
    );
    return { beams, showBeams, rewriteBeams };
}

/** Places `beam` along the line from `from` to `to`, and returns its
 *  length. */
function placeBeam(beam: Group, from: Vector3, to: Vector3) {
    direction.subVectors(to, from);
    const length = direction.length();
    beam.position.copy(from).addScaledVector(direction, 0.5);
    beam.quaternion.copy(
        turn.setFromUnitVectors(positiveY, direction.normalize()),
    );
    return length;
}

/** The meshes a line is drawn with. */
interface BeamParts {
    core: Mesh | null;
    glow: Mesh | null;
    head: Mesh | null;
}

/** A line's age, its length, and its gun's look. */
interface BeamShape {
    seconds: number;
    length: number;
    kind: BeamKind;
    tier: number;
}

/** Thins a line as it fades and runs its head from its start to its end,
 *  for its age and its length. Returns how far the head has run, as a
 *  share of the line. */
function shapeBeam(
    { core, glow, head }: BeamParts,
    { seconds, length, kind, tier }: BeamShape,
) {
    //  The materials are shared, so a bolt fades by thinning.
    const look = beamLooks[kind];
    const fade = Math.max(0, 1 - seconds / look.seconds);
    const tierWide = look.width * (1 + tierWidth * tier);
    //  A rail's line thins slowly at first, so it hangs in the air.
    const width = (kind === BeamKind.Rail ? Math.sqrt(fade) : fade) * tierWide;
    core?.scale.set(width, length, width);
    glow?.scale.set(width, length, width);
    //  The head runs from the start to the end, then is gone.
    const run = (seconds * headSpeed) / Math.max(length, 0.01);
    if (head) {
        const streak = Math.min(headMetres, length);
        head.visible = run < 1;
        head.scale.set(tierWide, streak, tierWide);
        head.position.y = -length / 2 + Math.min(1, run) * length - streak / 2;
    }
    return run;
}

interface Landing {
    from: Vector3;
    to: Vector3;
    color: Color;
    hit: boolean;
    kind: BeamKind;
    range: number;
    tier: number;
}

/** What the head throws where it lands: on a monster a spray of sparks
 *  back toward the shooter and a flash; on anything else within its
 *  range a small puff of dust and a few embers. */
function land({ from, to, color, hit, kind, range, tier }: Landing) {
    backward.subVectors(from, to).normalize();
    const sparks = beamLooks[kind].sparks * (1 + tierSparks * tier);
    if (hit) {
        sparkColor.copy(color).lerp(white, sparkWhiteness).multiplyScalar(3);
        emitSparks({
            position: to,
            color: sparkColor,
            count: Math.round(6 * sparks),
            speed: 8 * Math.sqrt(sparks),
            toward: backward.setY(backward.y + 0.5).normalize(),
            spread: 0.9,
            seconds: 0.3,
        });
        flashColor.copy(color).lerp(white, flashWhiteness).multiplyScalar(2.5);
        emitGlow({
            position: to,
            color: flashColor,
            seconds: 0.1,
            size: 0.5 * sparks,
            endSize: 1.3 * sparks,
        });
        return;
    }
    if (from.distanceTo(to) > range - struckMargin) return;
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

/** A bolt from `from`, or from the barrel of the warden who fired it, to
 *  `to`, in the world's frame: its caller mounts it in the scene. */
export function Beam({
    from,
    to,
    color,
    hit = false,
    kind = BeamKind.Bolt,
    range = blasterSettings.range,
    tier = 0,
    shooter = null,
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
    const readParts = () => ({
        core: coreRef.current,
        glow: glowRef.current,
        head: headRef.current,
    });

    useLayoutEffect(() => {
        //  The clock starts as the bolt mounts, so its head lands inside
        //  the life its caller gives it even when a frame runs long.
        bornRef.current = clock.elapsedTime;
        const beam = beamRef.current;
        if (!beam) return;
        lengthRef.current = placeBeam(beam, from, to);
        shapeBeam(readParts(), {
            seconds: 0,
            length: lengthRef.current,
            kind,
            tier,
        });
    }, [from, to, clock, kind, tier]);

    //  Her barrel moves with her while the line shows: running at 6 m/s,
    //  a start left where she fired trails her gun by 0.8 m by the end of
    //  a bolt's 0.14 s. So each draw starts the line where that draw holds
    //  her barrel: her hold, a late pose added before this one, has
    //  settled it by then, whatever order the frame's callbacks ran in.
    useLayoutEffect(() => {
        if (shooter === null) return;
        return addLatePose(() => {
            const beam = beamRef.current;
            if (!beam || !findMuzzle(shooter, start)) return;
            lengthRef.current = placeBeam(beam, start, to);
            shapeBeam(readParts(), {
                seconds: clock.elapsedTime - bornRef.current,
                length: lengthRef.current,
                kind,
                tier,
            });
            //  The renderer updated the world's matrices before the late
            //  poses.
            beam.updateMatrixWorld(true);
        });
    }, [shooter, to, clock, kind, tier]);

    //  A bolt taken away before its head lands still lands; a cleanup in
    //  the frame it mounted is a remount in development, not its end.
    useEffect(
        () => () => {
            if (landedRef.current) return;
            if (clock.elapsedTime <= bornRef.current) return;
            landedRef.current = true;
            land({ from, to, color: baseColor, hit, kind, range, tier });
        },
        [from, to, baseColor, hit, kind, range, tier, clock],
    );

    useFrame(() => {
        const run = shapeBeam(readParts(), {
            seconds: clock.elapsedTime - bornRef.current,
            length: lengthRef.current,
            kind,
            tier,
        });
        if (run >= 1 && !landedRef.current) {
            landedRef.current = true;
            land({ from, to, color: baseColor, hit, kind, range, tier });
        }
    });
    const top = tier >= topTier;

    return (
        <group ref={beamRef}>
            <mesh
                ref={coreRef}
                geometry={coreGeometry}
                material={top ? topCoreMaterial : coreMaterial}
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
                material={top ? topHeadMaterial : headMaterial}
                frustumCulled={false}
            />
        </group>
    );
}
