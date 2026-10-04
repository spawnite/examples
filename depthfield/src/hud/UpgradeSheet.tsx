import { useWorld } from "koota/react";
import { useEffect, useState } from "react";
import { Modal, ModalVariant, Text } from "@spawnite/engine";
import { dialogLook } from "./classes";
import { findRarity, RarityId } from "../rules/data";
import { OfferKind, RunPhase } from "../rules/traits";
import { echoUpgradeId, findUpgrade, pickCard } from "../rules/upgrades";
import { levelUpSeconds } from "../views/Soldier";
import { RerollBar } from "./RerollBar";
import { UpgradeCard, type UpgradeCardView } from "./UpgradeCard";
import { useRunView } from "./useRunView";

//  The level-up's cards: a new weapon at levels 3, 5 and 7, weapon upgrades
//  between them, and every third of those, passive ones. They stand side
//  by side over the dimmed field, or two by two on a phone, under one line
//  that says the level and the choice, with the rerolls below. The keys 1
//  to 4 pick as a click does. The cards wait for the level-up's swell and
//  ring to play on the field first.

const choiceLines: Record<OfferKind, string> = {
    loadout: "Choose a weapon",
    weapon: "Choose one",
    utility: "Choose a passive",
};

export function UpgradeSheet() {
    const world = useWorld();
    const view = useRunView((run) => {
        if (run.phase !== RunPhase.Upgrade || !run.offer) return null;
        return {
            level: run.level,
            kind: run.offer.kind,
            rerolls: run.rerolls,
            rerollPlus: run.rerollPlus,
            cards: run.offer.cards.map((card): UpgradeCardView => {
                const upgrade = findUpgrade(card.id);
                const rarity = findRarity(card.rarity ?? RarityId.Normal);
                const weapon = upgrade.weapon
                    ? run.weapons[upgrade.weapon]
                    : null;
                return {
                    id: card.id,
                    rarity: card.rarity,
                    rarityName: card.rarity ? rarity.name : null,
                    weapon: upgrade.weapon,
                    source:
                        weapon?.name ??
                        (upgrade.id.startsWith("all-")
                            ? "All weapons"
                            : upgrade.id === echoUpgradeId
                              ? "Companion"
                              : "Passive"),
                    name: upgrade.name,
                    gain: upgrade.describe(run, rarity),
                    level: weapon?.owned ? weapon.level : null,
                };
            }),
        };
    });
    const [shownLevel, setShownLevel] = useState(0);
    const level = view?.level ?? 0;
    useEffect(() => {
        if (!level) return;
        const timer = setTimeout(
            () => setShownLevel(level),
            levelUpSeconds * 1000,
        );
        return () => clearTimeout(timer);
    }, [level]);
    if (!view || shownLevel !== view.level) return null;

    return (
        <Modal
            variant={ModalVariant.Bare}
            className="df-deal df-text"
            dialogClassName={`${dialogLook} items-center gap-0`}
            classNames={{
                overline: `df-deal-head df-deal-${view.kind}`,
                actions: "df-rerollbar",
            }}
            open
            pause
            title="Level-up cards"
            overline={`Level ${view.level} · ${choiceLines[view.kind]}`}
            actions={
                <RerollBar
                    rerolls={view.rerolls}
                    rerollPlus={view.rerollPlus}
                    loadout={view.kind === OfferKind.Loadout}
                />
            }
        >
            <Text as="div" className="df-cards">
                {view.cards.map((card, index) => (
                    <UpgradeCard
                        key={`${view.rerolls} ${view.rerollPlus} ${card.id}`}
                        card={card}
                        index={index}
                        onPick={() => pickCard(world, index)}
                    />
                ))}
            </Text>
        </Modal>
    );
}
