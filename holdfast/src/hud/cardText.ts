import { maxHealthStat } from "@spawnite/engine/core";
import { CardId, cards, elementCards, raritySteps, trim } from "../siege/cards";
import { WardenStat } from "../siege/stats";
import { Rarity } from "../siege/traits";
import { rarityPoints } from "../siege/elements";

//  What a card's face says: its number, large, what the number raises, the
//  line that says what taking it does, and, on a rare or an epic, why it is
//  one. The number is read from the modifier the card adds, times its
//  rarity's step, so the face shows what the pick gives.

/** A card's words at the rarity it is dealt at. */
export interface CardText {
    /** The number, large: "+60%", "+25", "New". Absent on an element's pick. */
    amount?: string;
    /** What the number raises: "damage". */
    stat?: string;
    /** What taking it does, in a sentence. */
    line: string;
    /** Why a rare or an epic is one: "2.4× a common's +25%". */
    why?: string;
}

/** What each stat a card raises is called on its face. */
const statNames: Record<string, string> = {
    [WardenStat.Damage]: "damage",
    [WardenStat.FireRate]: "fire rate",
    [WardenStat.Speed]: "run speed",
    [maxHealthStat]: "max health",
    [WardenStat.CoinValue]: "coin value",
    [WardenStat.Pierce]: "pierce",
    [WardenStat.Pellets]: "pellets a shot",
    [WardenStat.Regen]: "health a second",
    [WardenStat.ReviveRate]: "revive speed",
    [WardenStat.WeakSpotDamage]: "weak-spot damage",
    [WardenStat.ElementPower]: "element damage",
};

/** A card that adds an attack rather than a number heads its face with
 *  these words. */
const newAttacks: Partial<Record<CardId, string>> = {
    [CardId.StormLance]: "right-click attack",
};

/** The first modifier of `id`'s card at `step`, signed: "+25%" or "+2". */
function readAmount(id: CardId, step: number) {
    const [first] = cards[id].modifiers;
    if (!first) return undefined;
    const { percent, flat } = first.modifier;
    if (percent !== undefined) return `+${Math.round(percent * step * 100)}%`;
    if (flat !== undefined) return `+${trim(flat * step)}`;
    return undefined;
}

/** What `id`'s card says at `rarity`. */
export function readCardText(id: CardId, rarity: Rarity): CardText {
    const card = cards[id];
    const step = card.grows ? (raritySteps[rarity] ?? 1) : 1;
    const line = card.text(step);
    if (card.element) return { line };
    if (card.line) {
        const name = cards[elementCards[card.line]].title;
        const points = rarityPoints[rarity] ?? 1;
        const text = { amount: `+${points}`, stat: `${name} points`, line };
        return rarity === Rarity.Common
            ? text
            : { ...text, why: `${points}× a common's +1` };
    }
    const attack = newAttacks[id];
    if (attack) return { amount: "New", stat: attack, line };
    const [first] = card.modifiers;
    const text: CardText = {
        amount: readAmount(id, step),
        stat: first && statNames[first.stat],
        line,
    };
    if (step === 1) return text;
    return {
        ...text,
        why: `${trim(step)}× a common's ${readAmount(id, 1)}`,
    };
}
