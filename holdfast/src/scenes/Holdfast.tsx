import {
    Camera,
    CameraPreset,
    type LookPick,
    Player,
    registerMaps,
    World,
} from "@spawnite/engine";
import { dusk } from "@spawnite/engine/looks/dusk";
import { Ambience } from "../audio/Ambience";
import { Cues } from "../audio/Cues";
import { Footsteps } from "../audio/Footsteps";
import { Announcer } from "../hud/Announcer";
import { BossBar } from "../hud/BossBar";
import { CardPick } from "../hud/CardPick";
import { Downed } from "../hud/Downed";
import { RunOver } from "../hud/RunOver";
import { Scoreboard } from "../hud/Scoreboard";
import { SiegeRules } from "../siege/SiegeRules";
import { Vitals } from "../hud/Vitals";
import { WaveBanner } from "../hud/WaveBanner";
import { HitMarker } from "../hud/HitMarker";
import { DamageArc } from "../hud/DamageArc";
import { LowHealth } from "../hud/LowHealth";
import { Actors } from "../views/Actors";
import { Banners } from "../views/ambient/Banners";
import { Crow } from "../views/ambient/Crow";
import { Fireflies } from "../views/ambient/Fireflies";
import { DamageNumbers } from "../views/DamageNumbers";
import { Corpses } from "../views/monsters/Corpses";
import { Circle } from "../views/Circle";
import { LatePoses } from "../views/warden/latePoses";
import { GroundCover } from "../views/GroundCover";
import { HurtVignette } from "../views/HurtVignette";
import { HitStop } from "../views/HitStop";
import { TracerView } from "../views/TracerView";
import { Arsenal } from "../weapons/Arsenal";
import { TakePlace } from "../weapons/TakePlace";
import { Trigger } from "../weapons/Trigger";

export { systems } from "../siege/systems";

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
 *  draw it. The room runs the siege on the systems this file exports; a
 *  page draws what it streams. */
export function Holdfast() {
    return (
        <World
            map="holdfast"
            look={holdfastLook}
            dayLengthSeconds={stillDaySeconds}
        >
            <GroundCover />
            <Circle />
            <Fireflies />
            <Banners />
            <Crow />
            <Player />
            <Camera preset={CameraPreset.Shooter} firstPerson={false} />
            <LatePoses />
            <Arsenal />
            <SiegeRules />
            <Trigger />
            <TracerView />
            <TakePlace />
            <Actors />
            <Corpses />
            <DamageNumbers />
            <HitMarker />
            <HurtVignette />
            <LowHealth />
            <DamageArc />
            <HitStop />
            <WaveBanner />
            <BossBar />
            <Announcer />
            <Cues />
            <Footsteps />
            <Ambience />
            <Scoreboard />
            <Vitals />
            <Downed />
            <CardPick />
            <RunOver />
        </World>
    );
}
