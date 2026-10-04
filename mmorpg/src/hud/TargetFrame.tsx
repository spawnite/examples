import { useTrait } from "koota/react";
import {
    DownedTrait,
    Panel,
    PanelVariant,
    ResourceBar,
    Slot,
    TargetTrait,
    Text,
    useDisplayName,
    useHealth,
    usePlayer,
    healthResource,
} from "@spawnite/engine";

/** The player's target: its name and its health, at the top of the
 *  screen. Nothing while she has none. */
export function TargetFrame() {
    const hero = usePlayer().entity;
    const target = useTrait(hero, TargetTrait)?.entity ?? null;
    const name = useDisplayName(target);
    const health = useHealth(target);
    //  A downed target has no frame until it stands.
    if (!target || !health || target.has(DownedTrait)) return null;
    return (
        <Panel slot={Slot.Top} variant={PanelVariant.Bare} className="gap-1">
            <Text size="base">{name}</Text>
            <ResourceBar
                entity={target}
                resource={healthResource}
                label={`${name} health`}
                showValue
                className="h-3 w-48"
                classNames={{ root: "flex-col gap-1", value: "text-sm" }}
            />
        </Panel>
    );
}
