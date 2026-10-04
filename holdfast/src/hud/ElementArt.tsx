import type { Entity } from "koota";
import { useTrait } from "koota/react";
import { Text } from "@spawnite/engine";
import { cards, elementCards } from "../siege/cards";
import { Element, isElement, meltdown, thunderhead } from "../siege/elements";
import { WardenElementsTrait } from "../siege/traits";
import { elementClasses } from "../views/palette";
import { hudDisplay } from "./look";

//  Each element's picture: on its card, a scene of its job, and in the HUD,
//  a badge, with its level where the HUD shows it. Drawn in SVG in the current colour, so the card's colour class
//  paints it and the game downloads no image.

/** The roman numeral of an element's level. */
export const levelNumerals = ["", "I", "II", "III"];

/** A level's name and what it does, in a line. */
export interface LevelWords {
    title: string;
    line: string;
}

/** Each element's second level and capstone: its name and what it does. */
const raisedLevels: Record<Element, Record<2 | 3, LevelWords>> = {
    [Element.Storm]: {
        2: {
            title: "Forked Storm",
            line: "Your arcs leap further, through one more.",
        },
        3: {
            title: "Thunderhead",
            line: `While you fire, a bolt falls every ${thunderhead.everySeconds} s.`,
        },
    },
    [Element.Ember]: {
        2: {
            title: "Wildfire",
            line: "Your burn stacks faster and ticks harder.",
        },
        3: {
            title: "Meltdown",
            line: `A monster at full burn erupts for ${Math.round(meltdown.share * 100)}% of its health.`,
        },
    },
    [Element.Frost]: {
        2: {
            title: "Deep Freeze",
            line: "Your chill builds faster and freezes longer.",
        },
        3: {
            title: "Shatter",
            line: "A frozen monster that dies bursts and freezes its neighbors.",
        },
    },
};

/** A level's name and what it does, on its line and in its call: level 1
 *  is its element's own card's, and the others their own. */
export function readLevelWords(
    element: Element,
    level: number,
): LevelWords | undefined {
    if (level === 1) {
        const card = cards[elementCards[element]];
        return { title: card.title, line: card.text(1) };
    }
    return level === 2 || level === 3
        ? raisedLevels[element][level]
        : undefined;
}

/** Each element's job in a word or two, on its card under its name. */
export const elementJobs: Record<Element, string> = {
    [Element.Storm]: "Crowds",
    [Element.Ember]: "Bosses and brutes",
    [Element.Frost]: "Freeze them",
};

/** A bolt of lightning, 24 units square. */
const boltPath = "M13.5 2 4.5 13.5h6.2L8.8 22l10.7-12.6h-6.3L15.4 2z";
/** A flame, 24 units square. */
export const flamePath =
    "M12 2.2c.6 3.1 2.6 4.7 4.3 6.6 1.9 2.1 3 4.2 3 6.7A7.3 7.3 0 0 1 12 22.8a7.3 7.3 0 0 1-7.3-7.3c0-2.6 1.3-4.7 2.9-6.1.3 1.7 1.1 2.9 2.5 3.6-.4-3.9.3-7.6 1.9-10.8z";

/** A snowflake: three bars through its middle, each with a barb at either
 *  end, 24 units square. */
function Snowflake() {
    return (
        <g
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
        >
            {[0, 60, 120].map((turn) => (
                <g key={turn} transform={`rotate(${turn} 12 12)`}>
                    <path d="M12 2.5v19" />
                    <path d="M9 4.5l3 2.5 3-2.5M9 19.5l3-2.5 3 2.5" />
                </g>
            ))}
        </g>
    );
}

interface ElementBadgeProps {
    element: Element;
    className?: string;
}

/** An element's badge: a bolt, a flame or a snowflake. */
export function ElementBadge({ element, className }: ElementBadgeProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
            {element === Element.Storm && (
                <path d={boltPath} fill="currentColor" />
            )}
            {element === Element.Ember && (
                <path d={flamePath} fill="currentColor" />
            )}
            {element === Element.Frost && <Snowflake />}
        </svg>
    );
}

/** Where a figure stands in a scene, and how large. */
interface FigureProps {
    x: number;
    y: number;
    scale?: number;
}

/** A hunched monster, `scale` times the husk's size, its feet at `x`, `y`. */
function Monster({ x, y, scale = 1 }: FigureProps) {
    return (
        <g transform={`translate(${x} ${y}) scale(${scale})`}>
            <path
                d="M-7 0c0-6 2-11 7-12 5 1 7 6 7 12z"
                fill="currentColor"
                opacity={0.35}
            />
            <circle cx={-2.2} cy={-8} r={1.1} fill="currentColor" />
            <circle cx={2.2} cy={-8} r={1.1} fill="currentColor" />
        </g>
    );
}

interface ElementSceneProps {
    element: Element;
    className?: string;
}

/** An element's job as a picture: Storm's bolt forking into a crowd,
 *  Ember's flame over a brute, Frost's ice round a monster. */
export function ElementScene({ element, className }: ElementSceneProps) {
    return (
        <svg viewBox="0 0 96 60" className={className} aria-hidden>
            {element === Element.Storm && (
                <>
                    <Monster x={22} y={56} />
                    <Monster x={48} y={58} scale={1.1} />
                    <Monster x={74} y={56} />
                    <path
                        d="M48 2 42 16h6l-4 12M48 16l-19 20 4 2-9 8M48 16l19 20-4 2 9 8M44 28l4 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </>
            )}
            {element === Element.Ember && (
                <>
                    <Monster x={48} y={58} scale={2.9} />
                    <g transform="translate(36 2) scale(1)">
                        <path d={flamePath} fill="currentColor" />
                    </g>
                    <g transform="translate(22 14) scale(0.6)">
                        <path d={flamePath} fill="currentColor" opacity={0.7} />
                    </g>
                    <g transform="translate(60 14) scale(0.6)">
                        <path d={flamePath} fill="currentColor" opacity={0.7} />
                    </g>
                </>
            )}
            {element === Element.Frost && (
                <>
                    <path
                        d="M30 58 26 30l10-18h24l10 18-4 28z"
                        fill="currentColor"
                        opacity={0.18}
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinejoin="round"
                    />
                    <path
                        d="M36 12l6 16-16 2M60 12l-6 16 16 2M42 28l-4 30M54 28l4 30"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={0.8}
                        opacity={0.6}
                    />
                    <Monster x={48} y={56} scale={1.6} />
                    <g transform="translate(66 0) scale(0.8)">
                        <Snowflake />
                    </g>
                </>
            )}
        </svg>
    );
}

/** One badge: its element and level. */
interface HeldBadge {
    element: Element;
    level: number;
}

interface ElementBadgesProps {
    entity: Entity;
    /** Whether each badge shows its level as a numeral beside it. */
    levels?: boolean;
    /** The badges' size class. */
    className?: string;
}

/** The elements a warden holds, first then second, each a badge in its
 *  colour, with its level where `levels` asks. */
export function ElementBadges({
    entity,
    levels = false,
    className = "size-4",
}: ElementBadgesProps) {
    const held = useTrait(entity, WardenElementsTrait);
    const shown: HeldBadge[] = [];
    if (held && isElement(held.first))
        shown.push({ element: held.first, level: held.firstLevel });
    if (held && isElement(held.second))
        shown.push({ element: held.second, level: held.secondLevel });
    if (shown.length === 0) return null;
    return (
        <Text as="span" className="flex shrink-0 items-center gap-1">
            {shown.map(({ element, level }) => (
                <Text
                    key={element}
                    as="span"
                    aria-label={`${element} ${level}`}
                    className={`flex items-center gap-0.5 ${elementClasses[element].text}`}
                >
                    <ElementBadge element={element} className={className} />
                    {levels && (
                        <Text
                            as="span"
                            className={`${hudDisplay} text-sm leading-none`}
                        >
                            {levelNumerals[level]}
                        </Text>
                    )}
                </Text>
            ))}
        </Text>
    );
}
