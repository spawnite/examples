import { useEffect } from "react";
import { useWorld } from "koota/react";
import { Hud, Panel, PanelVariant, Player, Slot } from "@spawnite/engine";
import { AimInput } from "../combat/AimInput";
import { resetBattle } from "../combat/battle";
import { Effects } from "../combat/Effects";
import { Hazards } from "../combat/Hazards";
import { Particles } from "../combat/Particles";
import { clearEffects } from "../combat/systems";
import { HeroModel } from "../hero/HeroModel";
import { deriveHero, useProgress } from "../hero/progress";
import { ControlsHint } from "../hud/ControlsHint";
import { HeroBars } from "../hud/HeroBars";
import { HeroHud } from "../hud/HeroHud";
import type { SpawnArea } from "../monsters/spawns";
import { Spawner } from "../monsters/Spawner";
import { TouchControls } from "../combat/TouchControls";
import { DetailedWorld } from "../view/graphics";
import { GroundTexture } from "../view/GroundTexture";
import { MapBake } from "../view/MapBake";
import { Waystone } from "../view/Waystone";
import { WildsView } from "../view/WildsView";

/** Two moss slime meadows either side of where she arrives, the ember
 *  slimes' patch past them to the north, and a moss and an ember patch
 *  between, all on the meadow's level ground and each crowded;
 *  then, down dirt paths, the far zones for a stronger hero: the bats and
 *  spiders of the hollow to the east, the husks of the barrow to the west,
 *  and the ash brutes and their warlord on the ashen flats to the north.
 *  Each area keeps its monsters. */
export const spawnAreas: SpawnArea[] = [
    {
        name: "East moss",
        kind: "mossSlime",
        x: 7,
        z: -2,
        radius: 5,
        count: 8,
        boss: "mossKing",
        bossAfter: 12,
    },
    {
        name: "West moss",
        kind: "mossSlime",
        x: -7,
        z: -2,
        radius: 5,
        count: 8,
        boss: "mossKing",
        bossAfter: 12,
    },
    {
        name: "Ember patch",
        kind: "emberSlime",
        x: 0,
        z: -15,
        radius: 6,
        count: 8,
        boss: "emberTyrant",
        bossAfter: 10,
    },
    //  Two more, north of the moss on either side, so the meadow is never
    //  far from a fight.
    {
        name: "North-west moss",
        kind: "mossSlime",
        x: -13,
        z: -11,
        radius: 4.5,
        count: 7,
    },
    {
        name: "Ember rise",
        kind: "emberSlime",
        x: 13,
        z: -12,
        radius: 4.5,
        count: 6,
    },
    {
        name: "Dusk hollow",
        kind: "duskBat",
        x: 38,
        z: -1,
        radius: 6,
        count: 7,
        boss: "duskMonarch",
        bossAfter: 10,
    },
    {
        name: "Skitter hollow",
        kind: "caveSkitter",
        x: 46,
        z: -10,
        radius: 6.5,
        count: 7,
        boss: "broodQueen",
        bossAfter: 10,
    },
    {
        name: "Barrow",
        kind: "barrowHusk",
        x: -42,
        z: -6,
        radius: 8,
        count: 10,
        boss: "barrowKing",
        bossAfter: 12,
    },
    {
        name: "Ashen flats",
        kind: "ashBrute",
        x: 0,
        z: -48,
        radius: 9,
        count: 10,
        boss: "ashWarlord",
        bossAfter: 10,
    },
];

/** Where she arrives: at the meadow's south end; in a development copy,
 *  wherever `?at=x,z` says, to playtest a far zone. */
function arrival(): [number, number, number] {
    const asked = import.meta.env.DEV
        ? new URLSearchParams(window.location.search).get("at")
        : null;
    const [x, z] = asked?.split(",").map(Number) ?? [];
    return Number.isFinite(x) && Number.isFinite(z) ? [x, 0, z] : [0, 0, 4];
}

/** The wilds: the hunt, from the hero's arrival until she falls. */
export function Run() {
    const world = useWorld();
    const maxHealth = deriveHero(useProgress.getState()).maxHealth;

    useEffect(() => {
        resetBattle();
        return () => clearEffects(world);
    }, [world]);

    return (
        <DetailedWorld map="wilds">
            <Player
                position={arrival()}
                health={{ current: maxHealth, maximum: maxHealth }}
            >
                {({ entity }) => (
                    <>
                        <HeroModel entity={entity} />
                        <HeroBars entity={entity} />
                    </>
                )}
            </Player>
            <GroundTexture />
            <MapBake />
            <WildsView />
            <AimInput />
            <TouchControls />
            <Spawner areas={spawnAreas} />
            {/*  The way home, behind where she arrives. */}
            <Waystone at={[0, 9]} />
            <Effects />
            <Hazards />
            <Particles />
            <HeroHud />
            <Hud>
                <Panel slot={Slot.Bottom} variant={PanelVariant.Bare} order={2}>
                    <ControlsHint fades />
                </Panel>
            </Hud>
        </DetailedWorld>
    );
}

//  A room loads this file alone, so it hands on the game's plugins.
export { plugins } from "../game";
