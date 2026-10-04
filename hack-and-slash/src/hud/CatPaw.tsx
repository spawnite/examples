import { useEffect, useRef, type ReactNode } from "react";
import { useWorld } from "koota/react";
import {
    Button,
    Draggable,
    DropTarget,
    findPlayerHero,
    Icon,
    Image,
    listenToAction,
    Text,
} from "@spawnite/engine";
import { hudPlugin } from "./hud.plugin";
import { askForDodge, askForPotion, askForSkill } from "../combat/aim";
import { skillCooldownLeft } from "../combat/systems";
import { HeroCombatTrait } from "../combat/traits";
import {
    deriveHero,
    setQuickSlot,
    useProgress,
    type QuickSlot,
} from "../hero/progress";
import { itemDef, itemTitle } from "../items/items";
import { usePortrait, useTouch } from "../view/device";
import { isItem, isQuickSlot, quickUrl, skillName } from "./pictures";
import { QuickSlotPicture } from "./QuickSlotPicture";

//  The cat paw, as mobile action games lay out their buttons: a large
//  round button in the bottom right corner, the dodge, with four smaller
//  round slots fanned in an arc round it, each a place for a potion or a
//  skill dragged onto it from the bag. A tap on a slot uses what stands on
//  it, as the keys 1 to 4 do; a skill's slot darkens as its cooldown runs
//  down; a slot dragged off the paw is cleared. Upright on a phone, where
//  a swipe dodges, the large button is the menu's, and the slots larger.

/** The paw's size, in rems: the large button's and a slot's width, and
 *  the gap between two slots, wide or upright. */
const sizes = {
    wide: { big: 4.6, slot: 3.1, gap: 0.45 },
    upright: { big: 4.2, slot: 3.5, gap: 0.55 },
};
/** Each slot's angle round the large button, in degrees from pointing
 *  left, fanned up over it to pointing up. */
const angles = [0, 30, 60, 90];

/** The house glass, smoked dark, round. */
export const glass =
    "rounded-full border-2 border-pane-edge bg-pane-surface bg-linear-to-b from-pane-sheen to-pane-sheen-end backdrop-blur-(--blur-pane) shadow-lg shadow-black/40 text-pane-ink";

/** Uses what stands on a slot. */
function pressSlot(what: QuickSlot | null) {
    if (!what) return;
    if (!isItem(what)) askForSkill(what);
    else if (itemDef(what).heal !== undefined) askForPotion();
}

/** The paw; `center`, upright on a phone, the large button in place of
 *  the dodge. */
export function CatPaw({ center }: { center?: ReactNode }) {
    const slots = useProgress((state) => state.quickSlots);
    const bag = useProgress((state) => state.bag);
    const skills = useProgress((state) => deriveHero(state).skills);
    const touch = useTouch();
    const portrait = usePortrait();
    const world = useWorld();
    const shades = useRef<(HTMLDivElement | null)[]>([]);

    //  The keys 1 to 4, as the slots.
    useEffect(() => {
        const { slot1, slot2, slot3, slot4 } = hudPlugin.actions;
        const stops = [slot1, slot2, slot3, slot4].map((action, index) =>
            listenToAction(action, {
                onPress: () =>
                    pressSlot(useProgress.getState().quickSlots[index] ?? null),
            }),
        );
        return () => {
            for (const stop of stops) stop();
        };
    }, []);

    //  Each skill's cooldown, written straight into its slot's shade.
    useEffect(() => {
        let request = 0;
        const draw = () => {
            request = requestAnimationFrame(draw);
            const combat = findPlayerHero(world)?.get(HeroCombatTrait);
            const slots = useProgress.getState().quickSlots;
            shades.current.forEach((shade, index) => {
                if (!shade) return;
                const what = slots[index];
                const left =
                    what && !isItem(what) && combat
                        ? skillCooldownLeft(what, combat.spinCooldown)
                        : 0;
                shade.style.background =
                    left > 0
                        ? `conic-gradient(rgb(0 0 0 / 0.65) ${left * 360}deg, transparent 0)`
                        : "none";
            });
        };
        request = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(request);
    }, [world]);

    const countOf = (what: QuickSlot) =>
        bag
            .filter((entry) => entry.item === what)
            .reduce((total, entry) => total + entry.count, 0);

    const {
        big: bigSize,
        slot: slotSize,
        gap,
    } = portrait ? sizes.upright : sizes.wide;
    //  Far enough out that the slots, a twelfth of a turn apart, keep
    //  their gap; the large button's middle, from the paw's bottom right.
    const reach = (slotSize + gap) / (2 * Math.sin(Math.PI / 12));
    const middle = bigSize / 2;
    const width = middle + reach + slotSize / 2;

    return (
        <Text
            as="div"
            className="pointer-events-auto relative select-none"
            style={{ width: `${width}rem`, height: `${width}rem` }}
        >
            {center ? (
                <Text
                    as="div"
                    className="absolute"
                    style={{
                        right: 0,
                        bottom: 0,
                        width: `${bigSize}rem`,
                        height: `${bigSize}rem`,
                    }}
                >
                    {center}
                </Text>
            ) : (
                !portrait && (
                    <Button
                        label={`Dodge${touch ? "" : " (Space)"}`}
                        onPress={() => askForDodge()}
                        className={`${glass} absolute outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95`}
                        classNames={{ icon: "flex-col items-center" }}
                        style={{
                            right: 0,
                            bottom: 0,
                            width: `${bigSize}rem`,
                            height: `${bigSize}rem`,
                        }}
                    >
                        <Icon name="zap" className="size-7" />
                        <Text className="text-[0.65rem] leading-none font-semibold">
                            {touch ? "Dodge" : "Space"}
                        </Text>
                    </Button>
                )
            )}
            {angles.map((angle, index) => {
                const what = slots[index] ?? null;
                //  A skill her gear no longer gives stands faded, as does a
                //  potion she has none of.
                const lost = !!what && !isItem(what) && !skills.includes(what);
                const count = what && isItem(what) ? countOf(what) : 0;
                const faded = lost || (!!what && isItem(what) && count === 0);
                const name = what
                    ? isItem(what)
                        ? itemTitle(what)
                        : skillName(what)
                    : "Empty";
                const radians = (angle * Math.PI) / 180;
                const right = middle + Math.cos(radians) * reach - slotSize / 2;
                const bottom =
                    middle + Math.sin(radians) * reach - slotSize / 2;
                return (
                    <DropTarget
                        key={index}
                        accepts={isQuickSlot}
                        onDrop={(dropped) => setQuickSlot(index, dropped)}
                        className="absolute"
                        style={{
                            right: `${right}rem`,
                            bottom: `${bottom}rem`,
                            width: `${slotSize}rem`,
                            height: `${slotSize}rem`,
                        }}
                    >
                        <Draggable
                            data={what}
                            disabled={!what}
                            preview={what && <QuickSlotPicture what={what} />}
                            onDragEnd={({ dropped, canceled }) => {
                                //  Dragged off the paw: the pad is cleared.
                                if (!dropped && !canceled)
                                    setQuickSlot(index, null);
                            }}
                            className="size-full"
                        >
                            <Button
                                label={`Slot ${index + 1}: ${name}${count ? `, ${count} left` : ""}`}
                                onPress={() => pressSlot(what)}
                                className={`${glass} size-full min-w-0 overflow-hidden px-0 outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95`}
                            >
                                {what ? (
                                    <Image
                                        src={quickUrl(what)}
                                        label=""
                                        className={`size-[2.3rem] ${faded ? "opacity-35 grayscale" : ""}`}
                                    />
                                ) : (
                                    // eslint-disable-next-line no-restricted-syntax -- an empty dot, where Text needs words; a gap in the pull request
                                    <span className="size-2 rounded-full bg-white/25" />
                                )}
                                {/* eslint-disable-next-line no-restricted-syntax -- a shade written by ref each frame, which Text does not carry; a gap in the pull request */}
                                <div
                                    ref={(node) => {
                                        shades.current[index] = node;
                                    }}
                                    className="pointer-events-none absolute inset-0 rounded-full"
                                />
                                {what && isItem(what) && (
                                    <Text className="absolute inset-x-0 bottom-0.5 text-center text-[0.7rem] leading-none font-bold [text-shadow:0_1px_1px_black]">
                                        {count}
                                    </Text>
                                )}
                                {!touch && (
                                    <Text className="absolute inset-x-0 top-0.5 text-center text-[0.6rem] leading-none font-bold opacity-70">
                                        {index + 1}
                                    </Text>
                                )}
                            </Button>
                        </Draggable>
                    </DropTarget>
                );
            })}
        </Text>
    );
}
