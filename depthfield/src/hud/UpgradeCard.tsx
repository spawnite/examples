import type { CSSProperties } from "react";
import { Gauge, HeartPulse, Package, Sparkles, Wind } from "lucide-react";
import { Button, Icon, Text, type IconProps } from "@spawnite/engine";
import { RarityId, WeaponId, weaponIcons } from "../rules/data";
import { echoUpgradeId, type UpgradeGain } from "../rules/upgrades";

//  One level-up card: a tall frame in its rarity's colour, the rarity at
//  its top, the weapon's glyph or the card's own icon large, the weapon and
//  the card's names, the gain in big type, the weapon's level step, and
//  the key that picks it at its foot. The whole card is the button.

/** What a card shows, read from the run by the sheet. */
export interface UpgradeCardView {
    id: string;
    rarity: RarityId | null;
    rarityName: string | null;
    weapon: WeaponId | null;
    /** The weapon's name, or what a card with no weapon reaches. */
    source: string;
    name: string;
    gain: UpgradeGain;
    /** The weapon's level now, where the card levels it up. */
    level: number | null;
}

interface UpgradeCardProps {
    card: UpgradeCardView;
    /** Its place in the deal, from 0: its key and its turn to grow in. */
    index: number;
    onPick: () => void;
}

/** The icon of each card that belongs to no one weapon. */
const cardIcons: Record<string, IconProps["name"]> = {
    "all-damage": "swords",
    "all-speed": Gauge,
    consumables: Package,
    drops: "heart",
    xpmult: Sparkles,
    movement: Wind,
    regen: HeartPulse,
    [echoUpgradeId]: "users",
};

export function UpgradeCard({ card, index, onPick }: UpgradeCardProps) {
    const key = String(index + 1);
    //  Its place in the deal, which staggers its growing in. Cast, because
    //  React's style type names no custom property.
    const order = { "--df-deal-index": index } as CSSProperties;
    return (
        <Button
            label={`${key}: ${card.rarityName ?? ""} ${card.source} ${card.name}, ${card.gain.amount} ${card.gain.label}`}
            keyShortcuts={key}
            onPress={onPick}
            style={order}
            className={`df-upcard df-tier-${card.rarity ?? RarityId.Normal}`}
        >
            <Text className="df-upcard-tier">
                {card.rarityName ?? "Loadout"}
            </Text>
            <Text
                className={`df-upcard-icon ${card.weapon ? `df-${card.weapon}` : "df-all"}`}
            >
                {card.weapon ? (
                    weaponIcons[card.weapon]
                ) : (
                    <Icon
                        name={cardIcons[card.id] ?? "star"}
                        className="size-[1em]"
                    />
                )}
            </Text>
            <Text
                className={`df-upcard-source ${card.weapon ? `df-${card.weapon}` : "df-all"}`}
            >
                {card.source}
            </Text>
            <Text as="b" className="df-upcard-name">
                {card.name}
            </Text>
            <Text className="df-upcard-amount">{card.gain.amount}</Text>
            <Text className="df-upcard-label">{card.gain.label}</Text>
            {card.level !== null && (
                <Text className="df-upcard-level">
                    {`Lv ${card.level} → ${card.level + 1}`}
                </Text>
            )}
            <Text className="df-upcard-key">{key}</Text>
        </Button>
    );
}
