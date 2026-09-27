import type { Entity } from "koota";
import { useQuery, useQueryFirst, useTrait } from "koota/react";
import {
    Hud,
    Icon,
    isPlayerHero,
    Panel,
    PanelVariant,
    PlayerName,
    Slot,
    Text,
    Wallet,
} from "@spawnite/engine";
import { SiegeTrait, WardenTrait } from "../siege/traits";
import { readWardenTextClass } from "../views/palette";
import { hudDisplay, hudLabel, hudPane, hudTag } from "./look";

interface ScoreRowProps {
    entity: Entity;
}

/** One warden: her colour, her name, the page's own marked, her coins and
 *  her kills, and whether she is down. */
function ScoreRow({ entity }: ScoreRowProps) {
    const player = useTrait(entity, PlayerName);
    const wallet = useTrait(entity, Wallet);
    const survivor = useTrait(entity, WardenTrait);
    const own = isPlayerHero(entity);
    const down = survivor?.down ?? false;
    const hue = survivor?.hue ?? 0;

    return (
        <Text
            as="div"
            className={`flex items-center gap-2 rounded-md py-1 pr-2 pl-1.5 ${own ? "bg-white/8" : ""} ${down ? "opacity-60" : ""}`}
        >
            <Text
                as="div"
                className={`h-6 w-1 shrink-0 rounded-full bg-current ${readWardenTextClass(hue)}`}
            >
                {null}
            </Text>
            <Text
                className={`min-w-0 flex-1 truncate font-bold ${readWardenTextClass(hue)}`}
            >
                {player?.name ?? ""}
                {own && (
                    <Text
                        className={`${hudLabel} ml-1.5 tracking-[0.14em] text-white/50`}
                    >
                        you
                    </Text>
                )}
            </Text>
            {down && <Text className={`${hudTag} bg-red-500/85`}>Down</Text>}
            <Text as="div" className="flex w-12 items-center justify-end gap-1">
                <Icon name="coins" className="size-3.5 text-amber-300" />
                <Text className={`${hudDisplay} text-base text-amber-100`}>
                    {wallet?.coins ?? 0}
                </Text>
            </Text>
            <Text as="div" className="flex w-12 items-center justify-end gap-1">
                <Icon name="skull" className="size-3.5 text-red-300" />
                <Text className={`${hudDisplay} text-base`}>
                    {survivor?.kills ?? 0}
                </Text>
            </Text>
        </Text>
    );
}

/** Every warden in the room with the coins she holds and the monsters she
 *  has killed, as the room counts them, under the room's best wave. The
 *  wave itself is the banner's. */
export function Scoreboard() {
    const wardens = useQuery(PlayerName, WardenTrait);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);

    return (
        <Hud>
            <Panel
                slot={Slot.TopRight}
                variant={PanelVariant.Bare}
                className={`w-72 items-stretch gap-1 px-2 pt-2 pb-2 ${hudPane}`}
            >
                <Text
                    as="div"
                    className="flex items-baseline justify-between px-1.5 pb-0.5"
                >
                    <Text className={hudLabel}>Wardens</Text>
                    {siege && siege.best > 0 && (
                        <Text className={hudLabel}>
                            Best wave{" "}
                            <Text
                                className={`${hudDisplay} text-sm text-amber-200`}
                            >
                                {siege.best}
                            </Text>
                        </Text>
                    )}
                </Text>
                {wardens.map((entity) => (
                    <ScoreRow key={entity} entity={entity} />
                ))}
            </Panel>
        </Hud>
    );
}
