import { useEffect, useRef, useState } from "react";
import { domAnimation, LazyMotion, m } from "motion/react";
import { gameInsetLengths, Image, type LevelId } from "@spawnite/engine";
import { springs } from "@spawnite/ui";
import { Numeral } from "../components/Numeral";
import { ArrowIcon } from "../icons/ArrowIcon";
import { LockIcon } from "../icons/LockIcon";
import { WorldIcon } from "../icons/WorldIcon";
import { PlayButton } from "./PlayButton";
import { TrackCard, type ShapePoint } from "./TrackCard";
import { BareButton } from "./BareButton";
import { useShake } from "./shake";
import { PinState, TrackPin } from "./TrackPin";
import {
    desertKey,
    readTrackWorld,
    WorldId,
    worlds,
    type MapPoint,
} from "./worlds";

/** One track as the map shows it. */
export interface MapTrack {
    id: LevelId;
    /** Counted from 1. */
    number: number;
    state: PinState;
    /** The best run's coins, none before a finish, and the track's. */
    coins: { best: number; total: number };
    /** The Speed step the track is tuned to finish at. */
    needed: number;
    /** Its centreline from above, start to finish. */
    shape: ShapePoint[];
}

export interface MapSheetProps {
    /** Every track, in the order they unlock. */
    tracks: MapTrack[];
    selected: LevelId;
    onSelect: (track: LevelId) => void;
    /** The player's Speed step. */
    step: number;
    /** Plays the selected track. */
    onPlay: () => void;
    /** Opens raised over the lower half rather than as its tab alone.
     *  @defaultValue `false` */
    defaultRaised?: boolean;
}

/** Pixels a drag on the tab travels before it raises or lowers the
 *  sheet. */
const dragDistance = 24;

/** The raised map's height. */
const mapHeight = "52dvh";

/** The painting's own sky behind it, while it loads. */
const worldSkies: Record<WorldId, string> = {
    [WorldId.Snow]: "bg-[#c8c3e3]",
    [WorldId.Desert]: "bg-[#e9c3b3]",
};

/** A clearing's place on its painting as a style. */
function placeAt(at: MapPoint) {
    return { left: `${at.x * 100}%`, top: `${at.y * 100}%` };
}

/** Where a gate lands on `world`: a later world's trail at its first
 *  track, an earlier one's at its gate, the trail's top. */
function readArrival(world: WorldId): MapPoint {
    const { pins, gate } = worlds[world];
    return world === WorldId.Snow ? gate : pins[0].at;
}

/** The gate at the top of a world's trail: the other world's badge, which
 *  takes the map there. Locked, with a lock, until `open`: till then a
 *  tap shakes it. */
function GatePin({
    to,
    open,
    onPress,
}: {
    to: WorldId;
    open: boolean;
    onPress: () => void;
}) {
    const { scope, shake } = useShake<HTMLDivElement>();
    return (
        <m.div ref={scope} className="relative flex">
            <BareButton
                label={open ? `To the ${to}` : `To the ${to}, locked`}
                onPress={open ? onPress : shake}
                className={`size-12 min-w-12 rounded-full ${open ? "" : "grayscale"}`}
            >
                <WorldIcon
                    world={to}
                    className="size-12 drop-shadow-[0_4px_0_#14213d]"
                />
            </BareButton>
            {!open && (
                <LockIcon className="pointer-events-none absolute -right-2 -bottom-1 size-6" />
            )}
        </m.div>
    );
}

/** The tracks' map in a sheet at the bottom of the lobby. Lowered, it is a
 *  tab: the selected track's number and the large play button. A tap
 *  anywhere on the tab but the play button, or a drag up on it, raises it
 *  over the lower half, where each world's
 *  painted map scrolls, swiped between the snow and the desert, with each
 *  track pinned on its trail's clearings and a gate to the other world at
 *  the top. Tapping a pin selects it and shows its card. */
export function MapSheet({
    tracks,
    selected,
    onSelect,
    step,
    onPlay,
    defaultRaised = false,
}: MapSheetProps) {
    const [raised, setRaised] = useState(defaultRaised);
    const rowRef = useRef<HTMLDivElement>(null);
    const pressRef = useRef<{ x: number; y: number } | null>(null);
    //  A press on a button, which takes its own tap: the tab's takes it by
    //  its press, the play button plays.
    const onButtonRef = useRef(false);
    //  A drag also ends in a click on the tab; this keeps it from toggling
    //  the sheet back.
    const draggedRef = useRef(false);
    const current = tracks.find((track) => track.id === selected) ?? tracks[0];
    const byId = new Map(tracks.map((track) => [track.id, track]));
    const desertOpen = byId.get(desertKey)?.state === PinState.Finished;

    /** Turns the map to `world` and, given a clearing on it, scrolls the
     *  clearing to the middle of the view. */
    const show = (world: WorldId, at?: MapPoint, behavior?: ScrollBehavior) => {
        const panel = rowRef.current?.querySelector<HTMLElement>(
            `[data-map="${world}"]`,
        );
        if (!panel) return;
        //  Only when the world changes: a second smooth scroll on the row
        //  cancels the one on the world's own.
        if (rowRef.current && rowRef.current.scrollLeft !== panel.offsetLeft)
            rowRef.current.scrollTo({ left: panel.offsetLeft, behavior });
        if (at)
            panel.scrollTo({
                top: at.y * panel.scrollHeight - panel.clientHeight / 2,
                behavior,
            });
    };

    //  The raised map keeps the selected pin in the middle of its view.
    useEffect(() => {
        if (!raised) return;
        const world = readTrackWorld(selected);
        show(
            world,
            worlds[world].pins.find((pin) => pin.track === selected)?.at,
            "smooth",
        );
        // eslint-disable-next-line @eslint-react/exhaustive-deps -- `show` reads only refs
    }, [raised, selected]);

    return (
        <LazyMotion features={domAnimation}>
            <m.div className="pointer-events-auto fixed inset-x-0 bottom-0 mx-auto flex max-w-md flex-col">
                <m.div
                    className="relative flex h-20 touch-none items-center gap-3 rounded-t-3xl border-4 border-b-0 border-[#14213d] bg-white px-4"
                    onPointerDown={(event) => {
                        //  A right click opens the page's menu.
                        if (event.button !== 0) return;
                        pressRef.current = {
                            x: event.clientX,
                            y: event.clientY,
                        };
                        draggedRef.current = false;
                        onButtonRef.current =
                            event.target instanceof Element &&
                            event.target.closest("button") !== null;
                    }}
                    onPointerMove={(event) => {
                        const press = pressRef.current;
                        if (
                            press === null ||
                            event.currentTarget.hasPointerCapture(
                                event.pointerId,
                            ) ||
                            Math.hypot(
                                event.clientX - press.x,
                                event.clientY - press.y,
                            ) < dragDistance
                        )
                            return;
                        //  Once the press is a drag, so a drag released past
                        //  the tab still ends here. Not at the press: a
                        //  captured pointer's click lands on the tab, and a
                        //  click on the arrow or on play would do nothing.
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerCancel={() => {
                        pressRef.current = null;
                    }}
                    onPointerUp={(event) => {
                        const press = pressRef.current;
                        if (press === null) return;
                        pressRef.current = null;
                        const down = event.clientY - press.y;
                        const across = event.clientX - press.x;
                        if (Math.abs(down) >= dragDistance) {
                            draggedRef.current = true;
                            setRaised(down < 0);
                        } else if (
                            !onButtonRef.current &&
                            Math.hypot(down, across) < dragDistance
                        )
                            //  A tap on the tab's white beside its buttons.
                            setRaised((up) => !up);
                    }}
                >
                    {/*  The grab bar, which says the tab drags. */}
                    <m.div className="absolute top-2 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-[#14213d]/25" />
                    <BareButton
                        label={raised ? "Hide the map" : "Show the map"}
                        onPress={() => {
                            if (draggedRef.current) draggedRef.current = false;
                            else setRaised((up) => !up);
                        }}
                        className="h-full flex-1 justify-start"
                    >
                        <m.div
                            className={`flex size-12 items-center justify-center rounded-full border-4 border-[#14213d] shadow-[0_4px_0_#14213d] ${current.state === PinState.Finished ? "bg-[#ffc93c]" : "bg-white"}`}
                        >
                            <Numeral className="text-2xl">
                                {current.number}
                            </Numeral>
                        </m.div>
                        {/*  Up while lowered, down while raised. Its own
                             size rather than the row's height, so it turns
                             on the arrow's middle and keeps one gap to the
                             number either way. */}
                        <m.div
                            className="ml-1 flex self-center"
                            initial={false}
                            animate={{ rotate: raised ? 90 : -90 }}
                            transition={springs.snappy}
                        >
                            <ArrowIcon direction="right" className="size-7" />
                        </m.div>
                    </BareButton>
                    {/*  Larger than the tab, so it stands out of its top. */}
                    <m.div className="-mt-10">
                        <PlayButton
                            track={current.number}
                            needed={current.needed}
                            step={step}
                            onPlay={onPlay}
                        />
                    </m.div>
                </m.div>
                <m.div
                    className="overflow-hidden border-x-4 border-[#14213d] bg-white"
                    initial={false}
                    animate={{ height: raised ? "auto" : 0 }}
                    transition={springs.snappy}
                    //  Out of the tab order and the reader's way while
                    //  lowered.
                    inert={!raised}
                >
                    <m.div
                        ref={rowRef}
                        style={{ height: mapHeight }}
                        className="relative flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-contain [scrollbar-width:none]"
                    >
                        {Object.values(WorldId).map((id) => {
                            const world = worlds[id];
                            return (
                                <m.div
                                    key={id}
                                    data-map={id}
                                    className={`w-full shrink-0 snap-center overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] ${worldSkies[id]}`}
                                >
                                    {/*  At least the map's height, so a
                                         painting wider than tall fills it,
                                         its sides cropped evenly. */}
                                    <m.div
                                        className="relative left-1/2 -translate-x-1/2"
                                        style={{
                                            aspectRatio: world.aspect,
                                            width: `max(100%, ${mapHeight} * ${world.aspect})`,
                                        }}
                                    >
                                        <Image
                                            src={world.image}
                                            label=""
                                            className="absolute inset-0 size-full"
                                        />
                                        {world.pins.map(({ track, at }) => {
                                            const pin = byId.get(track);
                                            if (!pin) return null;
                                            const picked = track === selected;
                                            return (
                                                <m.div
                                                    key={track}
                                                    className={`absolute flex -translate-1/2 ${picked ? "z-20" : "z-10"}`}
                                                    style={placeAt(at)}
                                                >
                                                    <TrackPin
                                                        number={pin.number}
                                                        state={pin.state}
                                                        coins={
                                                            pin.state ===
                                                            PinState.Finished
                                                                ? pin.coins
                                                                : undefined
                                                        }
                                                        selected={picked}
                                                        //  Out towards the
                                                        //  painting's edge,
                                                        //  as the card.
                                                        countSide={
                                                            at.x < 0.5
                                                                ? "left"
                                                                : "right"
                                                        }
                                                        onSelect={() =>
                                                            onSelect(track)
                                                        }
                                                    />
                                                    {picked && (
                                                        <m.div
                                                            className={`absolute top-1/2 -translate-y-1/2 ${at.x < 0.5 ? "right-full mr-2" : "left-full ml-2"}`}
                                                        >
                                                            <TrackCard
                                                                number={
                                                                    pin.number
                                                                }
                                                                shape={
                                                                    pin.shape
                                                                }
                                                                coins={
                                                                    pin.coins
                                                                        .total
                                                                }
                                                                needed={
                                                                    pin.needed
                                                                }
                                                                step={step}
                                                            />
                                                        </m.div>
                                                    )}
                                                </m.div>
                                            );
                                        })}
                                        <m.div
                                            className="absolute z-10 flex -translate-1/2"
                                            style={placeAt(world.gate)}
                                        >
                                            <GatePin
                                                to={world.to}
                                                open={
                                                    world.to === WorldId.Snow ||
                                                    desertOpen
                                                }
                                                onPress={() =>
                                                    show(
                                                        world.to,
                                                        readArrival(world.to),
                                                        "smooth",
                                                    )
                                                }
                                            />
                                        </m.div>
                                    </m.div>
                                </m.div>
                            );
                        })}
                    </m.div>
                </m.div>
                {/*  Clear of a phone's home bar, and the tab's white, so a
                     tap on it raises or lowers the map too. */}
                <m.div
                    className="border-x-4 border-[#14213d] bg-white"
                    style={{ height: gameInsetLengths.bottom }}
                    onClick={() => setRaised((up) => !up)}
                />
            </m.div>
        </LazyMotion>
    );
}
