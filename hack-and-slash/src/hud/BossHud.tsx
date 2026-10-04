import { useEffect, useState } from "react";
import { useQuery } from "koota/react";
import {
    Bar,
    Panel,
    PanelVariant,
    Slot,
    Text,
    useHealth,
} from "@spawnite/engine";
import type { Entity } from "koota";
import { kindOf, type MonsterKindName } from "../monsters/kinds";
import { slotKind, useSpawns } from "../monsters/spawns";
import { BossStateTrait, MonsterTrait } from "../monsters/traits";
import { usePortrait } from "../view/device";

/** Milliseconds the banner for a waking boss stands. */
const bannerMilliseconds = 3500;

/** What the screen shows of the bosses: how close the area she hunts is to
 *  waking its boss, a banner as one wakes, and a boss's health across the
 *  top while it is up. Inside the hunt's one Hud. */
export function BossHud() {
    const bosses = useQuery(BossStateTrait);
    const boss = bosses[0];
    return (
        <>
            {boss ? <BossBar key={boss.id()} boss={boss} /> : <KillCount />}
            <WakeBanner />
        </>
    );
}

/** On a phone held upright her health fills the top left and the minimap
 *  the top right, both reaching past the top's middle, so the boss's bar
 *  and count stand below them. */
function useBelowHealth() {
    return usePortrait() ? "mt-32" : "";
}

function BossBar({ boss }: { boss: Entity }) {
    const below = useBelowHealth();
    const health = useHealth(boss);
    const slot = boss.get(MonsterTrait)?.slot ?? -1;
    const name = slotKind(slot);
    if (!health || !name) return null;
    const kind = kindOf(name);
    return (
        <Panel
            slot={Slot.Top}
            variant={PanelVariant.Bare}
            order={1}
            className={below}
        >
            <Text size="sm" className="font-bold text-amber-300">
                {kind.name} · Lv {kind.level}
            </Text>
            <Bar
                label={`${kind.name} health`}
                value={health.current}
                maximum={health.maximum}
                className="h-3 w-80 max-w-[70vw]"
            />
        </Panel>
    );
}

/** The kills toward the boss of the area she last hunted in. */
function KillCount() {
    const below = useBelowHealth();
    const { lastArea, kills, slots } = useSpawns();
    if (!lastArea) return null;
    const slot = slots.find((each) => each.boss && each.area.name === lastArea);
    const count = kills[lastArea] ?? 0;
    if (!slot || count === 0) return null;
    return (
        <Panel
            slot={Slot.Top}
            variant={PanelVariant.Bare}
            order={1}
            className={below}
        >
            <Text size="xs" className="whitespace-nowrap text-amber-200">
                {lastArea}: {count}/{slot.area.bossAfter} ·{" "}
                {count >= (slot.area.bossAfter ?? 0) - 3
                    ? `the ${kindOf(slot.kind).name} stirs…`
                    : "something sleeps here"}
            </Text>
        </Panel>
    );
}

function WakeBanner() {
    const awoken = useSpawns((state) => state.awoken);
    const [shownFor, setShownFor] = useState(awoken?.count ?? 0);
    useEffect(() => {
        if (!awoken || awoken.count === shownFor) return;
        const timer = setTimeout(
            () => setShownFor(awoken.count),
            bannerMilliseconds,
        );
        return () => clearTimeout(timer);
    }, [awoken, shownFor]);
    if (!awoken || awoken.count === shownFor) return null;
    return (
        <Panel slot={Slot.Center} variant={PanelVariant.Bare}>
            <Text size="xl" className="text-amber-300">
                The {kindOf(awoken.name as MonsterKindName).name} has awoken!
            </Text>
            <Text>Watch the ground: red marks strike when they fill.</Text>
        </Panel>
    );
}
