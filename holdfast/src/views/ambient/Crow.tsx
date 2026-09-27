import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait, useTraitEffect, useWorld } from "koota/react";
import { useEffect, useMemo, useRef } from "react";
import {
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    InstancedMesh,
    Mesh,
    MeshStandardMaterial,
    Raycaster,
    Shape,
    ShapeGeometry,
    SphereGeometry,
    Vector3,
    type Group,
    type Intersection,
    type Object3D,
} from "three";
import {
    Ground,
    ShotResults,
    useHeadless,
    useWorldEntity,
} from "@spawnite/engine";
import { SiegePhase, SiegeTrait } from "../../siege/traits";
import { standingStones } from "../layout";
import { CrowStage, readCrowFlight } from "./crowFlight";

//  A crow on top of a standing stone. It looks about and hops now and then,
//  and at the run's first shot it springs up and flies off over the forest,
//  gone until the next run.

/** The stone it sits on, beside the north road's gate. */
const perchStone = standingStones[0];
/** Metres from the stone's foot to where it sits until the stone's model
 *  has loaded and a probe has found its top. */
const guessedTop = 3.5;
/** Drawn over twice life size, so it reads as a crow from across the
 *  circle. */
const crowScale = 2.3;
/** Radians its flight turns off straight out from the middle. */
const flightSweep = 1;

/** Where the stone's top is looked for: straight down onto a few points
 *  round its middle, taking the most level. */
const probeOffsets = [
    [0, 0],
    [0.2, 0],
    [-0.2, 0],
    [0, 0.2],
    [0, -0.2],
];
/** Metres above its foot the downward probe starts, past any stone's top,
 *  and the band a hit must fall in to be the stone's top. */
const probeStart = 7;
const topBand = { low: 2.5, high: 5 };
/** Metres from the stone's middle a mesh's bounds must centre within to be
 *  probed: the stone, not the ground or the forest. */
const probeReach = 3;
const probeSeconds = 0.5;
const raycaster = new Raycaster();
const down = new Vector3(0, -1, 0);
const probeOrigin = new Vector3();
const meshMiddle = new Vector3();
const candidates: Object3D[] = [];
const hits: Intersection[] = [];

/** Its body's feathers, with a faint cool sheen round its edges and on
 *  the faces toward the sky, so its shape stands off the dark forest at
 *  dusk. The wings go without, so in flight they read black on the sky. */
const featherMaterial = new MeshStandardMaterial({
    color: "#262833",
    roughness: 0.45,
    metalness: 0.25,
    side: DoubleSide,
});
featherMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
float edge = 1.0 - abs(dot(normal, normalize(vViewPosition)));
float skyward = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
totalEmissiveRadiance += vec3(0.42, 0.52, 0.7)
    * (pow(edge, 2.5) * 0.45 + max(skyward, 0.0) * 0.12);`,
    );
};
const wingMaterial = new MeshStandardMaterial({
    color: "#1c1d24",
    roughness: 0.6,
    metalness: 0.2,
    side: DoubleSide,
});
const beakMaterial = new MeshStandardMaterial({
    color: "#34343a",
    roughness: 0.6,
});

//  Its parts in its own frame: facing positive z, its feet at the origin.
const bodyGeometry = new SphereGeometry(1, 12, 8);
const headGeometry = new SphereGeometry(0.068, 10, 8);
const beakGeometry = new ConeGeometry(0.024, 0.1, 6);
beakGeometry.rotateX(Math.PI / 2);
const legGeometry = new CylinderGeometry(0.008, 0.008, 0.09, 4);

/** A wing, spread toward positive x, its leading edge toward positive z and
 *  its long primaries fingered at the trailing tip. */
function shapeWing() {
    const outline = new Shape();
    const points: [number, number][] = [
        [0, 0.07],
        [0.2, 0.08],
        [0.36, 0.05],
        [0.46, -0.02],
        [0.43, -0.07],
        [0.39, -0.05],
        [0.37, -0.11],
        [0.33, -0.08],
        [0.3, -0.13],
        [0.26, -0.1],
        [0.18, -0.13],
        [0.08, -0.12],
        [0, -0.08],
    ];
    outline.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) outline.lineTo(x, y);
    const wing = new ShapeGeometry(outline);
    //  From the shape's plane into the crow's: its y becomes z.
    wing.rotateX(-Math.PI / 2);
    wing.scale(1, 1, -1);
    return wing;
}
const wingGeometry = shapeWing();

/** Its fanned tail, pointing back along negative z. */
function shapeTail() {
    const outline = new Shape();
    outline.moveTo(-0.03, 0);
    outline.lineTo(0.03, 0);
    outline.lineTo(0.075, -0.2);
    outline.lineTo(0, -0.18);
    outline.lineTo(-0.075, -0.2);
    outline.closePath();
    const tail = new ShapeGeometry(outline);
    tail.rotateX(Math.PI / 2);
    return tail;
}
const tailGeometry = shapeTail();

/** Radians a folded wing turns back along the body. */
const foldTurn = Math.PI / 2 - 0.12;
/** Seconds between the head's turns and between hops. */
const lookSeconds = 1.7;
const hopSeconds = 5.3;

/** The crow, perched on its stone. A page draws it; the room, headless,
 *  has nothing to draw. */
export function Crow() {
    return useHeadless() ? null : <Bird />;
}

/** Whether `object` is `ancestor` or sits under it. */
function isWithin(object: Object3D | null, ancestor: Object3D) {
    for (let node = object; node; node = node.parent)
        if (node === ancestor) return true;
    return false;
}

function Bird() {
    const world = useWorld();
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = siege?.phase;
    const surface = useWorldEntity().get(Ground)?.surface;
    const birdRef = useRef<Group>(null);
    const headRef = useRef<Group>(null);
    const rightRef = useRef<Group>(null);
    const leftRef = useRef<Group>(null);
    const legsRef = useRef<Group>(null);
    /** Page seconds it took off at, Infinity while it sits, and the phase
     *  of its wing beat. */
    const flightRef = useRef({ tookOff: Infinity, beat: 0 });
    /** The stone's top once found, and when it was last looked for. */
    const topRef = useRef({ found: false, height: guessedTop, probedAt: -1 });

    //  Back on its stone once a run ends, for the next one.
    useEffect(() => {
        if (phase === SiegePhase.Waiting || phase === SiegePhase.Over)
            flightRef.current.tookOff = Infinity;
    }, [phase]);
    //  The last shots the room sent before this page drew the crow are
    //  not a shot it hears.
    const heardAlready = useMemo(
        () => world.get(ShotResults)?.results,
        [world],
    );
    useTraitEffect(world, ShotResults, (shots) => {
        const flight = flightRef.current;
        if (Number.isFinite(flight.tookOff)) return;
        if (!shots?.results.length || shots.results === heardAlready) return;
        flight.tookOff = performance.now() / 1000;
    });

    const ground = surface?.getHeightAt(perchStone) ?? 0;
    const perch = useMemo(
        () => ({ x: perchStone.x, y: ground + guessedTop, z: perchStone.z }),
        [ground],
    );
    const out = Math.hypot(perchStone.x, perchStone.z);
    const radial = { x: perchStone.x / out, z: perchStone.z / out };
    //  Sitting it faces the middle; flying it heads out and across, so from
    //  the circle it crosses the sky side on rather than shrinking away.
    const heading = {
        x: radial.x * Math.cos(flightSweep) + radial.z * Math.sin(flightSweep),
        z: radial.z * Math.cos(flightSweep) - radial.x * Math.sin(flightSweep),
    };
    const sitYaw = Math.atan2(-radial.x, -radial.z);
    const swing =
        ((Math.atan2(heading.x, heading.z) - sitYaw + Math.PI * 3) %
            (Math.PI * 2)) -
        Math.PI;

    //  Finds the stone's top on its model, whichever shape and height the
    //  circle drew: a few rays down onto the meshes near its middle, every
    //  half second until its model has loaded, then never again.
    function probeTop(scene: Object3D, bird: Object3D, time: number) {
        const top = topRef.current;
        if (top.found || time - top.probedAt < probeSeconds) return;
        top.probedAt = time;
        candidates.length = 0;
        scene.traverse((object) => {
            if (!(object instanceof Mesh) || object instanceof InstancedMesh)
                return;
            if (isWithin(object, bird)) return;
            const geometry = object.geometry;
            if (!geometry.boundingSphere) geometry.computeBoundingSphere();
            const sphere = geometry.boundingSphere;
            if (!sphere) return;
            meshMiddle.copy(sphere.center).applyMatrix4(object.matrixWorld);
            const across = Math.hypot(
                meshMiddle.x - perchStone.x,
                meshMiddle.z - perchStone.z,
            );
            if (across < probeReach) candidates.push(object);
        });
        let level = -Infinity;
        for (const [x, z] of probeOffsets) {
            probeOrigin.set(
                perchStone.x + x,
                ground + probeStart,
                perchStone.z + z,
            );
            raycaster.set(probeOrigin, down);
            hits.length = 0;
            raycaster.intersectObjects(candidates, false, hits);
            const hit = hits.find(
                ({ point }) =>
                    point.y > ground + topBand.low &&
                    point.y < ground + topBand.high,
            );
            const facing = hit?.face?.normal.y ?? -Infinity;
            if (hit && facing > level) {
                level = facing;
                perch.x = hit.point.x;
                perch.z = hit.point.z;
                top.height = hit.point.y - ground;
                top.found = true;
            }
        }
    }

    useFrame(({ clock, scene }, delta) => {
        const bird = birdRef.current;
        const head = headRef.current;
        const right = rightRef.current;
        const left = leftRef.current;
        const legs = legsRef.current;
        if (!bird || !head || !right || !left || !legs) return;
        probeTop(scene, bird, clock.elapsedTime);
        perch.y = ground + topRef.current.height;
        const flight = flightRef.current;
        const pose = readCrowFlight(performance.now() / 1000 - flight.tookOff);
        bird.visible = pose.stage !== CrowStage.Gone;
        if (!bird.visible) return;
        const time = clock.elapsedTime;
        flight.beat += pose.flapRate * Math.PI * 2 * delta;
        const flying = pose.stage !== CrowStage.Perched;
        legs.visible = !flying;

        if (!flying) {
            //  A hop in place every few seconds, a quick turn of the head
            //  between them.
            const hopShare = (time % hopSeconds) / 0.28;
            const hop = hopShare < 1 ? Math.sin(hopShare * Math.PI) : 0;
            const look = Math.floor(time / lookSeconds);
            const target = Math.sin(look * 12.9898) * 0.9;
            head.rotation.y +=
                (target - head.rotation.y) * Math.min(1, delta * 14);
            bird.position.set(perch.x, perch.y + hop * 0.1, perch.z);
            bird.rotation.set(0, sitYaw + Math.sin(look * 4.1) * 0.35, 0);
            //  A shrug of the wings as it lands each hop.
            const shrug = hop * 0.5;
            right.rotation.set(0, foldTurn - shrug, shrug * 0.4);
            left.rotation.set(0, foldTurn - shrug, shrug * 0.4);
            return;
        }

        head.rotation.y *= 1 - Math.min(1, delta * 6);
        bird.position.set(
            perch.x + heading.x * pose.distance,
            perch.y + pose.height,
            perch.z + heading.z * pose.distance,
        );
        //  It turns from the middle to its heading as it springs, nose up
        //  while it climbs, and rocks as it beats.
        const turn = Math.min(1, pose.distance / 0.6);
        const climb = pose.stage === CrowStage.Rising ? 0.7 : 0.45;
        bird.rotation.set(
            -climb,
            sitYaw + swing * turn,
            Math.sin(time * 1.3) * 0.15,
        );
        const beat = Math.sin(flight.beat);
        right.rotation.set(0, 0.1, beat * 0.9 + 0.1);
        left.rotation.set(0, 0.1, beat * 0.9 + 0.1);
    });

    return (
        <group ref={birdRef} scale={crowScale}>
            <mesh
                geometry={bodyGeometry}
                material={featherMaterial}
                position={[0, 0.13, 0]}
                rotation-x={-0.35}
                scale={[0.075, 0.075, 0.16]}
                castShadow
            />
            <group ref={headRef} position={[0, 0.21, 0.12]}>
                <mesh geometry={headGeometry} material={featherMaterial} />
                <mesh
                    geometry={beakGeometry}
                    material={beakMaterial}
                    position={[0, -0.01, 0.1]}
                />
            </group>
            <mesh
                geometry={tailGeometry}
                material={featherMaterial}
                position={[0, 0.1, -0.12]}
                rotation-x={-0.35}
            />
            <group ref={rightRef} position={[0.05, 0.16, 0.04]}>
                <mesh geometry={wingGeometry} material={wingMaterial} />
            </group>
            <group scale-x={-1}>
                <group ref={leftRef} position={[0.05, 0.16, 0.04]}>
                    <mesh geometry={wingGeometry} material={wingMaterial} />
                </group>
            </group>
            <group ref={legsRef}>
                <mesh
                    geometry={legGeometry}
                    material={beakMaterial}
                    position={[0.03, 0.045, 0.01]}
                />
                <mesh
                    geometry={legGeometry}
                    material={beakMaterial}
                    position={[-0.03, 0.045, 0.01]}
                />
            </group>
        </group>
    );
}
