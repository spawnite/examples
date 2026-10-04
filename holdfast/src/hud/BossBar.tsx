import type { Entity } from "koota";
import { useQuery, useQueryFirst, useTrait } from "koota/react";
import {
    HealthTrait,
    Hud,
    Icon,
    NetworkIdTrait,
    Panel,
    PanelVariant,
    ResourceBar,
    Slot,
    Text,
    healthResource,
} from "@spawnite/engine";
import { MonsterKind, MonsterTrait, SiegeTrait } from "../siege/traits";
import { hudDisplay, hudPane } from "./look";
import { readWaveLook } from "./named";

interface BossPanelProps {
    entity: Entity;
}

/** The boss's name over its health, kept short under the banner, so the
 *  calls under it keep clear of the aim: the name the banner and the call
 *  give its wave. It rises in as the colossus does. */
function BossPanel({ entity }: BossPanelProps) {
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const name =
        (siege && readWaveLook(siege.wave, siege.named)?.title) ??
        "The colossus";
    return (
        <Hud>
            <Panel
                slot={Slot.Top}
                variant={PanelVariant.Bare}
                className={`animate-hud-rise gap-1.5 px-4 pt-1.5 pb-2.5 ${hudPane} border-orange-400/35`}
            >
                <Text as="div" className="flex items-center gap-1.5">
                    <Icon name="skull" className="size-4 text-orange-300" />
                    <Text
                        className={`${hudDisplay} text-lg whitespace-nowrap text-menu-accent uppercase`}
                    >
                        {name}
                    </Text>
                </Text>
                <Text as="div" className="w-64 [--color-health-fill:#fb923c]">
                    <ResourceBar
                        entity={entity}
                        resource={healthResource}
                        label={`${name}'s health`}
                        className="h-2.5 w-full rounded-sm bg-black/55"
                    />
                </Text>
            </Panel>
        </Hud>
    );
}

/** The boss's bar at the top of the screen while a colossus stands. Keyed
 *  by the colossus as the room streams it, so a welcome that takes the
 *  stream down and brings it straight back, as a rejoin and a replay's
 *  seek do, keeps the bar up rather than filling it again from empty. */
export function BossBar() {
    const monsters = useQuery(MonsterTrait, HealthTrait);
    const boss = monsters.find(
        (monster) => monster.get(MonsterTrait)?.kind === MonsterKind.Colossus,
    );
    if (!boss) return null;
    return (
        <BossPanel key={boss.get(NetworkIdTrait)?.id ?? boss} entity={boss} />
    );
}
