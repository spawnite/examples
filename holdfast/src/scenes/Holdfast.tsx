import { useEffect, useState } from "react";
import {
    Camera,
    CameraPreset,
    createGroundSurface,
    type LookPick,
    Player,
    readMap,
    registerMaps,
    useHeadless,
    World,
} from "@spawnite/engine";
import { dusk } from "@spawnite/engine/looks/dusk";
import { Ambience } from "../audio/Ambience";
import { Cues } from "../audio/Cues";
import { Footsteps } from "../audio/Footsteps";
import { Announcer } from "../hud/Announcer";
import { BossBar } from "../hud/BossBar";
import { CardPick } from "../hud/CardPick";
import { Controls } from "../hud/Controls";
import { CardFlights } from "../hud/CardFlights";
import { EpicPulls } from "../hud/EpicPulls";
import { Dawn } from "../hud/Dawn";
import { Downed } from "../hud/Downed";
import { LineCalls } from "../hud/ElementLines";
import { Gathering } from "../hud/Gathering";
import { RunOver } from "../hud/RunOver";
import { Scoreboard } from "../hud/Scoreboard";
import { UsePrompt } from "../hud/UsePrompt";
import { SiegeRules } from "../siege/SiegeRules";
import { Vitals } from "../hud/Vitals";
import { WaveBanner } from "../hud/WaveBanner";
import { HitMarker } from "../hud/HitMarker";
import { DamageArc } from "../hud/DamageArc";
import { RiftCues } from "../hud/RiftCues";
import { ReactionWords } from "../hud/ReactionWords";
import { LowHealth } from "../hud/LowHealth";
import { Actors } from "../views/Actors";
import { Banners } from "../views/ambient/Banners";
import { Crow } from "../views/ambient/Crow";
import { Fireflies } from "../views/ambient/Fireflies";
import { DamageNumbers } from "../views/DamageNumbers";
import { Corpses } from "../views/monsters/Corpses";
import { MonsterMarks } from "../views/monsters/MonsterMarks";
import { Circle } from "../views/Circle";
import { Rack } from "../views/Rack";
import { LatePoses } from "../views/warden/latePoses";
import { MuzzleLight } from "../views/warden/MuzzleLight";
import { ReadyRing } from "../views/ReadyRing";
import { GroundCover } from "../views/GroundCover";
import { createHoldfastGrass } from "../views/ground/grassShader";
import { HurtVignette } from "../views/HurtVignette";
import { TracerView } from "../views/TracerView";
import { WarmUp } from "../views/WarmUp";
import { PhaseMarks } from "../views/PhaseMarks";
import { blasterWeapon } from "../siege/blaster";
import { Arsenal } from "../weapons/Arsenal";
import { Trigger } from "../weapons/Trigger";

export { plugins, room } from "../game";
export { save } from "../save";
export { bot } from "../siege/bot";
export { timeline } from "../siege/timeline";

//  Every map file under src/maps, each by its file name: here rather than
//  in the app, so the room, which loads this file alone, has the map too.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

/** Real seconds a day would take: long enough that the sun stays where
 *  the dusk look puts it for any run. */
const stillDaySeconds = 1e9;

/** The dusk look as this game grades it. No saturation boost: the grading
 *  turns a colour pushed past white by the bloom, such as a warden's ring,
 *  black. The glow reaches the fire and the runes and not the ground. */
const holdfastLook: LookPick = {
    base: dusk,
    exposure: 1.18,
    bloom: { intensity: 0.8, threshold: 0.8 },
    grading: { saturation: 0, contrast: 0.12 },
    vignette: { darkness: 0.6 },
};

/** The one scene, which the room mounts headless and every page mounts to
 *  draw it. The room runs the siege on the plugins this file exports; a
 *  page draws what it streams. */
export function Holdfast() {
    const headless = useHeadless();
    //  The page's grass, shaped by the same layout as the ground's paint.
    const [shaped] = useState(() =>
        headless
            ? undefined
            : createHoldfastGrass(createGroundSurface(readMap("holdfast"))),
    );
    useEffect(() => () => shaped?.roadWeights.dispose(), [shaped]);

    return (
        <World
            map="holdfast"
            look={holdfastLook}
            dayLengthSeconds={stillDaySeconds}
            grass={shaped?.grass}
            //  The night's own sky and air, which Surroundings draws.
            sky={false}
            fog={false}
        >
            <GroundCover />
            <Circle />
            <Rack />
            <ReadyRing />
            <Fireflies />
            <Banners />
            <Crow />
            {/*  No respawn, though her health lives on WardenTrait and the
                engine never downs her: only siege/downs.ts gets her up. */}
            <Player weapons={[blasterWeapon]} respawn={false} />
            <Camera preset={CameraPreset.Shooter} firstPerson={false} />
            <LatePoses />
            <MuzzleLight />
            <Arsenal />
            <SiegeRules />
            <Trigger />
            <TracerView />
            <Actors />
            <WarmUp />
            <PhaseMarks />
            <Corpses />
            <MonsterMarks />
            <DamageNumbers />
            <ReactionWords />
            <HitMarker />
            <HurtVignette />
            <LowHealth />
            <DamageArc />
            <RiftCues />
            <WaveBanner />
            <Gathering />
            <Controls />
            <BossBar />
            <Announcer />
            <LineCalls />
            <Cues />
            <Footsteps />
            <Ambience />
            <Scoreboard />
            <Vitals />
            <Downed />
            <UsePrompt />
            <CardPick />
            <CardFlights />
            <EpicPulls />
            <RunOver />
            <Dawn />
        </World>
    );
}
