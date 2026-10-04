import { useQueryFirst, useTrait } from "koota/react";
import { Icon, type IconName, Text } from "@spawnite/engine";
import { Reaction } from "../siege/elements";
import { type Award, AwardKind, AwardsTrait } from "../siege/traits";
import { readWardenTextClass } from "../views/palette";
import { hudDisplay, hudLabel } from "./look";

//  The run's awards, on the dawn screen and the end screen alike: what the
//  team did together, each named for the wardens who earned it in their
//  colours, as Left 4 Dead's and Deep Rock Galactic's end screens name who
//  carried whom. The room sets them as the run ends; an award nobody
//  earned is left out.

/** Each award's picture, name and the words its count reads in, written
 *  whole because Tailwind emits only the classes it reads. */
interface AwardLook {
    icon: IconName;
    name: string;
    tint: string;
    count: (award: Award) => string;
}

const reactionNames: Record<string, string> = {
    [Reaction.ChainShock]: "Chain Shock",
    [Reaction.Blast]: "Blast",
    [Reaction.SteamCloud]: "Steam Cloud",
};

/** A count and its noun, one or many. */
function plural(count: number, one: string, many = `${one}s`) {
    return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

const awardLooks: Record<AwardKind, AwardLook> = {
    [AwardKind.BestDuo]: {
        icon: "users",
        name: "Best duo",
        tint: "text-sky-200 bg-sky-400/15 border-sky-300/40",
        count: ({ value }) => plural(value, "reaction"),
    },
    [AwardKind.TopReaction]: {
        icon: "zap",
        name: "Top reaction",
        tint: "text-yellow-200 bg-yellow-400/15 border-yellow-300/40",
        count: ({ value, reaction }) =>
            `${reactionNames[reaction] ?? reaction} ×${value}`,
    },
    [AwardKind.TopDamage]: {
        icon: "swords",
        name: "Top damage",
        tint: "text-orange-200 bg-orange-400/15 border-orange-300/40",
        count: ({ value }) => plural(value, "damage", "damage"),
    },
    [AwardKind.MostRevives]: {
        icon: "heart",
        name: "Most revives",
        tint: "text-emerald-200 bg-emerald-400/15 border-emerald-300/40",
        count: ({ value }) => plural(value, "revive"),
    },
    [AwardKind.LastStanding]: {
        icon: "shield",
        name: "Last one standing",
        tint: "text-rose-200 bg-rose-400/15 border-rose-300/40",
        count: ({ value }) => `${value} s alone`,
    },
};

/** Each award card rises a little after the one before. Written whole,
 *  because Tailwind emits only the classes it reads. */
const revealDelays = [
    "[animation-delay:250ms]",
    "[animation-delay:400ms]",
    "[animation-delay:550ms]",
    "[animation-delay:700ms]",
    "[animation-delay:850ms]",
];

interface AwardCardProps {
    award: Award;
    index: number;
}

/** One award: its picture and name, who earned it, and its count. */
function AwardCard({ award, index }: AwardCardProps) {
    const look = awardLooks[award.kind];
    return (
        <Text
            as="div"
            className={`flex min-w-0 animate-hud-rise items-center gap-2.5 rounded-lg bg-white/5 py-1.5 pr-3 pl-1.5 ${revealDelays[index] ?? ""}`}
        >
            <Text
                as="span"
                className={`flex size-9 shrink-0 items-center justify-center rounded-md border ${look.tint}`}
            >
                <Icon name={look.icon} className="size-5" />
            </Text>
            <Text as="span" className="flex min-w-0 flex-col">
                <Text className={hudLabel}>{look.name}</Text>
                <Text
                    as="span"
                    className="flex items-baseline gap-1.5 truncate"
                >
                    {award.wardens.map(({ name, hue }, slot) => (
                        <Text
                            key={`${name}:${hue}`}
                            className={`${hudDisplay} text-lg uppercase ${readWardenTextClass(hue)}`}
                        >
                            {slot > 0 ? `& ${name}` : name}
                        </Text>
                    ))}
                </Text>
                <Text className="truncate text-xs font-semibold text-white/65">
                    {look.count(award)}
                </Text>
            </Text>
        </Text>
    );
}

/** The run's awards, as the room set them, in a grid of two; nothing
 *  where nobody earned one. */
export function Awards() {
    const list = useTrait(useQueryFirst(AwardsTrait), AwardsTrait)?.list ?? [];
    if (list.length === 0) return null;
    return (
        <Text as="div" className="flex flex-col gap-1.5">
            <Text className={`${hudLabel} pl-1`}>Awards</Text>
            <Text as="div" className="grid grid-cols-2 gap-1.5">
                {list.map((award, index) => (
                    <AwardCard key={award.kind} award={award} index={index} />
                ))}
            </Text>
        </Text>
    );
}
