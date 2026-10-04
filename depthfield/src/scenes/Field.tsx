import { Suspense, useEffect, useMemo, useState } from "react";
import {
    Bloom,
    FloatingText,
    Player,
    PostProcessing,
    registerMaps,
    registerModel,
    useHeadless,
    useScenes,
    Vignette,
    World,
} from "@spawnite/engine";
import { FieldAudio } from "../audio/FieldAudio";
import { Controls } from "../hud/Controls";
import { RunHud } from "../hud/RunHud";
import { RunScreens } from "../hud/RunScreens";
import { ClassId, LookId, u, WeaponId } from "../rules/data";
import { FieldRules } from "../rules/FieldRules";
import type { RunStart } from "../rules/run";
import { StageId } from "../rules/stages";
import { useChoice } from "../store/choice";
import { lobbyScene } from "../store/flow";
import { Figures, GlowLook, useLook } from "../store/look";
import { Arena } from "../views/Arena";
import { Effects } from "../views/Effects";
import { Enemies } from "../views/Enemies";
import { FieldCamera } from "../views/FieldCamera";
import { FieldParticles } from "../views/FieldParticles";
import { floatClassName, Floats } from "../views/Floats";
import { glowThreshold } from "../views/neon";
import { Pickups } from "../views/Pickups";
import { RiggedMonsters } from "../views/RiggedMonsters";
import { soldierModel, soldierModelName } from "../views/models";
import { Soldier } from "../views/Soldier";
import { createSoldierDress } from "../views/SoldierModel";
import { Sparks } from "../views/Sparks";
import { SwarmModels } from "../views/SwarmModels";

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins.
export { plugins } from "../game";

/** The bloom's strength for each of the Look panel's glows. */
const bloomIntensity: Record<GlowLook, number> = {
    [GlowLook.Off]: 0,
    [GlowLook.Soft]: 1.1,
    [GlowLook.Strong]: 2.2,
};

//  Every map file under src/maps, each by its file name: here rather than
//  in the app, so a headless mount of this file alone has the map too.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));
registerModel(soldierModelName, soldierModel);

/** The run a headless world starts on, as an agent's simulate mounts the
 *  field with no lobby to pick from. */
const headlessStart: RunStart = {
    nickname: "Runner",
    look: LookId.Grove,
    starter: WeaponId.Pulse,
    classId: ClassId.Soldier,
    stage: StageId.Grid,
    zapUnlocked: false,
};

/** The soldier walks at once and stops at once, and the jump is the dash. */
const heroMovement = { acceleration: 400, deceleration: 400, jumpHeight: 0 };

/** The field: the soldier on the neon arena, the swarm, and the run's
 *  screens over it. Each run is a fresh field: Play goes to it and a
 *  restart reloads it, each with the run it starts as it mounts. A page's
 *  field with no run to start, as after a development reload, goes back to
 *  the lobby. */
export function Field() {
    const headless = useHeadless();
    const scenes = useScenes();
    //  The run Play or a restart asked for, read once as the field mounts
    //  and cleared after, since a write in the render would update the
    //  scene that is leaving.
    const [start] = useState(() =>
        headless ? headlessStart : (useChoice.getState().pending ?? undefined),
    );
    useEffect(() => {
        if (headless) return;
        useChoice.setState({ pending: null });
        if (!start) scenes.go(lobbyScene);
    }, [headless, start, scenes]);
    const figures = useLook((look) => look.figures);
    const glow = useLook((look) => look.glow);
    const rims = useLook((look) => look.rims);
    const models = figures === Figures.Models;
    const dress = useMemo(() => createSoldierDress(rims), [rims]);
    //  The materials it made go with the model they dressed.
    useEffect(() => {
        if (!models) return;
        return () => {
            for (const material of dress.materials) material.dispose();
            dress.materials.length = 0;
        };
    }, [dress, models]);
    return (
        <World map="depthfield">
            {/*  No respawn: health at zero ends the run on the death
                screen, as rules/run.ts plays it. */}
            {/*  With the flat figures it wears no model, and the sprite is
                the soldier. */}
            <Player
                radius={u(14)}
                height={u(48)}
                movement={heroMovement}
                respawn={false}
                model={models ? soldierModelName : undefined}
                material={models ? dress.wear : undefined}
            >
                {({ entity }) =>
                    !headless && <Soldier hero={entity} dress={dress} />
                }
            </Player>
            <FieldCamera />
            <FieldRules start={start} />
            <Arena />
            {/*  Headless, as a simulate runs it, the field draws nothing. */}
            {!headless && (
                <>
                    {/*  The neon's glow: only colours lifted past white
                        bloom, and the field keeps its flat colours, with
                        no tone mapping. */}
                    <PostProcessing toneMapping={false}>
                        <Bloom
                            intensity={bloomIntensity[glow]}
                            threshold={glowThreshold}
                            radius={glow === GlowLook.Strong ? 0.7 : 0.55}
                        />
                        <Vignette darkness={0.45} />
                    </PostProcessing>
                    <Enemies />
                    {models && (
                        <>
                            <Suspense fallback={null}>
                                <SwarmModels />
                            </Suspense>
                            <RiggedMonsters />
                        </>
                    )}
                    <Pickups />
                    <Effects />
                    <FieldParticles />
                    <Sparks />
                    <FloatingText className={floatClassName} />
                    <Floats />
                    <FieldAudio />
                    <Controls />
                    <RunHud />
                    <RunScreens />
                </>
            )}
        </World>
    );
}
