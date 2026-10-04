import { useState } from "react";
import { useWorld } from "koota/react";
import {
    Button,
    NumberField,
    Select,
    Text,
    Toggle,
    Window,
} from "@spawnite/engine";
import {
    addItem,
    gainGold,
    gainXp,
    healHero,
    stacks,
    useProgress,
    xpToNext,
} from "../hero/progress";
import {
    describeEffect,
    describeItem,
    itemDef,
    itemIds,
    itemTitle,
    rarities,
    rarityColors,
    rarityNames,
    rolledMods,
    type EffectKind,
    type ItemEffect,
    type ItemId,
    type Mods,
    type Rarity,
} from "../items/items";
import { Cell } from "./BagWindow";
import { closeWindow, openWindow, useWindows } from "./windows";

//  The GM tools, for the creator's playtests: any item made to order, at
//  any rarity and merge with any effects, into the bag; gold, levels and
//  health on a press; and the class editor.

/** Levels her up until she stands at `target`, as experience would. */
function reachLevel(target: number) {
    while (useProgress.getState().level < target) {
        const { level, xp } = useProgress.getState();
        gainXp(xpToNext(level) - xp);
    }
}

/** Each effect, with the value it starts at in the window. */
const effectKinds: {
    kind: EffectKind;
    name: string;
    start: number;
    unit: string;
}[] = [
    { kind: "poison", name: "Poison", start: 30, unit: "/s" },
    { kind: "burn", name: "Burn", start: 60, unit: "/s" },
    { kind: "leech", name: "Leech", start: 5, unit: "%" },
    { kind: "frenzy", name: "Frenzy", start: 10, unit: "%" },
    { kind: "cyclone", name: "Cyclone skill", start: 0, unit: "" },
    //  A crossbow's bolts.
    { kind: "pierce", name: "Pierce", start: 2, unit: "more" },
    { kind: "multishot", name: "Multishot", start: 2, unit: "bolts" },
    { kind: "ricochet", name: "Ricochet", start: 2, unit: "bounces" },
];

/** A control at the windows' size: the ui control's own look, two rows
 *  shorter than a menu's. */
export const field = "h-7 w-full min-w-0 rounded-lg px-2 text-sm";

export function GmWindow() {
    const open = useWindows((state) => state.gm);
    const world = useWorld();
    const level = useProgress((state) => state.level);
    const [item, setItem] = useState<ItemId>("ironSword");
    const [rarity, setRarity] = useState<Rarity>("legendary");
    const [plus, setPlus] = useState(10);
    const [count, setCount] = useState(1);
    const [chosen, setChosen] = useState<Partial<Record<EffectKind, number>>>({
        burn: 60,
    });
    const [news, setNews] = useState<string | null>(null);
    if (!open) return null;
    const close = () => closeWindow("gm");

    const gear = !stacks(item);
    const effects: ItemEffect[] = (
        Object.entries(chosen) as [EffectKind, number][]
    ).map(([kind, value]) => ({ kind, value }));
    //  The piece as it will be made, without its random bonus stats, which
    //  roll as it is made.
    const preview: Mods = gear ? { rarity, plus, effects } : {};

    const make = () => {
        let made = 0;
        for (let one = 0; one < count; one++) {
            const mods: Mods = gear
                ? { ...rolledMods(item, rarity), rarity, plus, effects }
                : {};
            if (!addItem(item, mods)) break;
            made++;
        }
        setNews(
            made
                ? `Made ${made} × ${itemTitle(item, gear ? plus : 0)}.`
                : "The bag is full.",
        );
    };

    return (
        <Window
            id="gm"
            title="GM tools"
            open
            onClose={close}
            className="w-[30rem]"
        >
            <Text as="div" className="flex flex-wrap gap-2">
                <Button
                    onPress={() => gainGold(10000)}
                    className="h-9 rounded-xl px-3 text-sm"
                >
                    +10,000 gold
                </Button>
                <Button
                    onPress={() => {
                        const { xp } = useProgress.getState();
                        gainXp(xpToNext(level) - xp);
                    }}
                    className="h-9 rounded-xl px-3 text-sm"
                >
                    +1 level
                </Button>
                {[10, 20].map((target) => (
                    <Button
                        key={target}
                        pressed={level < target}
                        onPress={() => reachLevel(target)}
                        className="h-9 rounded-xl px-3 text-sm"
                    >
                        Level {target}
                    </Button>
                ))}
                <Button
                    onPress={() => {
                        close();
                        openWindow("classes");
                    }}
                    className="h-9 rounded-xl px-3 text-sm"
                >
                    Class editor
                </Button>
                <Button
                    onPress={() => healHero(world, 1e9)}
                    className="h-9 rounded-xl px-3 text-sm"
                >
                    Full health
                </Button>
            </Text>

            <Text size="sm" className="font-semibold">
                Make an item
            </Text>
            <Text as="div" className="flex items-center gap-2">
                <Cell item={item} mods={preview} />
                <Select
                    label="Item"
                    options={itemIds.map((id) => ({
                        value: id,
                        label: `${itemDef(id).name}${itemDef(id).slot ? ` (${itemDef(id).slot})` : ""}`,
                    }))}
                    value={item}
                    onChange={(id) => setItem(id as ItemId)}
                    className={`${field} flex-1`}
                />
            </Text>
            {gear && (
                <>
                    <Text as="div" className="flex flex-wrap gap-1.5">
                        {rarities.map((each) => (
                            <Button
                                key={each}
                                pressed={rarity === each}
                                onPress={() => setRarity(each)}
                                className="h-auto min-w-0 rounded-lg border-2 px-2 py-1 text-xs font-semibold"
                                style={{
                                    borderColor: rarityColors[each],
                                    color: rarityColors[each],
                                }}
                            >
                                {rarityNames[each]}
                            </Button>
                        ))}
                    </Text>
                    <Text
                        as="label"
                        className="flex items-center gap-2 text-sm"
                    >
                        Merges +
                        <NumberField
                            label="Merges"
                            value={plus}
                            min={0}
                            max={200}
                            onChange={setPlus}
                            className={`${field} w-20`}
                        />
                    </Text>
                    <Text as="div" className="flex flex-col gap-1">
                        {effectKinds.map(({ kind, name, start, unit }) => {
                            const on = chosen[kind] !== undefined;
                            return (
                                <Text
                                    as="label"
                                    key={kind}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Toggle
                                        label={name}
                                        value={on}
                                        onChange={() =>
                                            setChosen((was) => {
                                                const next = { ...was };
                                                if (on) delete next[kind];
                                                else next[kind] = start;
                                                return next;
                                            })
                                        }
                                    />
                                    <Text className="w-28">{name}</Text>
                                    {on && kind !== "cyclone" && (
                                        <>
                                            <NumberField
                                                label={`${name} ${unit}`}
                                                value={chosen[kind] ?? start}
                                                min={1}
                                                onChange={(value) =>
                                                    setChosen((was) => ({
                                                        ...was,
                                                        [kind]: value,
                                                    }))
                                                }
                                                className={`${field} w-20`}
                                            />
                                            <Text className="opacity-70">
                                                {unit}
                                            </Text>
                                        </>
                                    )}
                                </Text>
                            );
                        })}
                    </Text>
                </>
            )}
            <Text size="xs" className="opacity-75">
                {describeItem(item, preview) || "No bonuses"}
                {gear && rarity !== itemDef(item).rarity
                    ? " · plus its rarity's random bonus stats"
                    : ""}
            </Text>
            {effects.length > 0 && gear && (
                <Text size="xs" className="text-cyan-200">
                    {effects.map(describeEffect).join(" · ")}
                </Text>
            )}
            <Text as="div" className="flex items-center gap-2">
                <Text as="label" className="flex items-center gap-2 text-sm">
                    How many
                    <NumberField
                        label="How many"
                        value={count}
                        min={1}
                        max={20}
                        onChange={setCount}
                        className={`${field} w-16`}
                    />
                </Text>
                <Button
                    onPress={make}
                    className="h-10 flex-1 rounded-xl text-sm"
                >
                    Put in the bag
                </Button>
            </Text>
            {news && (
                <Text
                    size="sm"
                    className="rounded-xl bg-black/35 px-2 py-1.5 font-semibold"
                >
                    {news}
                </Text>
            )}
        </Window>
    );
}
