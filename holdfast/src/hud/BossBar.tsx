import type { Entity } from "koota";
import { useQuery, useTrait } from "koota/react";
import {
    Bar,
    HealthTrait,
    Hud,
    Panel,
    PanelVariant,
    Slot,
    Text,
} from "@spawnite/engine";
import { MonsterKind, MonsterTrait } from "../siege/traits";
import { hudDisplay, hudLabel, hudPane } from "./look";

interface BossPanelProps {
    entity: Entity;
}

/** The boss's name over its health. */
function BossPanel({ entity }: BossPanelProps) {
    const health = useTrait(entity, HealthTrait);
    const current = Math.max(0, health?.current ?? 0);
    return (
        <Hud>
            <Panel
                slot={Slot.Top}
                variant={PanelVariant.Bare}
                className={`min-w-44 gap-1 px-6 pt-2 pb-3 ${hudPane}`}
            >
                <Text className={hudLabel}>Boss</Text>
                <Text className={`${hudDisplay} text-2xl text-amber-200`}>
                    The Colossus
                </Text>
                <Text as="div" className="[--color-health-fill:#fb923c] w-96">
                    <Bar
                        label="The Colossus's health"
                        value={current}
                        maximum={Math.max(health?.maximum ?? 1, 1)}
                        className="h-3 w-full rounded-sm bg-black/55"
                    />
                </Text>
            </Panel>
        </Hud>
    );
}

/** The boss's bar at the top of the screen while a colossus stands. */
export function BossBar() {
    const monsters = useQuery(MonsterTrait, HealthTrait);
    const boss = monsters.find(
        (monster) => monster.get(MonsterTrait)?.kind === MonsterKind.Colossus,
    );
    return boss ? <BossPanel key={boss} entity={boss} /> : null;
}
