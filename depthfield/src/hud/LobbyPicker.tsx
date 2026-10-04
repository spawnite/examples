import { useState, type ComponentType } from "react";
import { Button, Text } from "@spawnite/engine";
import { LookPicker } from "./LookPicker";
import { StagePicker } from "./StagePicker";
import { WeaponPicker } from "./WeaponPicker";

//  The lobby's picks, one tab at a time: the look, the starting weapon and
//  the stage. The tab's pane grows from the tabs as it opens.

enum LobbyTab {
    Look = "look",
    Weapon = "weapon",
    Stage = "stage",
}

const tabNames: Record<LobbyTab, string> = {
    [LobbyTab.Look]: "Look",
    [LobbyTab.Weapon]: "Weapon",
    [LobbyTab.Stage]: "Stage",
};

const panes: Record<LobbyTab, ComponentType> = {
    [LobbyTab.Look]: LookPicker,
    [LobbyTab.Weapon]: WeaponPicker,
    [LobbyTab.Stage]: StagePicker,
};

export function LobbyPicker() {
    const [tab, setTab] = useState(LobbyTab.Look);
    const Pane = panes[tab];
    return (
        <Text as="section" className="df-picker" aria-label="Picks">
            <Text as="div" className="df-tabs">
                {Object.values(LobbyTab).map((each) => (
                    <Button
                        key={each}
                        className={`df-tab ${each === tab ? "df-tab-on" : ""}`}
                        onPress={() => setTab(each)}
                    >
                        {tabNames[each]}
                    </Button>
                ))}
            </Text>
            <Text key={tab} as="div" className="df-pickpane">
                <Pane />
            </Text>
        </Text>
    );
}
