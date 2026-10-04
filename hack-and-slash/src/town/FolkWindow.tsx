import { useState } from "react";
import { Button, Text, useScenes, Window } from "@spawnite/engine";
import {
    buyItem,
    mergeItem,
    mergePlan,
    sellEntry,
    useProgress,
} from "../hero/progress";
import {
    describeEffect,
    describeItem,
    itemDef,
    itemTitle,
    rarityColors,
    rarityOf,
    sellPrice,
    storeStock,
    type ItemId,
    type Mods,
} from "../items/items";
import { hybridOf, jobClasses, useCatalog } from "../classes/catalog";
import { chooseJob, unlearnSkills } from "../hero/progress";
import { heroClassName, jobLevels, skillPointsLeft } from "../hero/jobs";
import { Cell } from "../hud/BagWindow";
import { toggleWindow } from "../hud/windows";
import { useCompact } from "../view/device";
import { folk, talkTo, useTown } from "./folk";

//  The window a townsperson opens as she talks to them: their greeting,
//  then the smith's merges, the store's goods, the trainer's jobs, or the
//  guard's way out.

export function FolkWindow() {
    const talking = useTown((state) => state.talking);
    const gold = useProgress((state) => state.gold);
    const one = folk.find((each) => each.id === talking);
    if (!one) return null;
    const close = () => talkTo(null);

    return (
        <Window
            id="folk"
            title={one.name}
            open
            onClose={close}
            className="w-[26rem]"
        >
            <Text as="div" className="flex items-center justify-between gap-3">
                <Text size="xs" className="opacity-70">
                    {one.title}
                </Text>
                <Text className="whitespace-nowrap">{gold} gold</Text>
            </Text>
            <Text size="sm" className="italic opacity-90">
                "{one.greeting}"
            </Text>
            {one.id === "smith" && <SmithWares />}
            {one.id === "grocer" && <StoreWares />}
            {one.id === "guard" && <GuardWay />}
            {one.id === "trainer" && <TrainerJobs />}
        </Window>
    );
}

/** A row: an item's place, what it is, and what can be done with it. */
function Row({
    item,
    mods = {},
    note,
    children,
}: {
    item: ItemId;
    mods?: Mods;
    note?: string;
    children: React.ReactNode;
}) {
    const plus = mods.plus ?? 0;
    const effects = mods.effects;
    return (
        <Text
            as="div"
            className="flex items-center gap-2 rounded-xl bg-black/25 p-1.5"
        >
            <Cell item={item} mods={mods} />
            <Text as="div" className="flex min-w-0 flex-1 flex-col">
                <Text
                    className="truncate text-sm font-semibold"
                    style={{ color: rarityColors[rarityOf(item, mods)] }}
                >
                    {itemTitle(item, plus)}
                </Text>
                <Text className="text-xs opacity-75">
                    {note ?? describeItem(item, mods)}
                </Text>
                {effects?.map((effect, index) => (
                    <Text key={index} className="text-xs text-cyan-200">
                        ✦ {describeEffect(effect)}
                    </Text>
                ))}
            </Text>
            {children}
        </Text>
    );
}

/** The smith's merges: each piece she has two of, what merging them makes,
 *  its chance and its price; and how the last one went. */
function SmithWares() {
    const progress = useProgress();
    const [news, setNews] = useState<string | null>(null);
    const kinds = [
        ...new Set([
            ...progress.bag.map((entry) => entry.item),
            ...(Object.values(progress.equipped).filter(Boolean) as ItemId[]),
        ]),
    ];
    const plans = kinds
        .map((item) => ({ item, plan: mergePlan(progress, item) }))
        .filter(
            (
                each,
            ): each is {
                item: ItemId;
                plan: NonNullable<ReturnType<typeof mergePlan>>;
            } => !!each.plan,
        );

    return (
        <Text as="div" className="flex flex-col gap-1.5">
            {news && (
                <Text
                    size="sm"
                    className="rounded-xl bg-black/35 px-2 py-1.5 font-semibold"
                >
                    {news}
                </Text>
            )}
            {plans.length === 0 ? (
                <Text size="sm" className="opacity-70">
                    You have no two of the same piece to merge. Bring back
                    doubles from the wilds.
                </Text>
            ) : (
                plans.map(({ item, plan }) => {
                    const affordable = progress.gold >= plan.cost;
                    const effectNext = plan.next % 10 === 0;
                    return (
                        <Row
                            key={item}
                            item={item}
                            mods={{
                                ...plan.kept.mods,
                                plus: plan.plus,
                                effects: plan.effects,
                            }}
                            note={`To +${plan.next}: ${describeItem(item, { ...plan.kept.mods, plus: plan.next }) || "stronger"}${effectNext ? " · and a new effect" : ""} · ${Math.round(plan.chance * 100)}% chance`}
                        >
                            <Button
                                label={`Merge ${itemTitle(item, plan.plus)} for ${plan.cost} gold`}
                                pressed={affordable}
                                onPress={() => {
                                    if (!affordable)
                                        return setNews(
                                            `You need ${plan.cost} gold for that.`,
                                        );
                                    const result = mergeItem(item);
                                    if (!result) return;
                                    setNews(
                                        result.took
                                            ? `It took! ${itemTitle(item, plan.next)}${result.gained ? ` gained: ${describeEffect(result.gained)}` : ""}`
                                            : `It failed. The copy and the ${plan.cost} gold are gone; ${itemTitle(item, plan.plus)} is as it was.`,
                                    );
                                }}
                                className="h-10 rounded-xl px-2 text-xs whitespace-nowrap"
                            >
                                Merge · {plan.cost}g
                            </Button>
                        </Row>
                    );
                })
            )}
            <Text size="xs" className="opacity-60">
                A merge uses up your least merged spare copy. Every merge raises
                the piece's stats; every tenth adds an effect; from +7 it glows.
            </Text>
        </Text>
    );
}

/** The store: its goods to buy, and whatever she carries to sell. */
function StoreWares() {
    const bag = useProgress((state) => state.bag);
    const gold = useProgress((state) => state.gold);
    const [tab, setTab] = useState<"buy" | "sell">("buy");
    const [news, setNews] = useState<string | null>(null);

    return (
        <Text as="div" className="flex flex-col gap-1.5">
            <Text as="div" className="flex gap-2">
                <Button
                    pressed={tab === "buy"}
                    onPress={() => setTab("buy")}
                    className="h-9 flex-1 rounded-xl text-sm"
                >
                    Buy
                </Button>
                <Button
                    pressed={tab === "sell"}
                    onPress={() => setTab("sell")}
                    className="h-9 flex-1 rounded-xl text-sm"
                >
                    Sell
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
            {tab === "buy" ? (
                storeStock.map(({ item, price }) => (
                    <Row key={item} item={item}>
                        {[1, 5].map((many) => (
                            <Button
                                key={many}
                                label={`Buy ${many} ${itemDef(item).name} for ${price * many} gold`}
                                pressed={gold >= price * many}
                                onPress={() => {
                                    let bought = 0;
                                    while (
                                        bought < many &&
                                        buyItem(item, price)
                                    )
                                        bought++;
                                    setNews(
                                        bought
                                            ? `Bought ${bought} ${itemDef(item).name}${bought > 1 ? "s" : ""}.`
                                            : gold < price
                                              ? `You need ${price} gold.`
                                              : "Your bag is full.",
                                    );
                                }}
                                className="h-10 rounded-xl px-2 text-xs whitespace-nowrap"
                            >
                                ×{many} · {price * many}g
                            </Button>
                        ))}
                    </Row>
                ))
            ) : bag.length === 0 ? (
                <Text size="sm" className="opacity-70">
                    Your bag is empty.
                </Text>
            ) : (
                bag.map((entry) => {
                    const price = sellPrice(entry.item, entry);
                    return (
                        <Row
                            key={entry.key}
                            item={entry.item}
                            mods={entry}
                            note={
                                entry.count > 1
                                    ? `${entry.count} carried`
                                    : undefined
                            }
                        >
                            <Button
                                label={`Sell ${itemTitle(entry.item, entry.plus)} for ${price} gold`}
                                onPress={() => {
                                    sellEntry(entry.key);
                                    setNews(
                                        `Sold ${itemTitle(entry.item, entry.plus)} for ${price} gold.`,
                                    );
                                }}
                                className="h-10 rounded-xl px-2 text-xs whitespace-nowrap"
                            >
                                Sell · {price}g
                            </Button>
                        </Row>
                    );
                })
            )}
            <Text size="xs" className="opacity-60">
                What you wear is not for sale: take it off in the bag first.
            </Text>
        </Text>
    );
}

/** The guard's way out to the wilds. */
function GuardWay() {
    const scenes = useScenes();
    return (
        <Button
            onPress={() => {
                talkTo(null);
                scenes.go("run");
            }}
            className="h-11 rounded-xl text-base"
        >
            Head into the wilds
        </Button>
    );
}

/** A class's name with "a" or "an" before it. */
const withArticle = (name: string) =>
    `${/^[AEIOU]/.test(name) ? "an" : "a"} ${name}`;

/** The trainer's jobs: her first job from its level, then her second, each
 *  a card to take or change to, free for now; the hybrid each second job
 *  would make with her first; and a reset of every skill. */
function TrainerJobs() {
    const progress = useProgress();
    useCatalog((state) => state.version);
    const compact = useCompact();
    const [news, setNews] = useState<string | null>(null);
    const jobs = jobClasses();
    const slots = jobLevels.map((level, slot) => ({ level, slot }));

    return (
        <Text as="div" className="flex flex-col gap-2">
            <Text size="sm" className="font-semibold">
                You are {withArticle(heroClassName(progress))} ·{" "}
                {skillPointsLeft(progress)} skill points to spend
            </Text>
            {news && (
                <Text
                    size="sm"
                    className="rounded-xl bg-black/35 px-2 py-1.5 font-semibold"
                >
                    {news}
                </Text>
            )}
            {slots.map(({ level, slot }) => {
                const open =
                    progress.level >= level && slot <= progress.jobs.length;
                const current = progress.jobs[slot];
                const other = progress.jobs[1 - slot];
                return (
                    <Text
                        as="div"
                        key={slot}
                        className="flex flex-col gap-1.5 rounded-xl bg-black/25 p-2"
                    >
                        <Text size="xs" className="font-bold opacity-80">
                            {slot === 0 ? "First" : "Second"} job · from level{" "}
                            {level}
                            {!open && progress.level < level
                                ? " · not yet"
                                : ""}
                            {!open && progress.level >= level
                                ? " · take your first job first"
                                : ""}
                        </Text>
                        <Text as="div" className="grid grid-cols-2 gap-1.5">
                            {jobs
                                .filter((job) => job.id !== other)
                                .map((job) => {
                                    const hybrid = other
                                        ? hybridOf(other, job.id)
                                        : undefined;
                                    const taken = current === job.id;
                                    return (
                                        <Button
                                            key={job.id}
                                            label={`${taken ? "Your job" : "Take the job"}: ${job.name}`}
                                            disabled={!open}
                                            onPress={() => {
                                                if (taken) return;
                                                const why = chooseJob(
                                                    slot,
                                                    job.id,
                                                );
                                                setNews(
                                                    why ??
                                                        `You are ${withArticle(heroClassName(useProgress.getState()))} now.`,
                                                );
                                            }}
                                            className={`h-auto min-w-0 rounded-xl border-2 px-2.5 py-2 text-left ${taken ? "border-amber-300 bg-white/20" : "border-white/25 bg-black/30"}`}
                                            classNames={{
                                                icon: "w-full flex-col items-start gap-0.5",
                                            }}
                                        >
                                            <Text className="text-sm font-bold">
                                                {job.name}
                                                {taken ? " ✓" : ""}
                                            </Text>
                                            <Text className="text-xs opacity-75">
                                                {job.description}
                                            </Text>
                                            {hybrid && (
                                                <Text className="text-xs text-amber-300">
                                                    {`With ${jobs.find((each) => each.id === other)?.name}: ${hybrid.name}`}
                                                </Text>
                                            )}
                                        </Button>
                                    );
                                })}
                        </Text>
                    </Text>
                );
            })}
            <Text as="div" className="flex flex-wrap gap-2">
                {progress.jobs.length > 0 && (
                    <Button
                        onPress={() => {
                            talkTo(null);
                            toggleWindow("skills", compact);
                        }}
                        className="h-10 rounded-xl px-3 text-sm"
                    >
                        Open your skills
                    </Button>
                )}
                <Button
                    onPress={() =>
                        setNews(
                            unlearnSkills() ??
                                "Every skill unlearned; your points are back.",
                        )
                    }
                    className="h-10 rounded-xl px-3 text-sm"
                >
                    Unlearn every skill
                </Button>
            </Text>
            <Text size="xs" className="opacity-60">
                Taking or changing a job is free for now. A job you leave gives
                back the points spent in its tree.
            </Text>
        </Text>
    );
}
