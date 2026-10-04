import { useState } from "react";
import { Preload } from "@react-three/drei";
import {
    AbilityBar,
    Bag,
    DialogPanel,
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
    World,
} from "@spawnite/engine";
import { avatars, heroAvatarId } from "../avatars";
import { HealthBar } from "../components/HealthBar";
import { DamageNumbers } from "../hud/DamageNumbers";
import { LoadingProgress } from "../hud/LoadingProgress";
import { Mira } from "../npcs/Mira";
import { QualitySetting } from "../hud/QualitySetting";
import { SaveIndicator } from "../hud/SaveIndicator";
import { TargetFrame } from "../hud/TargetFrame";
import { UnstuckButton } from "../hud/UnstuckButton";
import "../items";
import { arcaneBolt, mageSpells, mana } from "../mage/abilities";
import { MageKit, Wand } from "../mage/MageKit";
import { Wolves } from "../monsters/Wolves";
import { useSceneLoaded } from "./useSceneLoaded";

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins.
export { plugins } from "../game";

export function Meadow() {
    //  Headless there is no page: no address to read.
    const headless = useHeadless();
    //  The navmesh wireframe, asked for by name and off until it is. Its own
    //  parameter rather than a switch in the overlay, because a reload is
    //  what rebakes the world anyway.
    const [navMeshWireframeEnabled] = useState(
        () =>
            !headless &&
            new URLSearchParams(window.location.search).has("navmesh"),
    );
    //  Compiled once everything it compiles has mounted: drei's Preload
    //  compiles the scene as it stands when it mounts, and never again.
    const loaded = useSceneLoaded();

    return (
        <World map="meadow" navmesh={navMeshWireframeEnabled}>
            <Player
                avatar={avatars[heroAvatarId]}
                //  The path's banks into the rolling field stand at
                //  79 degrees.
                climb={80}
                resources={[mana]}
                abilities={mageSpells}
            >
                {(hero) => (
                    <>
                        <HealthBar {...hero} />
                        <Wand entity={hero.entity} />
                    </>
                )}
            </Player>
            <MageKit />
            {/*  On the path out of the clearing, a few steps from where
                    she starts. */}
            <Entity position={[3, 0, -2.5]}>
                <Loot id="meadow-potions" item="potion" count={3} />
            </Entity>
            <Entity position={[5.5, 0, -4.5]}>
                <Loot id="meadow-ring" item="ring-of-vitality" />
            </Entity>
            <Mira />
            <Wolves />
            <DamageNumbers />
            <Camera preset={CameraPreset.Classic} rememberFraming />
            {loaded && <Preload />}
            <Hud>
                <LoadingProgress />
                <Panel slot={Slot.Top} variant={PanelVariant.Bare}>
                    <UnstuckButton />
                </Panel>
                <TargetFrame />
                <Panel slot={Slot.TopRight} variant={PanelVariant.Bare}>
                    <QualitySetting />
                </Panel>
                {/*  Under the quality setting: the action bar holds the
                        bottom-right corner. */}
                <Panel slot={Slot.TopRight} variant={PanelVariant.Bare}>
                    <SaveIndicator />
                </Panel>
                <AbilityBar
                    primary={arcaneBolt}
                    order={[arcaneBolt, ...mageSpells]}
                />
                <Bag />
                <DialogPanel />
                {/*  No tap beside it: a mouse turns the camera and walks
                        by click. */}
                <Joystick onSteer={steerFromStick} />
            </Hud>
        </World>
    );
}
