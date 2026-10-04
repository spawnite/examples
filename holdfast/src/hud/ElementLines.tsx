import type { Entity } from "koota";
import { useQuery, useTrait } from "koota/react";
import { useEffect, useRef, useState } from "react";
import {
    AuthorityTrait,
    Bar,
    createStore,
    HeroTrait,
    Hud,
    Panel,
    PanelVariant,
    PlayerNameTrait,
    Slot,
    Text,
} from "@spawnite/engine";
import { playSound, Sound } from "../audio/sounds";
import { Element, isElement, levelPoints, topLevel } from "../siege/elements";
import { WardenElementsTrait, WardenTrait } from "../siege/traits";
import { elementClasses } from "../views/palette";
import { flightTargetClasses } from "./cardFlight";
import { ElementBadge, levelNumerals, readLevelWords } from "./ElementArt";
import { hudDisplay, hudLabel, topOrder } from "./look";

//  Element lines: a bar for each element a warden holds, which her element
//  cards fill toward its second level and its capstone, and the calls as
//  she reaches one. Each bar is the meter named "<element> line", which
//  lights and pops the points a card added a beat after she takes it.

/** Each element's bar fill, written whole because Tailwind emits only the
 *  classes it reads: the bar reads the palette's health fill. */
const lineFills: Record<Element, string> = {
    [Element.Storm]: "[--color-health-fill:#ffe45c]",
    [Element.Ember]: "[--color-health-fill:#ff6a2b]",
    [Element.Frost]: "[--color-health-fill:#8fd8ff]",
};

/** The screen's light as each element's capstone lands, and the rays
 *  behind its badge, written whole for Tailwind. */
const capstoneLooks: Record<Element, { flash: string; rays: string }> = {
    [Element.Storm]: {
        flash: "bg-[radial-gradient(ellipse_at_center,rgb(255_228_92/0.42),rgb(255_228_92/0.1)_45%,transparent_75%)]",
        rays: "bg-[repeating-conic-gradient(rgb(255_228_92/0.5)_0deg_6deg,transparent_6deg_22deg)]",
    },
    [Element.Ember]: {
        flash: "bg-[radial-gradient(ellipse_at_center,rgb(255_106_43/0.42),rgb(255_106_43/0.1)_45%,transparent_75%)]",
        rays: "bg-[repeating-conic-gradient(rgb(255_106_43/0.5)_0deg_6deg,transparent_6deg_22deg)]",
    },
    [Element.Frost]: {
        flash: "bg-[radial-gradient(ellipse_at_center,rgb(143_216_255/0.42),rgb(143_216_255/0.1)_45%,transparent_75%)]",
        rays: "bg-[repeating-conic-gradient(rgb(143_216_255/0.5)_0deg_6deg,transparent_6deg_22deg)]",
    },
};

/** Each element's capstone sound, which its capstone lands to. */
const capstoneSounds: Record<Element, Sound> = {
    [Element.Storm]: Sound.Thunderhead,
    [Element.Ember]: Sound.Meltdown,
    [Element.Frost]: Sound.Shatter,
};

/** An element's name: its first level's. */
function readName(element: Element) {
    return readLevelWords(element, 1)?.title ?? "";
}

/** Counts the times `points` rose, so each gain keys its own light, and
 *  the points the last one added. */
function useGains(points: number) {
    const [seen, setSeen] = useState({ points, gains: 0, added: 0 });
    //  Adjusted while rendering, as React's docs do for state that follows
    //  a prop, so the light lands in the same frame as the fill.
    if (seen.points !== points)
        setSeen(
            points > seen.points
                ? {
                      points,
                      gains: seen.gains + 1,
                      added: points - seen.points,
                  }
                : { ...seen, points },
        );
    return seen;
}

interface LineProps {
    element: Element;
    level: number;
    points: number;
}

interface LineLayout {
    /** Whether it stands beside another line, half the panel wide, with
     *  its element's name for its level's and its points for the next
     *  level. */
    narrow: boolean;
}

/** One element's line: its badge, its level's name and numeral, the next
 *  level and the points to it, and a bar of the line's points with a
 *  seam at each and a notch at the second level. */
function Line({ element, level, points, narrow }: LineProps & LineLayout) {
    const classes = elementClasses[element];
    const most = levelPoints[topLevel];
    const next = level < topLevel ? level + 1 : undefined;
    const { gains, added } = useGains(points);
    //  Beside another line there is room for the points alone.
    const ahead = (
        <Text className="text-[11px] leading-none font-semibold whitespace-nowrap text-white/60">
            {!next
                ? narrow
                    ? null
                    : "Capstone"
                : narrow
                  ? `${points}/${most}`
                  : `${readLevelWords(element, next)?.title} in ${levelPoints[next] - points}`}
        </Text>
    );
    return (
        <Text
            as="div"
            className={`flex min-w-0 flex-col gap-1 ${flightTargetClasses[element]}`}
        >
            <Text as="div" className="flex items-center justify-between gap-2">
                <Text
                    as="span"
                    className={`flex items-center gap-1.5 ${classes.text}`}
                >
                    <ElementBadge element={element} className="size-4" />
                    <Text
                        //  A new element for each level, so a level gained
                        //  bumps its name.
                        key={level}
                        className={`${hudDisplay} inline-block animate-hud-bump text-base whitespace-nowrap uppercase`}
                    >
                        {narrow
                            ? readName(element)
                            : readLevelWords(element, level)?.title}
                    </Text>
                    <Text className={`${hudDisplay} text-sm opacity-75`}>
                        {levelNumerals[level]}
                    </Text>
                </Text>
                {ahead}
            </Text>
            <Text as="div" className={`relative ${lineFills[element]}`}>
                <Bar
                    label={`${readName(element)} line`}
                    value={points}
                    maximum={most}
                    className="h-3 w-full rounded-sm bg-black/55 ring-1 ring-white/10"
                />
                {/*  A seam between each two points, and the second level's
                    notch, so the bar reads as points to fill. */}
                <Text
                    as="div"
                    className="pointer-events-none absolute inset-0 flex"
                >
                    {Array.from({ length: most }, (_, point) => (
                        <Text
                            as="span"
                            key={point}
                            className={`h-full flex-1 ${point === levelPoints[2] ? "border-l-2 border-white/80" : point > 0 ? "border-l border-black/60" : ""}`}
                        >
                            {null}
                        </Text>
                    ))}
                </Text>
                {gains > 0 && (
                    <Text
                        as="div"
                        key={gains}
                        className="pointer-events-none absolute -inset-0.5 animate-line-gain rounded-sm bg-white/70 shadow-[0_0_14px_rgb(255_255_255/0.8)]"
                    >
                        {null}
                    </Text>
                )}
                {gains > 0 && (
                    <Text
                        key={`added-${gains}`}
                        className={`${hudDisplay} pointer-events-none absolute inset-x-0 -top-2 animate-line-added text-center text-2xl ${classes.text} ${classes.glow}`}
                    >
                        {`+${added}`}
                    </Text>
                )}
            </Text>
        </Text>
    );
}

interface ElementLinesProps {
    entity: Entity;
}

/** A warden's lines, first then second: one for each element she holds,
 *  two side by side, so the panel keeps within its corner. */
export function ElementLines({ entity }: ElementLinesProps) {
    const held = useTrait(entity, WardenElementsTrait);
    if (!held) return null;
    const lines: LineProps[] = [];
    if (isElement(held.first))
        lines.push({
            element: held.first,
            level: held.firstLevel,
            points: held.firstPoints,
        });
    if (isElement(held.second))
        lines.push({
            element: held.second,
            level: held.secondLevel,
            points: held.secondPoints,
        });
    if (lines.length === 0) return null;
    return (
        <Text
            as="div"
            className={
                lines.length > 1 ? "grid grid-cols-2 gap-4" : "flex flex-col"
            }
        >
            {lines.map((line) => (
                <Line key={line.element} {...line} narrow={lines.length > 1} />
            ))}
        </Text>
    );
}

/** A level a warden reached: her own, or a teammate's capstone. */
interface LineCall {
    id: number;
    element: Element;
    level: number;
    /** A teammate's name; none for her own. */
    teammate?: string;
}

/** Milliseconds each call stays up: her second level, her capstone's
 *  ceremony, and a teammate's capstone. Each matches its animation in
 *  styles.css. */
const callMilliseconds = { level: 2600, capstone: 4200, teammate: 2600 };

interface LineCallsState {
    calls: LineCall[];
    nextId: number;
}

const useLineCalls = createStore<LineCallsState>()(() => ({
    calls: [],
    nextId: 0,
}));

/** Puts `call` up, and takes it down once its time is over. */
function callLevel(call: Omit<LineCall, "id">) {
    const id = useLineCalls.getState().nextId;
    useLineCalls.setState(({ calls }) => ({
        calls: [...calls, { ...call, id }],
        nextId: id + 1,
    }));
    const milliseconds = call.teammate
        ? callMilliseconds.teammate
        : call.level >= topLevel
          ? callMilliseconds.capstone
          : callMilliseconds.level;
    setTimeout(
        () =>
            useLineCalls.setState(({ calls }) => ({
                calls: calls.filter((kept) => kept.id !== id),
            })),
        milliseconds,
    );
}

interface LineWatchProps {
    entity: Entity;
}

/** Calls each level a warden reaches past her first: every one of her
 *  own, and a teammate's capstone. Levels she held as the page opened,
 *  and a new run's, call nothing. */
function LineWatch({ entity }: LineWatchProps) {
    const held = useTrait(entity, WardenElementsTrait);
    const player = useTrait(entity, PlayerNameTrait);
    const first = held?.first ?? "";
    const second = held?.second ?? "";
    const firstLevel = held?.firstLevel ?? 0;
    const secondLevel = held?.secondLevel ?? 0;
    const wasRef = useRef({ first, second, firstLevel, secondLevel });
    useEffect(() => {
        const was = wasRef.current;
        wasRef.current = { first, second, firstLevel, secondLevel };
        const own = entity.has(HeroTrait) && entity.has(AuthorityTrait);
        const reached = [
            {
                element: first,
                level: firstLevel,
                before: was.first === first ? was.firstLevel : 0,
            },
            {
                element: second,
                level: secondLevel,
                before: was.second === second ? was.secondLevel : 0,
            },
        ];
        for (const { element, level, before } of reached) {
            if (!isElement(element) || level <= before || level < 2) continue;
            if (own) {
                callLevel({ element, level });
                if (level >= topLevel) {
                    playSound(capstoneSounds[element]);
                    playSound(Sound.Dawn, { volume: 0.7 });
                } else playSound(Sound.WaveHeld);
            } else if (level >= topLevel) {
                callLevel({
                    element,
                    level,
                    teammate: player?.name ?? "A warden",
                });
                playSound(capstoneSounds[element], { volume: 0.5 });
            }
        }
    }, [entity, first, second, firstLevel, secondLevel, player]);
    return null;
}

interface CallProps {
    call: LineCall;
}

/** Her capstone's ceremony: the screen lit in its colour, rays turning
 *  behind its badge, and its name slammed in over what it does. */
function Capstone({ call: { element } }: CallProps) {
    const classes = elementClasses[element];
    const look = capstoneLooks[element];
    const words = readLevelWords(element, topLevel);
    return (
        <>
            <Text
                as="div"
                className={`pointer-events-none fixed inset-0 animate-capstone-flash ${look.flash}`}
            >
                {null}
            </Text>
            <Text
                as="div"
                aria-label="Capstone"
                className="flex animate-capstone flex-col items-center gap-2"
            >
                <Text
                    as="div"
                    className={`relative flex size-24 items-center justify-center ${classes.text}`}
                >
                    <Text
                        as="div"
                        className={`absolute -inset-24 animate-capstone-rays rounded-full [mask-image:radial-gradient(circle,black_18%,transparent_68%)] ${look.rays}`}
                    >
                        {null}
                    </Text>
                    <ElementBadge
                        element={element}
                        className="relative size-20 drop-shadow-[0_0_24px_currentColor]"
                    />
                </Text>
                <Text className={`${hudLabel} text-sm text-white/80`}>
                    {`${readName(element)} ${levelNumerals[topLevel]}, capstone`}
                </Text>
                <Text
                    className={`${hudDisplay} text-7xl whitespace-nowrap uppercase ${classes.text} ${classes.glow}`}
                >
                    {words?.title}
                </Text>
                <Text
                    as="div"
                    className="h-0.5 w-80 animate-hud-sweep bg-linear-to-r from-transparent via-current to-transparent"
                >
                    {null}
                </Text>
                <Text className="max-w-md text-center text-base font-medium text-white/90">
                    {words?.line}
                </Text>
            </Text>
        </>
    );
}

/** Her second level's call: its name over what it does. */
function LevelCall({ call: { element, level } }: CallProps) {
    const classes = elementClasses[element];
    const words = readLevelWords(element, level);
    return (
        <Text
            as="div"
            className="flex animate-line-call flex-col items-center gap-1"
        >
            <Text className={`${hudLabel} text-sm text-white/80`}>
                {`${readName(element)} ${levelNumerals[level]}`}
            </Text>
            <Text
                className={`${hudDisplay} text-5xl whitespace-nowrap uppercase ${classes.text} ${classes.glow}`}
            >
                {words?.title}
            </Text>
            <Text className="text-sm font-medium text-white/85">
                {words?.line}
            </Text>
        </Text>
    );
}

/** A teammate's capstone, in a line. */
function TeammateCall({ call: { element, teammate } }: CallProps) {
    const classes = elementClasses[element];
    return (
        <Text
            as="div"
            className="flex animate-line-call items-center gap-2 rounded-lg bg-black/45 px-3 py-1.5"
        >
            <ElementBadge
                element={element}
                className={`size-5 ${classes.text}`}
            />
            <Text
                className={`${hudDisplay} text-2xl uppercase ${classes.text}`}
            >
                {`${teammate} reached ${readLevelWords(element, topLevel)?.title}`}
            </Text>
        </Text>
    );
}

/** The calls of the levels the wardens reach: her own level 2 under the
 *  calls at the top, her capstone as its ceremony over the screen's
 *  middle, and a teammate's capstone at the top. */
export function LineCalls() {
    const wardens = useQuery(WardenTrait, WardenElementsTrait);
    const calls = useLineCalls((state) => state.calls);
    const own = calls.filter((call) => !call.teammate);
    const teammates = calls.filter((call) => call.teammate);
    const latest = own.at(-1);
    return (
        <>
            {wardens.map((entity) => (
                <LineWatch key={entity} entity={entity} />
            ))}
            {latest && latest.level >= topLevel && (
                <Hud>
                    {/*  Over the screen's middle, as its ceremony, below the
                        banner. */}
                    <Panel
                        slot={Slot.Center}
                        variant={PanelVariant.Bare}
                        className="mb-[8vh]"
                    >
                        <Capstone key={latest.id} call={latest} />
                    </Panel>
                </Hud>
            )}
            {latest && latest.level < topLevel && (
                <Hud>
                    {/*  With the calls under the banner, clear of the aim,
                        which keeps the middle of the screen. */}
                    <Panel
                        slot={Slot.Top}
                        order={topOrder.level}
                        variant={PanelVariant.Bare}
                        className="mt-1"
                    >
                        <LevelCall key={latest.id} call={latest} />
                    </Panel>
                </Hud>
            )}
            {teammates.length > 0 && (
                <Hud>
                    <Panel
                        slot={Slot.Top}
                        variant={PanelVariant.Bare}
                        className="mt-24 gap-1.5"
                    >
                        {teammates.map((call) => (
                            <TeammateCall key={call.id} call={call} />
                        ))}
                    </Panel>
                </Hud>
            )}
        </>
    );
}
