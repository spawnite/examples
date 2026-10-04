import { useEffect, useRef, useState, type ReactNode } from "react";
import {
    Bar,
    Button,
    Hud,
    Icon,
    Modal,
    Panel,
    PanelVariant,
    QualityLevel,
    listenToAction,
    Slot,
    Text,
    usePlayer,
    useScenes,
    Window,
} from "@spawnite/engine";
import { useBattle } from "../combat/battle";
import {
    deriveHero,
    dodgeStamina,
    spendPoint,
    statHints,
    statNames,
    statTitles,
    useProgress,
    xpToNext,
} from "../hero/progress";
import { useCompact, usePortrait, useTouch } from "../view/device";
import {
    detailNames,
    graphicsLevels,
    useDetail,
    useGraphicsLevel,
    useNextGraphicsLevel,
} from "../view/graphics";
import {
    heroClasses,
    heroClassName,
    jobLevels,
    skillPointsLeft,
} from "../hero/jobs";
import { BagWindow } from "./BagWindow";
import { ClassEditor } from "./ClassEditor";
import { SkillWindow } from "./SkillWindow";
import { GmWindow } from "./GmWindow";
import { BossHud } from "./BossHud";
import { CatPaw, glass } from "./CatPaw";
import { Minimap } from "./Minimap";
import { useTravel } from "../view/Waystone";
import { useTown } from "../town/folk";
import { closeWindow, toggleWindow, useWindows, windowKeys } from "./windows";
import { hudPlugin } from "./hud.plugin";

/** The hunt's screen: her level, health and experience in a corner; the
 *  potion and the menu, which opens the bag and the stats, in another;
 *  those windows; a banner on each level up; and the defeat. One Hud that
 *  never re-renders, with every change in the screen inside it: the
 *  engine's context bridge keeps what it carried over on the Hud's first
 *  render, and a Hud re-rendered later can lose a context its new buttons
 *  read. */
/** The place's own lines in the menu, given what closes it. */
export type TownMenuLines = (close: () => void) => ReactNode;

export function HeroHud({
    town = false,
    menu,
    children,
}: {
    /** In town: no minimap, boss or defeat, and nothing until she is
     *  made, nor while her look is changed. */
    town?: boolean;
    /** The place's own lines in the menu, over the bag's, given what
     *  closes the menu, which each line calls as it is pressed. */
    menu?: TownMenuLines;
    /** The place's own screen, in the same Hud. */
    children?: ReactNode;
}) {
    return (
        <Hud>
            <HeroScreen town={town} menu={menu} />
            {children}
        </Hud>
    );
}

function HeroScreen({ town, menu }: { town: boolean; menu?: TownMenuLines }) {
    useWindowKeys();
    const created = useProgress((state) => state.created);
    //  Nothing over the character creator, while she is made or her look
    //  changed: on a phone the paw would stand over its Done.
    const editingLook = useTown((state) => state.editingLook);
    if (town && (!created || editingLook)) return null;

    return (
        <>
            <Vitals />
            {!town && <Minimap />}
            <MenuBar town={town} menu={menu} />
            <StatWindow />
            <BagWindow />
            <SkillWindow />
            <GmWindow />
            <ClassEditor />
            <LevelUpBanner />
            {!town && <BossHud />}
            {!town && <Defeat />}
        </>
    );
}

/** C, I, K and G open and close their windows: on a phone, one at a
 *  time. */
function useWindowKeys() {
    const compact = useCompact();
    useEffect(() => {
        //  The engine takes no key a field owns, as the GM tools' are.
        const { stats, bag, skills, gm } = hudPlugin.actions;
        const stops = [
            listenToAction(stats, {
                onPress: () => toggleWindow("stats", compact),
            }),
            listenToAction(bag, {
                onPress: () => toggleWindow("bag", compact),
            }),
            listenToAction(skills, {
                onPress: () => toggleWindow("skills", compact),
            }),
            listenToAction(gm, { onPress: () => toggleWindow("gm", compact) }),
        ];
        return () => {
            for (const stop of stops) stop();
        };
    }, [compact]);
}

/** A row: its parts side by side, spread to the window's edges. */
function Row({ children }: { children: ReactNode }) {
    return (
        <Text as="div" className="flex items-center justify-between gap-3">
            {children}
        </Text>
    );
}

/** Her level, and her health and experience as bars: small, in the top
 *  left corner, so a phone's screen stays the fight's. */
function Vitals() {
    const { health, maximumHealth } = usePlayer();
    const level = useProgress((state) => state.level);
    const xp = useProgress((state) => state.xp);
    const defeated = useBattle((state) => state.defeated);
    const shown = defeated ? 0 : Math.ceil(health);

    return (
        <Panel slot={Slot.TopLeft} className="px-2.5 py-2">
            <Text
                as="div"
                className="flex items-center gap-2 whitespace-nowrap"
            >
                <Text size="sm" className="font-bold">
                    Lv {level}
                </Text>
                <Text as="div" className="flex flex-col gap-1">
                    <Bar
                        label="Health"
                        value={shown}
                        maximum={maximumHealth}
                        className="h-2.5 w-28 sm:w-44"
                    />
                    <Bar
                        label="Experience"
                        value={xp}
                        maximum={xpToNext(level)}
                        className="h-1.5 w-28 sm:w-44"
                    />
                </Text>
                <Text size="xs" className="tabular-nums">
                    {shown}/{maximumHealth}
                </Text>
            </Text>
        </Panel>
    );
}

/** The potion, and the menu: one button that opens into the bag and the
 *  stats, marked with the count of stat points waiting to be spent. On a
 *  keyboard each names its key. */
/** The menu, and in the wilds the way home: its button, or her stepping
 *  onto the waystone. */
function MenuBar({ town, menu }: { town: boolean; menu?: TownMenuLines }) {
    const scenes = useScenes();
    const home = useTravel((state) => state.home);
    const go = useRef(scenes.go);
    go.current = scenes.go;
    useEffect(() => {
        if (home && !town) go.current("lobby");
    }, [home, town]);
    const points = useProgress((state) => state.points);
    //  Skill points count once she has a tree to spend them in.
    const skillPoints = useProgress((state) =>
        heroClasses(state).length > 0 ? skillPointsLeft(state) : 0,
    );
    const compact = useCompact();
    const touch = useTouch();
    const [open, setOpen] = useState(false);
    const key = (letter: string) => (touch ? "" : ` (${letter.toUpperCase()})`);
    const show = (name: "bag" | "stats" | "gm" | "skills") => {
        toggleWindow(name, compact);
        setOpen(false);
    };
    const portrait = usePortrait();
    const waiting = points + skillPoints;
    const menuLabel = open
        ? "Close the menu"
        : waiting > 0
          ? `Menu: ${[points > 0 && `${points} stat points`, skillPoints > 0 && `${skillPoints} skill points`].filter(Boolean).join(" and ")} to spend`
          : "Menu";
    const badge = waiting > 0 && !open && (
        <Text className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-bold text-black">
            {waiting}
        </Text>
    );

    //  The menu's lines, over its button.
    const lines = (
        <>
            <GraphicsButton />
            {menu?.(() => setOpen(false))}
            {!town && (
                <Button onPress={() => scenes.go("lobby")}>
                    <Icon name="house" className="size-5" />
                    Return to town
                </Button>
            )}
            <Button
                label={`Bag${key(windowKeys.bag)}`}
                onPress={() => show("bag")}
            >
                Bag{key(windowKeys.bag)}
            </Button>
            <Button
                label={`Character${key(windowKeys.stats)}`}
                onPress={() => show("stats")}
            >
                {points > 0 && <Icon name="star" className="size-5" />}
                Character{key(windowKeys.stats)}
            </Button>
            <Button
                label={`Skills${key(windowKeys.skills)}`}
                onPress={() => show("skills")}
            >
                {skillPoints > 0 && <Icon name="star" className="size-5" />}
                Skills{key(windowKeys.skills)}
            </Button>
            {/*  The creator's tools for testing. */}
            <Button
                label={`GM tools${key(windowKeys.gm)}`}
                onPress={() => show("gm")}
            >
                <Icon name="key" className="size-5" />
                GM tools{key(windowKeys.gm)}
            </Button>
        </>
    );
    const menuButton = (
        <Button
            label={menuLabel}
            onPress={() => setOpen(!open)}
            className="relative"
        >
            <Icon name={open ? "x" : "menu"} className="size-5" />
            {badge}
        </Button>
    );
    //  With a mouse, the menu stands bottom left, apart from the paw; on a
    //  touch screen held sideways the floating stick takes the left half,
    //  so the menu stays under the paw, and upright it is the paw's centre.
    const menuApart = !touch && !portrait;

    return (
        <>
            {menuApart && (
                <Panel slot={Slot.BottomLeft} variant={PanelVariant.Bare}>
                    {open && (
                        <Text
                            as="div"
                            className="flex flex-col items-start gap-2"
                        >
                            {lines}
                        </Text>
                    )}
                    {menuButton}
                </Panel>
            )}
            <Panel slot={Slot.BottomRight} variant={PanelVariant.Bare}>
                {!menuApart && open && (
                    <Text as="div" className="flex flex-col items-end gap-2">
                        {lines}
                    </Text>
                )}
                {/*  The paw: the dodge and the slots for her potions and
                     skills, over the menu; upright on a phone, round the
                     menu, where a swipe dodges. Q still drinks a potion. */}
                {portrait ? (
                    <CatPaw
                        center={
                            <Button
                                label={menuLabel}
                                onPress={() => setOpen(!open)}
                                className={`${glass} relative flex size-full items-center justify-center outline-none active:scale-95`}
                            >
                                <Icon
                                    name={open ? "x" : "menu"}
                                    className="size-6"
                                />
                                {badge}
                            </Button>
                        }
                    />
                ) : (
                    <>
                        <CatPaw />
                        {!menuApart && menuButton}
                    </>
                )}
            </Panel>
        </>
    );
}

/** The graphics level, stepped on each press. Auto names the level it
 *  chose. */
function GraphicsButton() {
    const level = useGraphicsLevel();
    const detail = useDetail();
    const next = useNextGraphicsLevel();
    const shown =
        level === "custom"
            ? "Custom"
            : level === QualityLevel.Auto
              ? `Auto (${detailNames[detail]})`
              : (graphicsLevels.find((each) => each.level === level)?.name ??
                detailNames[detail]);

    return (
        <Button label={`Graphics: ${shown}`} onPress={next}>
            <Icon name="settings" className="size-5" />
            <Text as="span" className="whitespace-nowrap">
                {shown}
            </Text>
        </Button>
    );
}

/** The character window, as an MMO's: who she is, her level and
 *  experience and health; her attributes, each with what her gear adds and
 *  a + while points are left; and what they make of her in a fight. The
 *  two sides stand together on a wide screen and one over the other on a
 *  phone held upright. */
function StatWindow() {
    const progress = useProgress();
    const open = useWindows((state) => state.stats);
    const compact = useCompact();
    const portrait = usePortrait();
    const { health, maximumHealth } = usePlayer();
    if (!open) return null;
    const { points, stats, level, xp } = progress;
    const derived = deriveHero(progress);
    const close = () => closeWindow("stats");
    const needed = xpToNext(level);
    const sword = derived.weapon === "sword";
    const box = "flex flex-col gap-1 rounded-xl bg-black/30 p-2.5";

    const combat: [string, string][] = [
        [
            "Attack",
            derived.offStrike
                ? `${Math.round(derived.damage)} ${derived.weapon} · ${Math.round(derived.offStrike.damage)} ${derived.offWeapon}`
                : `${Math.round(derived.damage)}`,
        ],
        ["Defense", `${derived.armor}`],
        ["Max HP", `${derived.maxHealth}`],
        ["Critical rate", `${Math.round(derived.critChance * 100)}%`],
        ["Critical damage", `${Math.round(derived.critDamage * 100)}%`],
        [
            "Stamina",
            `${derived.maxStamina} · ${Math.floor(derived.maxStamina / dodgeStamina)} dodges`,
        ],
        [
            "Stamina recovery",
            `${Math.round(derived.staminaRecovery * 10) / 10}/s`,
        ],
        [
            "Attack speed",
            derived.offStrike
                ? `${derived.attacksPerSecond.toFixed(2)} · ${derived.offStrike.attacksPerSecond.toFixed(2)}/s`
                : `${derived.attacksPerSecond.toFixed(2)}/s`,
        ],
        ["Move speed", `${derived.moveSpeed.toFixed(1)} m/s`],
    ];

    const body = (
        <Text as="div" className="flex w-full flex-col gap-1.5">
            <Row>
                <Text as="div" className="flex flex-col">
                    <Text size="base" className="font-bold">
                        {heroClassName(progress)}
                    </Text>
                    <Text size="xs" className="opacity-60">
                        {derived.offWeapon
                            ? "Sword & crossbow"
                            : sword
                              ? derived.dual
                                  ? "Two swords"
                                  : "Sword & shield"
                              : derived.dual
                                ? "Two crossbows"
                                : "Crossbow"}
                    </Text>
                </Text>
                <Text as="div" className="flex items-baseline gap-1">
                    <Text size="xs" className="opacity-60">
                        Lv
                    </Text>
                    <Text size="xl" className="font-bold text-amber-400">
                        {level}
                    </Text>
                </Text>
            </Row>
            <Row>
                <Text size="xs">
                    <Text className="opacity-60">EXP </Text>
                    {xp} / {needed}
                </Text>
                <Text size="xs" className="text-lime-300">
                    {((xp / needed) * 100).toFixed(2)}%
                </Text>
            </Row>
            <Bar
                label="Experience"
                value={xp}
                maximum={needed}
                className="h-1.5 w-full"
            />
            <Text size="xs">
                <Text className="opacity-60">HP </Text>
                {Math.ceil(health)} / {maximumHealth}
            </Text>
            <Bar
                label="Health"
                value={health}
                maximum={maximumHealth}
                className="h-2 w-full"
            />
            <Text
                as="div"
                className={`grid w-full gap-2 ${portrait && compact ? "grid-cols-1" : "grid-cols-2"}`}
            >
                <Text as="div" className={box}>
                    <Row>
                        <Text size="xs" className="font-bold">
                            Attributes
                        </Text>
                        <Text
                            size="xs"
                            className={
                                points > 0 ? "text-amber-300" : "opacity-60"
                            }
                        >
                            Points {points}
                        </Text>
                    </Row>
                    {statNames.map((stat) => {
                        const extra = derived.stats[stat] - stats[stat];
                        return (
                            <Text
                                as="div"
                                key={stat}
                                className="grid grid-cols-[1fr_auto_2.2rem] items-center gap-2"
                                title={statHints[stat]}
                            >
                                <Text>{statTitles[stat]}</Text>
                                <Text className="text-right font-bold tabular-nums">
                                    {stats[stat]}
                                    {extra > 0 && (
                                        <Text className="ml-1 font-normal text-lime-400">
                                            +{extra}
                                        </Text>
                                    )}
                                </Text>
                                {points > 0 ? (
                                    <Button
                                        label={`Add a point to ${statTitles[stat]}: ${statHints[stat]}`}
                                        onPress={() => spendPoint(stat)}
                                        className="size-7 min-w-7 rounded-lg px-0 text-sm"
                                    >
                                        +
                                    </Button>
                                ) : null}
                            </Text>
                        );
                    })}
                </Text>
                <Text as="div" className={box}>
                    <Text size="xs" className="font-bold">
                        Combat
                    </Text>
                    {combat.map(([name, value]) => (
                        <Row key={name}>
                            <Text className="whitespace-nowrap">{name}</Text>
                            <Text className="font-bold tabular-nums">
                                {value}
                            </Text>
                        </Row>
                    ))}
                </Text>
            </Text>
        </Text>
    );
    return (
        <Window
            id="stats"
            title="Character"
            open
            onClose={close}
            slot={Slot.Right}
            className={
                portrait && compact ? "w-[min(22rem,100%)]" : "w-[34rem]"
            }
        >
            {body}
        </Window>
    );
}

/** Milliseconds the level up banner stands. */
const bannerMilliseconds = 2500;

function LevelUpBanner() {
    const levelUps = useBattle((state) => state.levelUps);
    const level = useProgress((state) => state.level);
    const [shownFor, setShownFor] = useState(levelUps);

    useEffect(() => {
        if (levelUps === shownFor) return;
        const timer = setTimeout(
            () => setShownFor(levelUps),
            bannerMilliseconds,
        );
        return () => clearTimeout(timer);
    }, [levelUps, shownFor]);

    if (levelUps === shownFor) return null;
    return (
        <Panel slot={Slot.Center} variant={PanelVariant.Bare}>
            <Text size="xl" className="whitespace-nowrap">
                Level up! Level {level}
            </Text>
            <Text className="whitespace-nowrap">
                Health restored · new stat and skill points in the menu
            </Text>
            {jobLevels.includes(level) && (
                <Text className="whitespace-nowrap text-amber-300">
                    A new job awaits: talk to Instructor Vale in town
                </Text>
            )}
        </Panel>
    );
}

function Defeat() {
    const { defeated, xpLost } = useBattle();
    const scenes = useScenes();

    return (
        <Modal open={defeated} title="You fell in battle" pause>
            <Text>
                You wake in town, {xpLost} experience poorer. Your level and
                your gear are safe.
            </Text>
            <Button onPress={() => scenes.go("lobby")}>Wake in town</Button>
        </Modal>
    );
}
