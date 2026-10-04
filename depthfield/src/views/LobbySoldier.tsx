import { Suspense } from "react";
import { Entity } from "@spawnite/engine";
import { LobbySoldierLook } from "./LobbySoldierLook";
import { platformHeight } from "./LobbyStage";
import { soldierModelName } from "./models";

//  The soldier on the lobby's platform: the engine's model of it, looping
//  its idle and playing a shot as a weapon is picked, under the look that
//  dresses it in the look picked.

/** The clip it loops, as the file names it. */
const idleClip = "idle";

export function LobbySoldier() {
    return (
        <Entity
            name="Lobby soldier"
            model={soldierModelName}
            animation={idleClip}
            position={[0, platformHeight, 0]}
        >
            <Suspense fallback={null}>
                <LobbySoldierLook />
            </Suspense>
        </Entity>
    );
}
