import type { Entity, World } from "koota";
import {
    addStatModifier,
    maxHealthStat,
    removeStatModifiers,
    readStat,
    type StatModifier,
} from "@spawnite/engine/core";
import { drawIndex, type Seeded } from "./random";
import { WardenStat } from "./stats";
import { WardenTrait } from "./traits";
import { queryWardens } from "./wardens";

//  The upgrade cards: three drawn for each warden when a wave is held, one
//  taken. A card is data: the modifiers it adds to her stats, which the
//  shots, the coins and her stride already read.

export enum CardId {
    HeavyRounds = "heavy-rounds",
    HairTrigger = "hair-trigger",
    FleetFoot = "fleet-foot",
    IronHeart = "iron-heart",
    MidasTouch = "midas-touch",
    DrillRounds = "drill-rounds",
    Scattershot = "scattershot",
    SecondWind = "second-wind",
    FieldMedic = "field-medic",
    StormLance = "storm-lance",
}

/** One modifier a card adds, and the stat it goes on. */
interface CardModifier {
    stat: string;
    modifier: Omit<StatModifier, "source">;
}

export interface Card {
    title: string;
    /** What taking it does, in a line. */
    text: string;
    modifiers: CardModifier[];
    /** Times one warden may take it in a run. */
    limit: number;
}

/** Health the health card adds to her greatest health, and fills. */
const ironHeartHealth = 25;

export const cards: Record<CardId, Card> = {
    [CardId.HeavyRounds]: {
        title: "Heavy Rounds",
        text: "Your shots hit 25% harder.",
        modifiers: [
            { stat: WardenStat.Damage, modifier: { percent: 0.25 } },
            { stat: WardenStat.LanceDamage, modifier: { percent: 0.25 } },
        ],
        limit: 8,
    },
    [CardId.HairTrigger]: {
        title: "Hair Trigger",
        text: "Fire 20% faster.",
        modifiers: [
            { stat: WardenStat.FireRate, modifier: { percent: 0.2 } },
            { stat: WardenStat.LanceRate, modifier: { percent: 0.2 } },
        ],
        limit: 8,
    },
    [CardId.FleetFoot]: {
        title: "Fleet Foot",
        text: "Run 12% faster.",
        modifiers: [{ stat: WardenStat.Speed, modifier: { percent: 0.12 } }],
        limit: 5,
    },
    [CardId.IronHeart]: {
        title: "Iron Heart",
        text: `${ironHeartHealth} more health, and heal ${ironHeartHealth}.`,
        modifiers: [
            { stat: maxHealthStat, modifier: { flat: ironHeartHealth } },
        ],
        limit: 8,
    },
    [CardId.MidasTouch]: {
        title: "Midas Touch",
        text: "Coins you pick up are worth 50% more.",
        modifiers: [{ stat: WardenStat.CoinValue, modifier: { percent: 0.5 } }],
        limit: 6,
    },
    [CardId.DrillRounds]: {
        title: "Drill Rounds",
        text: "Your shots pass through one more monster.",
        modifiers: [{ stat: WardenStat.Pierce, modifier: { flat: 1 } }],
        limit: 4,
    },
    [CardId.Scattershot]: {
        title: "Scattershot",
        text: "Two more pellets a shot, each 20% weaker.",
        modifiers: [
            { stat: WardenStat.Pellets, modifier: { flat: 2 } },
            { stat: WardenStat.Damage, modifier: { more: -0.2 } },
        ],
        limit: 3,
    },
    [CardId.SecondWind]: {
        title: "Second Wind",
        text: "Heal 2 health a second.",
        modifiers: [{ stat: WardenStat.Regen, modifier: { flat: 2 } }],
        limit: 5,
    },
    [CardId.FieldMedic]: {
        title: "Field Medic",
        text: "Get a downed warden up twice as fast.",
        modifiers: [{ stat: WardenStat.ReviveRate, modifier: { percent: 1 } }],
        limit: 2,
    },
    [CardId.StormLance]: {
        title: "Storm Lance",
        text: "Right-click: a heavy lance through up to 13 monsters in a line.",
        modifiers: [
            { stat: WardenStat.LanceDamage, modifier: { flat: 40 } },
            { stat: WardenStat.LanceRate, modifier: { flat: 0.75 } },
        ],
        limit: 1,
    },
};

const cardIds = Object.values(CardId);

/** Cards dealt to each warden when a wave is held. */
const offerSize = 3;

function isCardId(id: string): id is CardId {
    //  Widened to the list's own element type, which `includes` asks for.
    return (cardIds as string[]).includes(id);
}

/** The card an id names, as a stream carries it; undefined for none. */
export function readCard(id: string): Card | undefined {
    return isCardId(id) ? cards[id] : undefined;
}

/** Three different cards for `warden`, none she has taken to its limit. */
function drawOffer(seeded: Seeded, warden: Entity) {
    const taken = warden.get(WardenTrait)?.cards ?? [];
    const open = cardIds.filter(
        (id) => taken.filter((card) => card === id).length < cards[id].limit,
    );
    const offer: CardId[] = [];
    while (offer.length < offerSize && open.length > 0)
        offer.push(...open.splice(drawIndex(seeded, open.length), 1));
    return offer;
}

/** The modifiers' source for `id`: one per card, so a new run takes each
 *  card off whatever times she took it. */
function readSource(id: CardId) {
    return `card:${id}`;
}

/** Takes every card off her, as a new run starts. */
export function dropCards(warden: Entity) {
    for (const id of cardIds) removeStatModifiers(warden, readSource(id));
    warden.set(WardenTrait, { cards: [], offer: [], taken: "" });
}

/** Deals each warden her three for the breather. */
export function dealCards(world: World, seeded: Seeded) {
    for (const warden of queryWardens(world))
        warden.set(WardenTrait, {
            offer: drawOffer(seeded, warden),
            taken: "",
        });
}

/** Takes the card in `slot` of her offer, where she has one and has not
 *  taken one this breather: its modifiers on her stats, and on her list.
 *  A card that raises her greatest health fills what it adds. */
export function pickCard(warden: Entity, slot: number) {
    const survivor = warden.get(WardenTrait);
    const id = survivor?.offer[slot];
    if (!survivor || survivor.taken !== "" || id === undefined) return;
    if (!isCardId(id)) return;
    for (const { stat, modifier } of cards[id].modifiers)
        addStatModifier(warden, stat, { ...modifier, source: readSource(id) });
    const maximum = readStat(warden, maxHealthStat) ?? survivor.maximum;
    warden.set(WardenTrait, {
        taken: id,
        cards: [...survivor.cards, id],
        maximum,
        health: survivor.health + Math.max(0, maximum - survivor.maximum),
    });
}

/** As the next wave opens: gives each warden who took none a card of her
 *  offer, and puts every offer away. */
export function closeOffers(world: World, seeded: Seeded) {
    for (const warden of queryWardens(world)) {
        const survivor = warden.get(WardenTrait);
        if (!survivor) continue;
        if (survivor.taken === "" && survivor.offer.length > 0)
            pickCard(warden, drawIndex(seeded, survivor.offer.length));
        warden.set(WardenTrait, { offer: [], taken: "" });
    }
}
