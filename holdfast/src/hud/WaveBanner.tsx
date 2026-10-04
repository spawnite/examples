import { useHas, useQuery, useQueryFirst, useTrait } from "koota/react";
import {
    AuthorityTrait,
    Bar,
    HeroTrait,
    Hud,
    Icon,
    Panel,
    PanelVariant,
    RoomStatus,
    Slot,
    Text,
    useRoom,
    type RoomFullReason,
    type RoomNotice,
} from "@spawnite/engine";
import {
    MonsterKind,
    MonsterTrait,
    SiegeTrait,
    WardenTrait,
    WaveName,
} from "../siege/traits";
import { bossEvery, nightWaves, planWave } from "../siege/waves";
import { isReadyAsked } from "../siege/gathering";
import { ReadinessMachine } from "../siege/life";
import { PhaseMachine, PhaseTrait } from "../siege/phase";
import { usePhase } from "../views/phase";
import { useHandAtTop, useShopShown } from "./hand";
import { useInReadyRing } from "./inRing";
import { hudBody, hudDisplay, hudLabel, hudPane } from "./look";
import { readWaveLook } from "./named";
import { ReadyButton, urgentSeconds } from "./ReadyButton";

/** What the banner says while the room has not taken her in: how full
 *  the game is, where it turned her away for that, and the engine's notice
 *  about her connection otherwise. */
function readStatusLine(
    status: RoomStatus,
    full: RoomFullReason | null,
    notice: RoomNotice | null,
) {
    if (status === RoomStatus.Closed && full)
        return `This game is full (${full.players} of ${full.maxPlayers})`;
    return notice?.text ?? "";
}

/** The night's fifteen waves as a row of marks: those held, the one being
 *  fought or coming, and the colossi's larger. Endless has no row. */
function NightTrack({ wave }: { wave: number }) {
    return (
        <Text as="div" className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: nightWaves }, (_, index) => {
                const mark = index + 1;
                const boss = mark % bossEvery === 0;
                const held = mark < wave;
                const now = mark === wave;
                return (
                    <Text
                        as="span"
                        key={mark}
                        className={`rounded-full ${boss ? "size-2.5" : "size-1.5"} ${
                            now
                                ? "animate-hud-pulse bg-amber-200 shadow-[0_0_8px_rgb(253_230_138/0.9)]"
                                : held
                                  ? boss
                                      ? "bg-amber-400/80"
                                      : "bg-amber-300/60"
                                  : boss
                                    ? "bg-white/30 ring-1 ring-amber-200/40"
                                    : "bg-white/20"
                        }`}
                    >
                        {null}
                    </Text>
                );
            })}
        </Text>
    );
}

/** The wave's place in the run: "Wave 7 of 15", or "Endless · wave 17". */
function readWaveLabel(wave: number, endless: boolean) {
    return endless ? `Endless · wave ${wave}` : `Wave ${wave} of ${nightWaves}`;
}

/** Her ready in the breather, and the one thing to do: the button, with
 *  its key, and how else to be ready or to take it back. Who else is
 *  ready is the scoreboard's. */
function BreatherReady() {
    const own = useQueryFirst(HeroTrait, AuthorityTrait);
    const ringReady = useHas(own, ReadinessMachine.is.ready.ring);
    const inRing = useInReadyRing();
    const mine = useHas(own, ReadinessMachine.is.ready);
    const hint = mine
        ? ringReady
            ? "Step out of the ring to cancel"
            : "Press R to cancel"
        : inRing
          ? "or step out and back in"
          : "or step into the green ring by the fire";
    return (
        <Text as="div" className="flex items-center gap-2.5">
            <ReadyButton />
            <Text className={`${hudBody} whitespace-nowrap text-white/75`}>
                {hint}
            </Text>
        </Text>
    );
}

interface WaveLeftProps {
    /** Monsters of the wave standing or still to spawn. */
    left: number;
    /** Monsters the wave planned, which a warden joining mid-wave
     *  raises. */
    planned: number;
}

/** How much of the wave is left: a red bar that drains as it falls, and
 *  the count beside it, which bumps with each fall. */
function WaveLeft({ left, planned }: WaveLeftProps) {
    return (
        <Text as="div" className="flex w-52 items-center gap-2.5">
            <Text as="div" className="flex-1 [--color-health-fill:#f87171]">
                <Bar
                    label="The wave left"
                    value={left}
                    maximum={Math.max(planned, left, 1)}
                    className="h-2 w-full rounded-sm bg-black/55"
                />
            </Text>
            <Text className={`flex items-baseline gap-1 ${hudBody}`}>
                <Text
                    //  A new element per count, so each fall bumps it.
                    key={left}
                    tabular
                    className={`${hudDisplay} inline-block text-base text-red-200 ${left > 0 ? "animate-hud-bump" : ""}`}
                >
                    {left}
                </Text>
                left
            </Text>
        </Text>
    );
}

interface NextWaveProps {
    wave: number;
    named: WaveName;
}

/** The wave to come, where it changes the fight: its name or its colossus,
 *  in its colour, and how to fight it. */
function NextWave({ wave, named }: NextWaveProps) {
    const look = readWaveLook(wave, named);
    if (!look) return null;
    return (
        <Text
            as="div"
            key={`${wave}${named}`}
            className="flex animate-hud-rise items-center gap-2"
        >
            <Icon name={look.icon} className={`size-5 shrink-0 ${look.text}`} />
            <Text as="div" className="flex flex-col items-start">
                <Text
                    className={`${hudDisplay} text-lg whitespace-nowrap uppercase ${look.text}`}
                >
                    Next: {look.title}
                </Text>
                <Text className="text-xs font-semibold whitespace-nowrap text-white/75">
                    {look.line}
                </Text>
            </Text>
        </Text>
    );
}

/** The run's headline at the top of the screen: the wave, how much of it
 *  is left and where it stands in the night, or the countdown to the next,
 *  its name a breather ahead, and who is ready for it. The wait for a run
 *  is the gathering's banner. */
export function WaveBanner() {
    const status = useRoom((state) => state.status);
    const full = useRoom((state) => state.full);
    const notice = useRoom((state) => state.notice);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const monsters = useQuery(MonsterTrait);
    const standing = monsters.length;
    const colossus = monsters.some(
        (monster) => monster.get(MonsterTrait)?.kind === MonsterKind.Colossus,
    );
    const wardens = useQuery(WardenTrait).length;
    const phase = usePhase();
    //  The room opens a wave a step after its phase turns: until the new
    //  wave's number is in, the banner keeps the breather's face.
    const opening = useHas(
        useQueryFirst(PhaseTrait),
        PhaseMachine.is.fight.opening,
    );
    //  While her cards stand open, the bar under them holds the clock and
    //  Ready, and the banner names the wave alone.
    const shop = useShopShown();
    //  On a phone held upright her open hand takes the top, and its shop's
    //  bar holds the clock and Ready.
    const handAtTop = useHandAtTop();

    if (status !== RoomStatus.Joined)
        return (
            <Hud>
                <Panel
                    slot={Slot.Top}
                    variant={PanelVariant.Bare}
                    className={`min-w-44 gap-1 px-6 pt-2 pb-3 ${hudPane}`}
                >
                    <Text className={hudLabel}>Holdfast</Text>
                    <Text
                        key={status}
                        className={`${hudDisplay} animate-hud-rise text-2xl`}
                    >
                        {readStatusLine(status, full, notice)}
                    </Text>
                </Panel>
            </Hud>
        );
    if (!siege || (phase !== "fight" && phase !== "breather") || handAtTop)
        return null;

    const fighting = phase === "fight" && !opening;
    const left = standing + siege.toSpawn;
    const shownWave = fighting ? siege.wave : siege.wave + 1;
    //  The colossus's own bar names it while it stands.
    const look =
        fighting && !colossus
            ? readWaveLook(siege.wave, siege.named)
            : undefined;
    const seconds = Math.ceil(siege.secondsLeft);
    //  The countdown's last seconds before a wave turn from the fire's
    //  amber to red, each slamming in.
    const urgent = !fighting && seconds <= urgentSeconds;
    //  The first breather follows the gathering's own ready: it names the
    //  night's goal and asks nothing.
    const first = !fighting && !isReadyAsked("breather", siege.wave);

    return (
        <Hud>
            <Panel
                slot={Slot.Top}
                variant={PanelVariant.Bare}
                className={`${shop ? "hud-banner-shop" : ""} min-w-72 gap-1.5 px-5 pt-2 pb-2.5 ${hudPane}`}
            >
                {!siege.endless && <NightTrack wave={shownWave} />}
                {fighting ? (
                    <Text as="div" className="flex items-center gap-3.5">
                        <Text
                            //  Keyed by the number, so a new wave lands with
                            //  the entrance.
                            key={`wave${siege.wave}`}
                            tabular
                            className={`${hudDisplay} min-w-[1.2ch] animate-hud-slam text-center text-5xl text-red-300`}
                        >
                            {siege.wave}
                        </Text>
                        <Text
                            as="div"
                            className="flex flex-col items-start gap-1"
                        >
                            <Text className={hudLabel}>
                                {readWaveLabel(siege.wave, siege.endless)}
                            </Text>
                            {look && (
                                <Text
                                    className={`${hudDisplay} flex items-center gap-1.5 text-lg whitespace-nowrap uppercase ${look.text}`}
                                >
                                    <Icon name={look.icon} className="size-4" />
                                    {look.title}
                                </Text>
                            )}
                            <WaveLeft
                                left={left}
                                planned={
                                    planWave(siege.wave, wardens, siege.named)
                                        .count
                                }
                            />
                        </Text>
                    </Text>
                ) : shop ? (
                    <>
                        <Text
                            className={`${hudDisplay} text-2xl whitespace-nowrap text-pane-ink uppercase`}
                        >
                            {readWaveLabel(shownWave, siege.endless)}
                        </Text>
                        {!first && !opening && (
                            <NextWave wave={shownWave} named={siege.named} />
                        )}
                    </>
                ) : (
                    <>
                        {/*  Words first, then the count: "Wave 2 in 17". */}
                        <Text as="div" className="flex items-baseline gap-3">
                            <Text
                                className={`${hudDisplay} text-2xl whitespace-nowrap text-pane-ink uppercase`}
                            >
                                {first
                                    ? "The Hollow wakes in"
                                    : `Wave ${shownWave} in`}
                            </Text>
                            <Text
                                //  Keyed by the second, so each lands with
                                //  the entrance.
                                key={`in${seconds}`}
                                tabular
                                className={`${hudDisplay} min-w-[1.2ch] animate-hud-slam text-center text-5xl ${urgent ? "text-red-300 [text-shadow:0_0_18px_rgb(248_113_113/0.7)]" : "text-menu-accent"}`}
                            >
                                {seconds}
                            </Text>
                        </Text>
                        {first ? (
                            <Text
                                className={`${hudBody} whitespace-nowrap text-white/80`}
                            >
                                The night's monsters. Hold them off until dawn
                            </Text>
                        ) : (
                            <>
                                {/*  The name streams with the wave's
                                    number, a delta after the opening. */}
                                {!opening && (
                                    <NextWave
                                        wave={shownWave}
                                        named={siege.named}
                                    />
                                )}
                                <BreatherReady />
                            </>
                        )}
                    </>
                )}
            </Panel>
        </Hud>
    );
}
