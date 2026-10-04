import { useWorld } from "koota/react";
import { Button, Icon, Text } from "@spawnite/engine";
import { rerollCards } from "../rules/upgrades";

//  The two rerolls under the cards, each with what is left of it: Reroll
//  deals four more, Reroll+ deals four a tier higher. A spent one, and
//  Reroll+ on a new weapon's deal, which it never rerolls, are disabled.

interface RerollBarProps {
    rerolls: number;
    rerollPlus: number;
    /** A new weapon's deal, which Reroll+ leaves alone. */
    loadout: boolean;
}

export function RerollBar({ rerolls, rerollPlus, loadout }: RerollBarProps) {
    const world = useWorld();
    return (
        <>
            <Button
                disabled={rerolls <= 0}
                label={`Reroll, ${rerolls} left`}
                onPress={() => rerollCards(world, false)}
                className="df-btn df-reroll"
            >
                <Icon name="rotate-ccw" className="size-4" />
                <Text>Reroll</Text>
                <Text className="df-reroll-count">{rerolls}</Text>
            </Button>
            <Button
                disabled={rerollPlus <= 0 || loadout}
                label={
                    loadout
                        ? "Reroll+: higher tiers apply to stat cards"
                        : `Reroll+: reroll into a higher tier, ${rerollPlus} left`
                }
                onPress={() => rerollCards(world, true)}
                className="df-btn df-reroll df-reroll-plus"
            >
                <Icon name="rotate-ccw" className="size-4" />
                <Text>Reroll+</Text>
                <Text className="df-reroll-count">{rerollPlus}</Text>
            </Button>
        </>
    );
}
