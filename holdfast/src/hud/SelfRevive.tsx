import { Not } from "koota";
import { useQuery } from "koota/react";
import { DisconnectedTrait, Icon, Text } from "@spawnite/engine";
import { WardenTrait } from "../siege/traits";
import { usePhase } from "../views/phase";

/** A warden alone, on her feet while the run is on: whether her one
 *  self-revive is in hand, and once it is spent, that a fall now ends the
 *  run until the next colossus falls. A team gets each other up, so it
 *  shows nothing. One line at every size. */
export function SelfReviveLine({
    selfRevive,
    down,
}: {
    selfRevive: boolean;
    down: boolean;
}) {
    const phase = usePhase();
    //  Alone as the room counts it: a dropped teammate leaves her alone.
    const alone = useQuery(WardenTrait, Not(DisconnectedTrait)).length === 1;
    const running = phase === "breather" || phase === "fight";
    //  Down, the downed panel says it.
    if (!alone || !running || down) return null;

    return (
        <Text
            as="div"
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap ${selfRevive ? "bg-amber-300/10 text-amber-100/85" : "bg-red-500/15 text-red-200"}`}
        >
            <Icon
                name="heart"
                className={`size-4 shrink-0 ${selfRevive ? "text-menu-accent" : "text-danger"}`}
            />
            {selfRevive
                ? "Self-revive ready if you go down"
                : "No self-revive until the next colossus falls"}
        </Text>
    );
}
