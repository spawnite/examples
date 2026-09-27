import { useQueryFirst, useTrait, useWorld } from "koota/react";
import { useEffect } from "react";
import {
    Authority,
    Button,
    Hero,
    Hud,
    Icon,
    type IconName,
    Panel,
    PanelVariant,
    Slot,
    Text,
} from "@spawnite/engine";
import { CardId, readCard, type Card } from "../siege/cards";
import { pickWeapons } from "../siege/signals";
import { SiegePhase, SiegeTrait, WardenTrait } from "../siege/traits";
import { sendSignal } from "../weapons/signal";
import { hudDisplay, hudKey, hudLabel, hudPane, hudTag } from "./look";

/** The keys that take the first, second and third card, on the number row
 *  and on the keypad. */
const pickKeys = [
    ["Digit1", "Numpad1"],
    ["Digit2", "Numpad2"],
    ["Digit3", "Numpad3"],
];

/** Each card's picture, by what it changes. */
const cardIcons: Record<CardId, IconName> = {
    [CardId.HeavyRounds]: "swords",
    [CardId.HairTrigger]: "zap",
    [CardId.FleetFoot]: "arrow-big-right",
    [CardId.IronHeart]: "shield",
    [CardId.MidasTouch]: "coins",
    [CardId.DrillRounds]: "target",
    [CardId.Scattershot]: "crosshair",
    [CardId.SecondWind]: "rotate-ccw",
    [CardId.FieldMedic]: "heart",
    [CardId.StormLance]: "flame",
};

/** A card's picture, or a plain one for an id the deck does not know. */
function readCardIcon(id: string): IconName {
    const known = Object.values(CardId).find((cardId) => cardId === id);
    return known ? cardIcons[known] : "star";
}

/** The three cards arrive one after the other. Written whole, because
 *  Tailwind emits only the classes it reads. */
const dealDelays = [
    "[animation-delay:0ms]",
    "[animation-delay:90ms]",
    "[animation-delay:180ms]",
];

interface CardFaceProps {
    id: string;
    card: Card;
    slot: number;
    /** Times she has taken it before this one. */
    held: number;
    onPick: (slot: number) => void;
}

/** One card: its key, its picture, its name, what it does, and how many
 *  she holds. */
function CardFace({ id, card, slot, held, onPick }: CardFaceProps) {
    return (
        <Button
            onPress={() => onPick(slot)}
            className={`group h-auto min-h-60 w-48 animate-hud-rise flex-col items-stretch justify-start overflow-hidden rounded-xl border border-menu-edge bg-menu-surface bg-none p-0 text-left whitespace-normal shadow-[0_12px_30px_rgb(0_0_0/0.55)] inset-shadow-none backdrop-blur-md transition-[translate,border-color,box-shadow] duration-150 hover:-translate-y-2 hover:border-amber-300 hover:shadow-[0_0_0_1px_rgb(255_177_59/0.6),0_0_28px_rgb(255_177_59/0.35)] ${dealDelays[slot] ?? ""}`}
        >
            <Text
                as="span"
                className="flex w-full flex-col items-center gap-2 px-3 pt-3 pb-4"
            >
                <Text
                    as="span"
                    className="flex w-full items-center justify-between"
                >
                    <Text as="span" className={hudKey}>
                        {slot + 1}
                    </Text>
                    {held > 0 && (
                        <Text
                            className={`${hudTag} bg-amber-300/15 text-amber-200`}
                        >
                            You hold {held}
                        </Text>
                    )}
                </Text>
                <Text
                    as="span"
                    className="flex size-16 items-center justify-center rounded-full border border-amber-200/30 bg-amber-400/15 transition-colors group-hover:border-amber-300 group-hover:bg-amber-400/30"
                >
                    <Icon
                        name={readCardIcon(id)}
                        className="size-8 text-amber-200"
                    />
                </Text>
                <Text
                    className={`${hudDisplay} mt-1 text-center text-[1.375rem] tracking-normal text-amber-100 uppercase`}
                >
                    {card.title}
                </Text>
                <Text as="span" className="h-px w-16 bg-amber-200/30">
                    {null}
                </Text>
                <Text className="text-center text-sm leading-snug font-medium text-white/85">
                    {card.text}
                </Text>
            </Text>
        </Button>
    );
}

/** Between waves, her three cards and the keys that take them; the one she
 *  took once she has. The pick goes to the room, which gives it to her. */
export function CardPick() {
    const world = useWorld();
    const survivor = useTrait(useQueryFirst(Hero, Authority), WardenTrait);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const open =
        siege?.phase === SiegePhase.Breather &&
        survivor !== undefined &&
        survivor.offer.length > 0 &&
        survivor.taken === "";

    useEffect(() => {
        if (!open) return;
        const press = (event: KeyboardEvent) => {
            const slot = pickKeys.findIndex((codes) =>
                codes.includes(event.code),
            );
            if (slot >= 0) sendSignal(world, pickWeapons[slot]);
        };
        window.addEventListener("keydown", press);
        return () => window.removeEventListener("keydown", press);
    }, [world, open]);

    if (!survivor || siege?.phase !== SiegePhase.Breather) return null;
    if (survivor.taken !== "")
        return (
            <Hud>
                <Panel
                    slot={Slot.Bottom}
                    variant={PanelVariant.Bare}
                    className={`animate-hud-rise flex-row gap-3 py-2.5 pr-5 pl-3 ${hudPane}`}
                >
                    <Text
                        as="span"
                        className="flex size-10 items-center justify-center rounded-full border border-amber-200/40 bg-amber-400/20"
                    >
                        <Icon
                            name={readCardIcon(survivor.taken)}
                            className="size-5 text-amber-200"
                        />
                    </Text>
                    <Text as="span" className="flex flex-col gap-0.5">
                        <Text className={hudLabel}>You took</Text>
                        <Text
                            className={`${hudDisplay} text-xl text-amber-100 uppercase`}
                        >
                            {readCard(survivor.taken)?.title}
                        </Text>
                    </Text>
                </Panel>
            </Hud>
        );
    if (!open) return null;

    return (
        <Hud>
            <Panel
                slot={Slot.Bottom}
                variant={PanelVariant.Bare}
                className="gap-3"
            >
                <Text className="flex items-center gap-2 rounded-full border border-menu-edge bg-menu-surface px-4 py-1.5 text-sm font-semibold text-white/90">
                    <Text
                        className={`${hudDisplay} text-base text-amber-200 uppercase`}
                    >
                        Take a card
                    </Text>
                    press 1, 2 or 3 before the wave comes
                </Text>
                <Text as="div" className="flex items-stretch gap-3">
                    {survivor.offer.map((id, slot) => {
                        const card = readCard(id);
                        return (
                            card && (
                                <CardFace
                                    key={id}
                                    id={id}
                                    card={card}
                                    slot={slot}
                                    held={
                                        survivor.cards.filter(
                                            (taken) => taken === id,
                                        ).length
                                    }
                                    onPick={(picked) =>
                                        sendSignal(world, pickWeapons[picked])
                                    }
                                />
                            )
                        );
                    })}
                </Text>
            </Panel>
        </Hud>
    );
}
