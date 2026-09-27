import { Suspense, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Mesh, type Group } from "three";
import {
    Entity,
    extendGltfLoader,
    RunContext,
    Stats,
    TrackMover,
    useBehaviour,
    useEntity,
    useHeadless,
    type Track,
} from "@spawnite/engine";
import penguin from "@spawnite/assets/models/sled/penguin.glb?url";
import { readRiderVisible, RunBehaviour, RunTrait } from "../ride/course";
import { LeanBehaviour, LeanTrait } from "../ride/lean";
import {
    rideGravity,
    rideHeight,
    riderStats,
    spawnDistance,
} from "../ride/rider";
import { pullMaximum, SlingBehaviour, SlingTrait } from "../ride/sling";
import { CoinChime } from "./CoinChime";

/** The rider is drawn larger than its place on the track. */
const riderScale = 1.4;

function Sling({ aimSpan }: { aimSpan: number }) {
    useBehaviour(SlingBehaviour, { aimSpan });
    return null;
}

function Lean() {
    useBehaviour(LeanBehaviour, {});
    return null;
}

function Run() {
    useBehaviour(RunBehaviour, {});
    return null;
}

/** The penguin, drawn back by the sling's pull, rolled into the steer and
 *  blinking while stunned. All drawn only: the mover places the entity. */
function RiderLook() {
    const entity = useEntity();
    const lookRef = useRef<Group>(null);
    //  Headless there is no page to draw it on, so no model loads.
    const headless = useHeadless();
    useFrame(() => {
        const look = lookRef.current;
        if (!look) return;
        //  The entity faces negative z, so back up the track is positive z,
        //  and a roll to the right is a negative turn about z.
        look.position.z = (entity.get(SlingTrait)?.charge ?? 0) * pullMaximum;
        look.rotation.z = -(entity.get(LeanTrait)?.roll ?? 0);
        look.visible = readRiderVisible(entity.get(RunTrait)?.stunSeconds ?? 0);
    });
    return (
        <group ref={lookRef}>
            <Suspense fallback={null}>
                {/*  The model faces positive x, so it turns a quarter to
                     face down the track with its entity. */}
                <group
                    position-y={-rideHeight}
                    rotation-y={Math.PI / 2}
                    scale={riderScale}
                >
                    {!headless && <Penguin />}
                </group>
            </Suspense>
        </group>
    );
}

/** The penguin's body as a plain mesh. Its rig plays no clip and rests in
 *  its bind pose, so it draws the same without it, and three uploads no
 *  bones for it each frame. */
export function Penguin() {
    const { scene } = useGLTF(penguin, false, undefined, extendGltfLoader);
    const bodies = useMemo(() => {
        const found: Mesh[] = [];
        scene.traverse((object) => {
            if (object instanceof Mesh) found.push(object);
        });
        return found;
    }, [scene]);
    return bodies.map((body) => (
        <mesh
            key={body.uuid}
            geometry={body.geometry}
            material={body.material}
            position={body.position}
            quaternion={body.quaternion}
            scale={body.scale}
            castShadow
            receiveShadow
        />
    ));
}

interface RiderProps {
    track: Track;
    /** Metres either side of the centre the sling aims across. */
    aimSpan: number;
}

/** The player on the sled: held at the start line on the sling until it
 *  fires, then riding the track under the player's steer and jump. */
export function Rider({ track, aimSpan }: RiderProps) {
    return (
        <Entity name="Rider" authority={RunContext.Client}>
            <TrackMover
                track={track}
                distance={spawnDistance}
                enabled={false}
                gravity={rideGravity}
                rideHeight={rideHeight}
            />
            <Stats {...riderStats} />
            <Sling aimSpan={aimSpan} />
            <Lean />
            <Run />
            <RiderLook />
            <CoinChime />
        </Entity>
    );
}
