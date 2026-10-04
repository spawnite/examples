import { Suspense, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useWorld } from "koota/react";
import type { Group } from "three";
import {
    Entity,
    RunContext,
    Stats,
    TrackMover,
    useBehaviour,
    useEntity,
    useHeadless,
    type Track,
} from "@spawnite/engine";
import {
    PaceBehaviour,
    readRiderVisible,
    RunBehaviour,
    RunMachine,
} from "../ride/course";
import { LeanBehaviour, LeanTrait } from "../ride/lean";
import {
    rideGravity,
    rideHeight,
    riderStats,
    spawnDistance,
} from "../ride/rider";
import { RigBehaviour } from "../ride/rig";
import { riderScale } from "../ride/riders";
import { pullMaximum, SlingBehaviour, SlingTrait } from "../ride/sling";
import { setSpeedStep } from "../ride/speed";
import { readProgress } from "../shop";
import { CoinChime } from "./CoinChime";
import { RiderModel, type RiderPick } from "./RiderModel";

function Sling({ aimSpan }: { aimSpan: number }) {
    useBehaviour(SlingBehaviour, { aimSpan });
    return null;
}

function Lean() {
    useBehaviour(LeanBehaviour, {});
    return null;
}

function Rig() {
    useBehaviour(RigBehaviour, {});
    return null;
}

/** The Speed step bought, laid on the stats the `Stats` before it
 *  declared, which keep it when they change. */
function Speed({ step }: { step: number }) {
    const entity = useEntity();
    useEffect(() => setSpeedStep(entity, step), [entity, step]);
    return null;
}

function Run() {
    useBehaviour(RunBehaviour, {});
    useBehaviour(PaceBehaviour, {});
    return null;
}

/** The rider on its ride, drawn back by the sling's pull, rolled into the
 *  steer, posed by the rig and blinking while stunned. All drawn only: the
 *  mover places the entity. */
function RiderLook({ rider, ride }: RiderPick) {
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
        look.visible = readRiderVisible(
            RunMachine.read(entity).secondsLeft ?? 0,
        );
    });
    return (
        <group ref={lookRef}>
            <Suspense fallback={null}>
                {/*  The rider is built facing positive z, so it turns about
                     to face down the track with its entity. */}
                <group
                    position-y={-rideHeight}
                    rotation-y={Math.PI}
                    scale={riderScale}
                >
                    {!headless && (
                        <RiderModel entity={entity} rider={rider} ride={ride} />
                    )}
                </group>
            </Suspense>
        </group>
    );
}

interface RiderProps {
    track: Track;
    /** Metres either side of the centre the sling aims across. */
    aimSpan: number;
}

/** The player on the sled: held at the start line on the sling until it
 *  fires, then riding the track under the player's steer and jump, on the
 *  animal, the ride and the Speed step the save holds. */
export function Rider({ track, aimSpan }: RiderProps) {
    //  Read as the run mounts: the lobby changes it between runs only.
    const { rider, ride, step } = readProgress(useWorld());
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
            <Speed step={step} />
            <Sling aimSpan={aimSpan} />
            <Lean />
            <Rig />
            <Run />
            <RiderLook rider={rider} ride={ride} />
            <CoinChime />
        </Entity>
    );
}
