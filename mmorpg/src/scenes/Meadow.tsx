import { useState } from "react";
import { Preload, useDetectGPU } from "@react-three/drei";
import { useStore } from "zustand";
import {
    Bag,
    Camera,
    CameraPreset,
    Entity,
    Hud,
    Joystick,
    Loot,
    Panel,
    PanelVariant,
    Player,
    Slot,
    steerFromStick,
    useHeadless,
    useQualityStore,
    useSaveStore,
    World,
} from "@spawnite/engine";
import { avatars, heroAvatarId } from "../avatars";
import { Autosave } from "../components/Autosave";
import { CameraMemory } from "../components/CameraMemory";
import { HealthBar } from "../components/HealthBar";
import { QualityRig } from "../components/QualityRig";
import { LoadingProgress } from "../hud/LoadingProgress";
import { QualitySetting } from "../hud/QualitySetting";
import { SaveIndicator } from "../hud/SaveIndicator";
import { UnstuckButton } from "../hud/UnstuckButton";
import "../items";
import { readSavedHero } from "../save";
import { useSceneLoaded } from "./useSceneLoaded";

export function Meadow() {
    //  Headless there is no page: no address, no pixels to size and nothing
    //  to autosave on.
    const headless = useHeadless();
    //  The navmesh wireframe, asked for by name and off until it is. Its own
    //  parameter rather than a switch in the overlay, because a reload is
    //  what rebakes the world anyway.
    const [navMeshWireframeEnabled] = useState(
        () =>
            !headless &&
            new URLSearchParams(window.location.search).has("navmesh"),
    );
    const { tier } = useDetectGPU();
    const qualityStore = useQualityStore();
    const saveStore = useSaveStore();
    //  Read once, at the first render after the tier is known, not on every
    //  render: the scatter is baked once, so a level chosen now stands at the
    //  next load.
    //  ponytail: re-dress on a level change once colliders bake from the
    //  same list and can follow it.
    const [scatter] = useState(() =>
        qualityStore.getState().selectScatterShare(tier),
    );
    //  Subscribed, not read once: three resizes a shadow map whose side has
    //  changed on the next shadow frame, so a level the player picks takes
    //  effect where the scatter's share cannot.
    const shadowMapSize = useStore(qualityStore, (state) =>
        state.selectShadowMapSize(tier),
    );
    //  Compiled once everything it compiles has mounted: drei's Preload
    //  compiles the scene as it stands when it mounts, and never again.
    const loaded = useSceneLoaded();

    return (
        <World
            map="meadow"
            scatter={scatter}
            shadowMapSize={shadowMapSize}
            navmesh={navMeshWireframeEnabled}
        >
            <Player
                avatar={avatars[heroAvatarId]}
                //  The path's banks into the rolling field stand at
                //  79 degrees.
                climb={80}
                //  Where the save put her; the first step stands her
                //  on the ground.
                {...readSavedHero(saveStore)}
            >
                {(hero) => <HealthBar {...hero} />}
            </Player>
            {/*  On the path out of the clearing, a few steps from where
                    she starts. */}
            <Entity position={[3, 0, -2.5]}>
                <Loot item="potion" count={3} />
            </Entity>
            <Entity position={[5.5, 0, -4.5]}>
                <Loot item="ring-of-vitality" />
            </Entity>
            <Camera preset={CameraPreset.Classic} />
            <CameraMemory />
            {!headless && <QualityRig tier={tier} />}
            {!headless && <Autosave />}
            {loaded && <Preload />}
            <Hud>
                <LoadingProgress />
                <Panel slot={Slot.Top} variant={PanelVariant.Bare}>
                    <UnstuckButton />
                </Panel>
                <Panel slot={Slot.TopRight} variant={PanelVariant.Bare}>
                    <QualitySetting />
                </Panel>
                <Panel slot={Slot.BottomRight} variant={PanelVariant.Bare}>
                    <SaveIndicator />
                </Panel>
                <Bag />
                {/*  Fixed to its own corner, and drawn only for a
                        thumb: a mouse turns the camera and walks by
                        click. */}
                <Joystick
                    onSteer={steerFromStick}
                    className="fixed bottom-14 left-14 hidden pointer-coarse:flex"
                />
            </Hud>
        </World>
    );
}
