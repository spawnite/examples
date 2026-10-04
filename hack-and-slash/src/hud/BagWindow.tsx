import {
    useEffect,
    useRef,
    useState,
    type MouseEvent,
    type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button, Draggable, Image, Slot, Text, Window } from "@spawnite/engine";
import { askForPotion } from "../combat/aim";
import {
    bagSize,
    deriveHero,
    equip,
    fitsOffHand,
    unequip,
    useProgress,
    type ActiveSkillId,
    type BagEntry,
    type Mods,
} from "../hero/progress";
import {
    describeEffect,
    describeItem,
    glowOf,
    itemDef,
    itemTitle,
    rarityColors,
    rarityNames,
    rarityOf,
    type EquipSlot,
    type ItemId,
    type WeaponKind,
} from "../items/items";
import { readClasses } from "../classes/catalog";
import { useCompact, usePortrait, useTouch } from "../view/device";
import { QuickSlotPicture } from "./QuickSlotPicture";
import { iconUrl, skillHint, skillName, skillUrl, slotUrl } from "./pictures";
import { closeWindow, useWindows } from "./windows";

//  The bag: what she wears two across on the left, what she carries in a
//  grid on the right; on a phone held upright, what she wears in a row
//  over the grid. An item under the mouse shows a tooltip at the cursor;
//  an item tapped or clicked pins one above itself, with what can be done
//  with it. The window keeps its size: nothing in it changes with the item
//  looked at.

/** Where an item in the window is: worn in a slot, or in the bag; or a
 *  skill her gear gives. */
type Pick = { worn: EquipSlot } | { key: number } | { skill: ActiveSkillId };

/** The tooltip: what it shows, and where. A hover's follows the cursor; a
 *  pinned one stands over its item's place and carries its buttons. */
type Tip =
    | { pinned: false; pick: Pick; x: number; y: number }
    | { pinned: true; pick: Pick; place: DOMRect };

const slotNames: Record<EquipSlot, string> = {
    head: "Head",
    weapon: "Weapon",
    shield: "Off-hand",
    body: "Body",
    hands: "Gloves",
    feet: "Boots",
};

/** The worn slots, two across: her head and body, her weapon and gloves,
 *  her shield and boots. */
const slots: EquipSlot[] = [
    "head",
    "body",
    "weapon",
    "hands",
    "shield",
    "feet",
];

function kindOf(id: ItemId) {
    const item = itemDef(id);
    if (item.heal !== undefined) return "potion";
    if (item.weapon) return item.weapon;
    if (item.slot === "shield") return "shield";
    if (item.slot === "body") return "armor";
    if (item.slot === "hands") return "gloves";
    if (item.slot === "feet") return "boots";
    return "headgear";
}

function samePick(a: Pick | null | undefined, b: Pick) {
    if (!a) return false;
    if ("worn" in a) return "worn" in b && a.worn === b.worn;
    if ("skill" in a) return "skill" in b && a.skill === b.skill;
    return "key" in b && a.key === b.key;
}

export function BagWindow() {
    const progress = useProgress();
    const { bag, equipped, equippedMods, gold } = progress;
    const skills = deriveHero(progress).skills;
    const open = useWindows((state) => state.bag);
    const compact = useCompact();
    const portrait = usePortrait();
    const stacked = compact && portrait;
    const touch = useTouch();
    const [tip, setTip] = useState<Tip | null>(null);

    //  A pinned tooltip closes on a press anywhere but on it or on an item.
    useEffect(() => {
        if (!tip?.pinned) return;
        const away = (event: globalThis.PointerEvent) => {
            const target = event.target as Element | null;
            if (target?.closest("[data-bag-tip], [data-bag-item]")) return;
            setTip(null);
        };
        window.addEventListener("pointerdown", away);
        return () => window.removeEventListener("pointerdown", away);
    }, [tip?.pinned]);

    useEffect(() => {
        if (!open) setTip(null);
    }, [open]);

    if (!open) return null;

    const itemAt = (pick: Pick): ItemId | null => {
        if ("skill" in pick) return null;
        if ("worn" in pick) return equipped[pick.worn];
        return bag.find((entry) => entry.key === pick.key)?.item ?? null;
    };
    const countAt = (pick: Pick) =>
        "key" in pick
            ? (bag.find((entry) => entry.key === pick.key)?.count ?? 1)
            : 1;
    const modsAt = (pick: Pick): Mods =>
        "worn" in pick
            ? (equippedMods[pick.worn] ?? {})
            : "key" in pick
              ? (bag.find((entry) => entry.key === pick.key) ?? {})
              : {};

    //  The mouse's hover follows the cursor, unless a tooltip is pinned.
    const hover = (pick: Pick) => ({
        onPointerMove: (event: PointerEvent) => {
            if (event.pointerType !== "mouse" || tip?.pinned) return;
            setTip({ pinned: false, pick, x: event.clientX, y: event.clientY });
        },
        onPointerLeave: (event: PointerEvent) => {
            if (event.pointerType === "mouse" && !tip?.pinned) setTip(null);
        },
    });
    //  A tap or a click pins the tooltip over the item, or lets it go.
    const pin = (pick: Pick) => (event: MouseEvent<HTMLButtonElement>) => {
        if (tip?.pinned && samePick(tip.pick, pick)) return setTip(null);
        setTip({
            pinned: true,
            pick,
            place: event.currentTarget.getBoundingClientRect(),
        });
    };

    const places: (BagEntry | null)[] = Array.from(
        { length: bagSize },
        (_, index) => bag[index] ?? null,
    );
    const tipItem = tip ? itemAt(tip.pick) : null;
    const tipSkill = tip && "skill" in tip.pick ? tip.pick.skill : null;

    const close = () => closeWindow("bag");
    const worn = (
        <Text
            as="div"
            className={`grid gap-1.5 ${stacked ? "grid-cols-6" : "grid-cols-2"}`}
        >
            {slots.map((slot) => {
                const pick: Pick = { worn: slot };
                return (
                    <Cell
                        key={slot}
                        large={compact}
                        item={itemAt(pick)}
                        mods={modsAt(pick)}
                        empty={slot}
                        emptyLabel={`${slotNames[slot]}: empty`}
                        selected={
                            tip?.pinned === true && samePick(tip.pick, pick)
                        }
                        onPick={pin(pick)}
                        onDoublePick={
                            slot === "weapon"
                                ? undefined
                                : () => {
                                      unequip(slot);
                                      setTip(null);
                                  }
                        }
                        {...hover(pick)}
                    />
                );
            })}
        </Text>
    );
    const carried = (
        <Text as="div" className="grid grid-cols-5 gap-1.5">
            {places.map((entry, index) => {
                if (!entry)
                    return (
                        <Cell
                            key={`empty-${index}`}
                            large={compact}
                            item={null}
                        />
                    );
                const pick: Pick = { key: entry.key };
                const potion = itemDef(entry.item).heal !== undefined;
                return (
                    <Draggable
                        key={entry.key}
                        data={entry.item}
                        disabled={!potion}
                        preview={<QuickSlotPicture what={entry.item} />}
                    >
                        <Cell
                            large={compact}
                            item={entry.item}
                            mods={entry}
                            count={entry.count}
                            selected={
                                tip?.pinned === true && samePick(tip.pick, pick)
                            }
                            onPick={pin(pick)}
                            onDoublePick={() => {
                                if (potion) askForPotion();
                                else {
                                    equip(entry.key);
                                    setTip(null);
                                }
                            }}
                            {...hover(pick)}
                        />
                    </Draggable>
                );
            })}
        </Text>
    );
    const wornLabel = (
        <Text size="xs" className="opacity-70">
            Worn
        </Text>
    );
    const carriedLabel = (
        <Text size="xs" className="opacity-70">
            Carried {bag.length}/{bagSize}
        </Text>
    );
    //  The skills her gear gives, to drag onto the paw.
    const skillRow = skills.length > 0 && (
        <Text as="div" className="flex items-center gap-1.5">
            <Text size="xs" className="opacity-70">
                Skills
            </Text>
            {skills.map((skill) => {
                const pick: Pick = { skill };
                return (
                    <Draggable
                        key={skill}
                        data={skill}
                        preview={<QuickSlotPicture what={skill} />}
                    >
                        {/* eslint-disable-next-line no-restricted-syntax -- a skill that pins a tooltip and shows it on hover: pointer handlers Button does not carry; a gap in the pull request */}
                        <button
                            type="button"
                            data-bag-item
                            aria-label={skillName(skill)}
                            onClick={pin(pick)}
                            {...hover(pick)}
                            className={`pointer-events-auto flex ${compact ? "size-13" : "size-12"} items-center justify-center rounded-lg border-2 border-cyan-300/70 bg-black/35 outline-none hover:bg-white/10 ${
                                tip?.pinned && samePick(tip.pick, pick)
                                    ? "ring-2 ring-white"
                                    : ""
                            }`}
                        >
                            <Image
                                src={skillUrl(skill)}
                                label=""
                                className="size-9"
                            />
                        </button>
                    </Draggable>
                );
            })}
        </Text>
    );

    const body = (
        <>
            <Text className="whitespace-nowrap">{gold} gold</Text>
            {stacked ? (
                <>
                    {wornLabel}
                    {worn}
                    {skillRow}
                    {carriedLabel}
                    {carried}
                </>
            ) : (
                <Text as="div" className="flex items-start gap-3">
                    <Text
                        as="div"
                        className="flex flex-col items-center gap-1.5"
                    >
                        {wornLabel}
                        {worn}
                        {skillRow}
                    </Text>
                    <Text as="div" className="flex flex-col gap-1.5">
                        {carriedLabel}
                        {carried}
                    </Text>
                </Text>
            )}
            <Text size="xs" className="opacity-60">
                {touch
                    ? "Tap an item to see it and use it · drag potions and skills onto the paw"
                    : "Hover or tap an item to see it · double-click to use · drag potions and skills onto the paw"}
            </Text>
            {tip &&
                tipItem &&
                createPortal(
                    <Tooltip
                        tip={tip}
                        item={tipItem}
                        mods={modsAt(tip.pick)}
                        count={countAt(tip.pick)}
                        onDone={() => setTip(null)}
                    />,
                    document.body,
                )}
            {tip &&
                tipSkill &&
                createPortal(
                    <SkillTip tip={tip} skill={tipSkill} />,
                    document.body,
                )}
        </>
    );
    return (
        <Window id="bag" title="Bag" open onClose={close} slot={Slot.Left}>
            {body}
        </Window>
    );
}

/** One place: an item's sprite on a pane edged in its rarity's colour, its
 *  merges in a corner and a glow from +7, and its count on a stack; or,
 *  empty, a faint sign of what goes there. */
export function Cell({
    item,
    mods = {},
    large = false,
    count = 1,
    empty,
    emptyLabel,
    selected = false,
    onPick,
    onDoublePick,
    onPointerMove,
    onPointerLeave,
}: {
    item: ItemId | null;
    mods?: Mods;
    /** Larger, for a finger. */
    large?: boolean;
    count?: number;
    /** The slot an empty worn place shows the outline of. */
    empty?: EquipSlot;
    emptyLabel?: string;
    selected?: boolean;
    onPick?: (event: MouseEvent<HTMLButtonElement>) => void;
    onDoublePick?: () => void;
    onPointerMove?: (event: PointerEvent) => void;
    onPointerLeave?: (event: PointerEvent) => void;
}) {
    const def = item ? itemDef(item) : null;
    const plus = mods.plus ?? 0;
    const glow = item ? glowOf(plus, mods.effects) : null;
    return (
        // eslint-disable-next-line no-restricted-syntax -- an item slot that double-clicks and shows a tooltip on hover: pointer handlers Button does not carry; a gap in the pull request
        <button
            type="button"
            data-bag-item
            aria-label={
                def
                    ? `${def.name}${count > 1 ? ` ×${count}` : ""}`
                    : (emptyLabel ?? "Empty")
            }
            aria-pressed={item ? selected : undefined}
            disabled={!item && !empty}
            onClick={item ? onPick : undefined}
            onDoubleClick={item ? onDoublePick : undefined}
            onPointerMove={item ? onPointerMove : undefined}
            onPointerLeave={item ? onPointerLeave : undefined}
            className={`pointer-events-auto relative flex ${large ? "size-13" : "size-12"} items-center justify-center rounded-lg border-2 bg-black/35 outline-none select-none focus-visible:ring-2 focus-visible:ring-white ${
                selected ? "ring-2 ring-white" : ""
            } ${item ? "cursor-pointer hover:bg-white/10" : ""}`}
            style={{
                borderColor: def
                    ? rarityColors[rarityOf(item!, mods)]
                    : "rgb(255 255 255 / 0.12)",
                boxShadow: glow
                    ? `0 0 ${6 + 10 * glow.strength}px ${glow.color}, inset 0 0 ${4 + 8 * glow.strength}px ${glow.color}`
                    : undefined,
            }}
        >
            {item ? (
                <Image src={iconUrl(item)} label="" className="size-10" />
            ) : empty ? (
                <Image
                    src={slotUrl(empty)}
                    label=""
                    className="size-8 opacity-25 [image-rendering:pixelated]"
                />
            ) : null}
            {count > 1 && (
                <Text
                    size="xs"
                    className="absolute right-0.5 bottom-0 leading-none"
                >
                    {count}
                </Text>
            )}
            {plus > 0 && (
                <Text className="absolute top-0 left-0.5 text-[0.65rem] leading-none font-bold text-amber-200 [text-shadow:0_1px_1px_black]">
                    +{plus}
                </Text>
            )}
        </button>
    );
}

/** Pixels between the tooltip and what it stands by, and its width: 14
 *  of the root's font size, so it scales with the HUD. */
const tipGap = 12;
const tipWidth = () =>
    14 * parseFloat(getComputedStyle(document.documentElement).fontSize);

/** What the item is and gives: at the cursor for a hover, over its place
 *  for a tap, with its buttons there. */
/** Where a tooltip `width` wide and `height` tall stands for `tip`. */
function tipPlace(tip: Tip, width: number, height: number) {
    const clampX = (x: number) =>
        Math.max(8, Math.min(window.innerWidth - width - 8, x));
    if (tip.pinned) {
        //  Centred over its item, or under it where the top has no room.
        const { place } = tip;
        return {
            left: clampX(place.left + place.width / 2 - width / 2),
            top:
                place.top - tipGap - height > 8
                    ? place.top - tipGap - height
                    : place.bottom + tipGap,
        };
    }
    //  Down and right of the cursor, or flipped where the edge is near.
    return {
        left:
            tip.x + tipGap + width > window.innerWidth
                ? tip.x - tipGap - width
                : tip.x + tipGap,
        top:
            tip.y + tipGap + height > window.innerHeight
                ? tip.y - tipGap - height
                : tip.y + tipGap,
    };
}

const tipBox =
    "fixed z-[100] flex flex-col gap-1 rounded-xl border border-white/15 bg-neutral-950/92 px-3 py-2 text-white shadow-xl shadow-black/50";

/** A skill's name and what it does. */
function SkillTip({ tip, skill }: { tip: Tip; skill: ActiveSkillId }) {
    const box = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);
    useEffect(() => {
        setHeight(box.current?.offsetHeight ?? 0);
    }, [tip, skill]);
    const width = tipWidth();
    return (
        // eslint-disable-next-line no-restricted-syntax -- a tooltip placed by its measured height, through a ref Text does not carry; a gap in the pull request
        <div
            ref={box}
            data-bag-tip
            role="tooltip"
            className={`${tipBox} pointer-events-none`}
            style={{ ...tipPlace(tip, width, height), width }}
        >
            <Text className="text-base font-semibold text-cyan-300">
                {skillName(skill)}
            </Text>
            <Text className="text-xs opacity-70">Skill from your gear</Text>
            <Text className="text-sm">{skillHint(skill)}</Text>
            <Text className="text-xs opacity-70">
                Drag it onto the paw to use it.
            </Text>
        </div>
    );
}

function Tooltip({
    tip,
    item,
    mods,
    count,
    onDone,
}: {
    tip: Tip;
    item: ItemId;
    mods: Mods;
    count: number;
    onDone: () => void;
}) {
    const box = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);
    useEffect(() => {
        setHeight(box.current?.offsetHeight ?? 0);
    }, [tip, item]);

    const def = itemDef(item);
    const worn = "worn" in tip.pick;
    const potion = def.heal !== undefined;
    const width = tipWidth();
    const plus = mods.plus ?? 0;
    return (
        // eslint-disable-next-line no-restricted-syntax -- a tooltip placed by its measured height, through a ref Text does not carry; a gap in the pull request
        <div
            ref={box}
            data-bag-tip
            role="tooltip"
            className={`${tipBox} ${tip.pinned ? "pointer-events-auto" : "pointer-events-none"}`}
            style={{ ...tipPlace(tip, width, height), width }}
        >
            <Text
                className="text-base font-semibold"
                style={{ color: rarityColors[rarityOf(item, mods)] }}
            >
                {itemTitle(item, plus)}
                {count > 1 ? ` ×${count}` : ""}
            </Text>
            <Text className="text-xs capitalize opacity-70">
                {rarityNames[rarityOf(item, mods)]} {kindOf(item)}
                {worn ? " · worn" : ""}
            </Text>
            <Text className="text-sm">
                {describeItem(item, mods) || "No bonuses"}
            </Text>
            {mods.effects?.map((effect, index) => (
                <Text key={index} className="text-sm text-cyan-200">
                    ✦ {describeEffect(effect)}
                </Text>
            ))}
            {tip.pinned && (
                <TipButtons pick={tip.pick} potion={potion} onDone={onDone} />
            )}
        </div>
    );
}

/** What lets her hold a weapon of `offKind` in her off hand beside one of
 *  `kind`: the skills that unlock it, each with its class. */
function offHandNote(kind: WeaponKind, offKind: WeaponKind) {
    const unlock = kind === offKind ? "dualWield" : "mixedArms";
    const skills = [...readClasses().skills.values()]
        .filter(
            ({ skill }) =>
                skill.unlocks.includes(unlock) &&
                (skill.weapon === "any" ||
                    skill.weapon === kind ||
                    skill.weapon === offKind),
        )
        .map(({ skill, owner }) => `${skill.name} (${owner.name})`);
    const beside =
        kind === offKind
            ? `a second ${offKind}`
            : `a ${offKind} beside a ${kind}`;
    return skills.length
        ? `Holding ${beside} takes the skill ${skills.join(" or ")}.`
        : `No skill lets her hold ${beside} yet.`;
}

function TipButtons({
    pick,
    potion,
    onDone,
}: {
    pick: Pick;
    potion: boolean;
    onDone: () => void;
}) {
    const button = "h-9 min-w-9 rounded-xl px-3 text-sm";
    const progress = useProgress.getState();
    if ("skill" in pick) return null;
    if ("key" in pick) {
        const item = progress.bag.find((entry) => entry.key === pick.key)?.item;
        //  A weapon goes in her main hand, or in her off hand beside one of
        //  its kind: two swords, or two crossbows.
        const weapon = item ? itemDef(item).weapon : undefined;
        const offHand = !!item && !!weapon && fitsOffHand(progress, item);
        return (
            <Text className="flex flex-wrap gap-2">
                <Button
                    className={button}
                    onPress={() => {
                        if (potion) askForPotion();
                        else {
                            equip(pick.key);
                            onDone();
                        }
                    }}
                >
                    {potion ? "Drink" : weapon ? "Main hand" : "Equip"}
                </Button>
                {weapon && (
                    <Button
                        className={button}
                        pressed={offHand}
                        onPress={() => {
                            if (!offHand) return;
                            equip(pick.key, "off");
                            onDone();
                        }}
                    >
                        Off-hand
                    </Button>
                )}
                {weapon && !offHand && (
                    <Text className="w-full text-xs opacity-70">
                        {offHandNote(
                            itemDef(progress.equipped.weapon).weapon ?? "sword",
                            weapon,
                        )}
                    </Text>
                )}
            </Text>
        );
    }
    if (pick.worn === "weapon")
        return (
            <Text className="text-xs opacity-70">
                Equip another weapon from the bag to swap it.
            </Text>
        );
    const slot = pick.worn;
    return (
        <Button
            className={button}
            onPress={() => {
                unequip(slot);
                onDone();
            }}
        >
            Take off
        </Button>
    );
}
