import { Html } from "@react-three/drei";
import type { Entity } from "koota";
import { Vector3 } from "three";
import { create } from "zustand";
import { PlayerNameTrait, Text } from "@spawnite/engine";
import { type Strike, StrikeKind, WardenTrait } from "../siege/traits";
import { readWardenTextClass } from "../views/palette";
import { hudDisplay } from "./look";

//  A reaction as a moment every page shows where it happened: its name,
//  big, in its colours, the two wardens who made it in theirs, and how many
//  times the pair has made it this run ("Chain Shock ×12"). A repeat of the
//  same pair's reaction while its word still stands replaces it, counted
//  up, so a quick run of them reads as one rising count, not a pile.

/** A reaction's word, and its colours as text and glow, written whole
 *  because Tailwind emits only the classes it reads. */
interface ReactionLook {
    word: string;
    text: string;
    glow: string;
}

const reactionLooks: Partial<Record<StrikeKind, ReactionLook>> = {
    [StrikeKind.ChainShock]: {
        word: "Chain Shock",
        text: "text-yellow-200",
        glow: "[text-shadow:0_0_14px_rgb(125_211_252/0.95),0_0_32px_rgb(253_224_71/0.7),0_3px_0_rgb(0_0_0/0.85)]",
    },
    [StrikeKind.Blast]: {
        word: "Blast",
        text: "text-orange-300",
        glow: "[text-shadow:0_0_14px_rgb(251_113_60/0.95),0_0_32px_rgb(253_186_116/0.6),0_3px_0_rgb(0_0_0/0.85)]",
    },
    [StrikeKind.SteamCloud]: {
        word: "Steam Cloud",
        text: "text-slate-50",
        glow: "[text-shadow:0_0_14px_rgb(251_146_60/0.8),0_0_32px_rgb(186_230_253/0.6),0_3px_0_rgb(0_0_0/0.85)]",
    },
};

/** A warden as her word names her: her name and her colour's class. */
interface Named {
    name: string;
    textClass: string;
}

/** One word standing over the circle. */
interface ShownWord {
    id: number;
    /** The pair and the reaction, so a repeat replaces it. */
    key: string;
    kind: StrikeKind;
    position: Vector3;
    count: number;
    by: Named | null;
    with: Named | null;
}

const useWords = create<{ words: ShownWord[] }>(() => ({ words: [] }));

/** Milliseconds a word stands: its animation's length. */
const wordMilliseconds = 1700;
/** The most words standing at once: the oldest goes first. */
const mostWords = 4;
/** Metres above the monster a word stands. */
const wordLift = 1.8;
let nextId = 0;

/** A warden's name and colour, or null for none. */
function readNamed(warden: Entity | null): Named | null {
    if (!warden?.isAlive()) return null;
    return {
        name: warden.get(PlayerNameTrait)?.name ?? "Warden",
        textClass: readWardenTextClass(warden.get(WardenTrait)?.hue ?? 0),
    };
}

/** The reaction to show, and where. */
export interface ShownReaction {
    strike: Strike;
    position: Vector3;
}

/** Stands the reaction's word over `position`, which is copied. */
export function showReaction({ strike, position }: ShownReaction) {
    if (!reactionLooks[strike.kind]) return;
    const by = readNamed(strike.by);
    const partner = readNamed(strike.with);
    const hues = [strike.by, strike.with]
        .map((warden) => warden?.get(WardenTrait)?.hue ?? -1)
        .sort((low, high) => low - high);
    const word: ShownWord = {
        id: nextId++,
        key: `${strike.kind}:${hues.join("-")}`,
        kind: strike.kind,
        position: position.clone().setY(position.y + wordLift),
        count: strike.count,
        by,
        //  One warden's own reaction names her once.
        with: strike.with === strike.by ? null : partner,
    };
    useWords.setState(({ words }) => ({
        words: [...words.filter((shown) => shown.key !== word.key), word].slice(
            -mostWords,
        ),
    }));
    setTimeout(
        () =>
            useWords.setState(({ words }) => ({
                words: words.filter((shown) => shown !== word),
            })),
        wordMilliseconds,
    );
}

interface ReactionWordProps {
    word: ShownWord;
}

function ReactionWord({ word }: ReactionWordProps) {
    const look = reactionLooks[word.kind];
    if (!look) return null;
    return (
        <Text
            as="div"
            className="flex animate-reaction-word flex-col items-center gap-1"
        >
            <Text
                as="div"
                className={`${hudDisplay} flex items-baseline gap-2 text-5xl whitespace-nowrap uppercase ${look.text} ${look.glow}`}
            >
                {look.word}
                {word.count > 1 && (
                    <Text as="span" className="text-3xl text-white">
                        ×{word.count}
                    </Text>
                )}
            </Text>
            {word.by && (
                <Text
                    as="div"
                    className="flex items-center gap-1.5 text-base font-bold whitespace-nowrap [text-shadow:0_2px_0_rgb(0_0_0/0.85),0_0_8px_rgb(0_0_0/0.7)]"
                >
                    {word.with && (
                        <>
                            <Text as="span" className={word.with.textClass}>
                                {word.with.name}
                            </Text>
                            <Text as="span" className="text-white/70">
                                +
                            </Text>
                        </>
                    )}
                    <Text as="span" className={word.by.textClass}>
                        {word.by.name}
                    </Text>
                </Text>
            )}
        </Text>
    );
}

/** Every reaction's word standing now, each over where it happened. */
export function ReactionWords() {
    const words = useWords((state) => state.words);
    return words.map((word) => (
        <Html
            key={word.id}
            position={word.position}
            center
            zIndexRange={[18, 16]}
            style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
        >
            <ReactionWord word={word} />
        </Html>
    ));
}
