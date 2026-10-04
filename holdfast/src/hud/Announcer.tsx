import type { Entity } from "koota";
import { useHas, useQuery, useQueryFirst, useTrait } from "koota/react";
import { useEffect, useRef } from "react";
import {
    AuthorityTrait,
    createStore,
    HeroTrait,
    Hud,
    isPlayerHero,
    Panel,
    PanelVariant,
    PlayerNameTrait,
    Slot,
    Text,
} from "@spawnite/engine";
import { playSound, Sound } from "../audio/sounds";
import { isElementPick } from "../siege/cards";
import { measureFireRing } from "../siege/fire";
import { FireTrait, SiegeTrait, WardenTrait } from "../siege/traits";
import { LifeMachine } from "../siege/life";
import { usePhase } from "../views/phase";
import { readOfferKey, readRevealTimes } from "./cardReveal";
import { hudDisplay, hudLabel, topOrder } from "./look";
import { readWaveLook, type WaveLook } from "./named";

//  The moments of a run, called out under the banner for a couple of
//  seconds: a wave rising, by its name where it has one, a wave held, the
//  fire growing, a teammate falling and getting up, and her own warden
//  back on her feet. The newest call is the large one; the one before it
//  steps down to a line. Her cards' deal takes the screen: a call up as
//  it starts leaves, and one made while the cards turn waits for them to
//  settle. While her hand is open a call is a line, clear of the hand
//  (styles.css).

/** Seconds a call stays up. */
export const callSeconds = 2.2;
/** Milliseconds a call takes to leave: its fade in styles.css. It leaves
 *  on this clock, so it goes even where its fade does not run. */
const leaveMilliseconds = 280;
/** Milliseconds the hand takes to settle from the middle to the bottom:
 *  its card-hand animation in styles.css. */
const handMilliseconds = 480;

/** What a call says: a big line, a small one under it, and a label over
 *  it. */
interface CallWords {
    title: string;
    line: string;
    /** Red for bad news. */
    alarm: boolean;
    label?: string;
    /** A named wave's colours, over the alarm's. */
    look?: WaveLook;
}

/** One call on screen, and whether it is leaving. */
interface Call extends CallWords {
    id: number;
    leaving: boolean;
}

interface CallsState {
    calls: Call[];
    nextId: number;
    /** Whether her cards' deal holds the calls back. */
    held: boolean;
    /** The calls made while held, the last two at most. */
    waiting: CallWords[];
}

/** The calls on screen, the last two at most. */
const useCalls = createStore<CallsState>()(() => ({
    calls: [],
    nextId: 0,
    held: false,
    waiting: [],
}));

/** Starts `id` leaving, and takes it off once its fade is over. */
function dismiss(id: number) {
    useCalls.setState(({ calls }) => ({
        calls: calls.map((call) =>
            call.id === id ? { ...call, leaving: true } : call,
        ),
    }));
    setTimeout(
        () =>
            useCalls.setState(({ calls }) => ({
                calls: calls.filter((kept) => kept.id !== id),
            })),
        leaveMilliseconds,
    );
}

/** Puts `words` up at once, and takes it down once its seconds are
 *  over. */
function show(words: CallWords) {
    const id = useCalls.getState().nextId;
    useCalls.setState(({ calls }) => ({
        calls: [
            ...calls.filter((call) => !call.leaving).slice(-1),
            { ...words, id, leaving: false },
        ],
        nextId: id + 1,
    }));
    setTimeout(() => dismiss(id), callSeconds * 1000);
}

/** Puts `call` up, or, while her cards are dealt, once they settle. */
export function announce(call: CallWords) {
    if (useCalls.getState().held)
        useCalls.setState(({ waiting }) => ({
            waiting: [...waiting.slice(-1), call],
        }));
    else show(call);
}

//  The timer that lets the calls back, so a second deal restarts it.
let release: ReturnType<typeof setTimeout> | undefined;

/** Gives the screen to her cards for `milliseconds`: every call up
 *  leaves, and each call made meanwhile waits, then goes up in turn. */
function holdCalls(milliseconds: number) {
    for (const call of useCalls.getState().calls)
        if (!call.leaving) dismiss(call.id);
    useCalls.setState({ held: true });
    clearTimeout(release);
    release = setTimeout(() => {
        const { waiting } = useCalls.getState();
        useCalls.setState({ held: false, waiting: [] });
        for (const call of waiting) show(call);
    }, milliseconds);
}

/** Holds the calls back while her own cards are dealt, each new offer's
 *  deal as long as its reveal and its settling into the hand take. */
function DealWatch() {
    const survivor = useTrait(
        useQueryFirst(HeroTrait, AuthorityTrait),
        WardenTrait,
    );
    const offer = survivor?.offer;
    const key = offer ? readOfferKey(offer) : "";
    //  The offer last dealt: the same offer read again deals nothing.
    const dealtRef = useRef("");
    useEffect(() => {
        if (key === dealtRef.current) return;
        dealtRef.current = key;
        if (!offer || offer.length === 0) return;
        holdCalls(readRevealTimes(offer).settle + handMilliseconds);
    }, [key, offer]);
    return null;
}

interface WardenWatchProps {
    entity: Entity;
    /** Whether the run is going: its end stands every warden up by the
     *  fire, which is no teammate's doing to call out. */
    running: boolean;
    /** Whether a wave is being fought: a held wave stands her up with
     *  every warden, which its own call says. */
    fighting: boolean;
}

/** Calls out another warden going down and getting up, and her own page's
 *  warden back on her feet, alone or by a teammate's hand. */
function WardenWatch({ entity, running, fighting }: WardenWatchProps) {
    const survivor = useTrait(entity, WardenTrait);
    const player = useTrait(entity, PlayerNameTrait);
    const down = useHas(entity, LifeMachine.is.down);
    const selfRevive = survivor?.selfRevive ?? false;
    const wasRef = useRef({ down, selfRevive });
    useEffect(() => {
        const was = wasRef.current;
        wasRef.current = { down, selfRevive };
        if (was.down === down || (!down && !running)) return;
        if (isPlayerHero(entity)) {
            if (down || !fighting) return;
            announce({
                title: "Back on your feet",
                line:
                    was.selfRevive && !selfRevive
                        ? "Your next self-revive comes with the next colossus"
                        : "",
                alarm: false,
            });
            return;
        }
        const name = player?.name ?? "A warden";
        announce(
            down
                ? {
                      title: `${name} is down`,
                      line: "Stand by them to get them up",
                      alarm: true,
                  }
                : { title: `${name} is back up`, line: "", alarm: false },
        );
    }, [down, selfRevive, entity, player, running, fighting]);
    return null;
}

/** Calls out the fire rising a level, as a teammate's coins or her own
 *  feed it: every warden hears it grow. */
function FireWatch() {
    const level = useTrait(useQueryFirst(FireTrait), FireTrait)?.level ?? 0;
    const lastRef = useRef(level);
    useEffect(() => {
        const last = lastRef.current;
        lastRef.current = level;
        //  A new run puts it back to nothing, which is no news.
        if (level <= last) return;
        announce({
            label: `Level ${level}`,
            title: "The fire grows",
            line:
                level === 1
                    ? "Its ring heals during waves now"
                    : `Its ring reaches ${measureFireRing(level)} m and heals harder`,
            alarm: false,
        });
        playSound(Sound.FireRises);
    }, [level]);
    return null;
}

//  Whether this page has pointed her to the rack: once is enough.
let rackCalled = false;

/** Forgets the rack's call, for a test. */
export function forgetRackCall() {
    rackCalled = false;
}

/** Whether she holds a card beyond her element: taken now, or kept from
 *  a pick the room made for her as the last wave opened. */
function holdsCard(taken: string, cards: readonly string[]) {
    return (
        (taken !== "" && !isElementPick(taken)) ||
        cards.some((card) => !isElementPick(card))
    );
}

interface RackWatchProps {
    /** Whether the run rests between waves. */
    breather: boolean;
}

/** Points her to the rack in a breather once she holds her first card,
 *  the moment coins start to matter: nothing else on screen says where
 *  they go. */
function RackWatch({ breather }: RackWatchProps) {
    const survivor = useTrait(
        useQueryFirst(HeroTrait, AuthorityTrait),
        WardenTrait,
    );
    const held = holdsCard(survivor?.taken ?? "", survivor?.cards ?? []);
    //  Once the breather's offer is in, so the call waits out its deal.
    const dealt = (survivor?.offer.length ?? 0) > 0;
    useEffect(() => {
        if (rackCalled || !breather || !held || !dealt) return;
        rackCalled = true;
        announce({
            title: "Spend coins at the rack",
            line: "Guns and upgrades by the fire. Press E at a stand",
            alarm: false,
        });
    }, [breather, held, dealt]);
    return null;
}

export function Announcer() {
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const wardens = useQuery(WardenTrait);
    const calls = useCalls((state) => state.calls);

    //  A wave rising, once its number is in, and a wave held, as the phase
    //  turns.
    const phase = usePhase();
    const wave = siege?.wave ?? 0;
    const named = siege?.named;
    const lastRef = useRef({ phase, wave });
    //  The wave last called rising: a page that opens mid-wave calls none.
    const risenRef = useRef(wave);
    useEffect(() => {
        const last = lastRef.current;
        lastRef.current = { phase, wave };
        //  A new run counts its waves from 0 again.
        if (wave === 0) risenRef.current = 0;
        //  The room opens a wave a step after its phase turns to fight, so
        //  the phase reaches the page a delta before the wave's number and
        //  name: the call waits for the number.
        const rising =
            phase === "fight" && wave > 0 && wave !== risenRef.current;
        if (!rising && last.phase === phase) return;
        const look =
            named === undefined ? undefined : readWaveLook(wave, named);
        if (rising) {
            risenRef.current = wave;
            announce(
                look
                    ? {
                          label: `Wave ${wave}`,
                          title: look.title,
                          line: look.line,
                          alarm: true,
                          look,
                      }
                    : {
                          title: `Wave ${wave}`,
                          line: "The Hollow rises",
                          alarm: true,
                      },
            );
            playSound(look ? Sound.NamedWave : Sound.WaveStart);
        } else if (phase === "breather" && wave > 0) {
            //  The title alone: the banner says what to do next.
            announce({ title: `Wave ${wave} held`, line: "", alarm: false });
            playSound(Sound.WaveHeld);
        } else if (phase === "over") playSound(Sound.RunOver);
        else if (phase === "dawn") playSound(Sound.Dawn);
    }, [phase, wave, named]);

    return (
        <>
            <FireWatch />
            <DealWatch />
            {/*  After the deal's watch, so a deal that lands in the same
                render holds the call back rather than taking it down. */}
            <RackWatch breather={phase === "breather"} />
            {wardens.map((entity) => (
                <WardenWatch
                    key={entity}
                    entity={entity}
                    running={phase === "fight" || phase === "breather"}
                    fighting={phase === "fight"}
                />
            ))}
            {calls.length > 0 && (
                <Hud>
                    {/*  Last in the top of the screen, under the banner and
                        the boss's bar, so a call covers neither, nor the
                        aim below it. */}
                    <Panel
                        slot={Slot.Top}
                        order={topOrder.calls}
                        variant={PanelVariant.Bare}
                        className="mt-1 gap-2"
                    >
                        {calls.map((call, index) => (
                            <CallView
                                key={call.id}
                                call={call}
                                newest={index === calls.length - 1}
                            />
                        ))}
                    </Panel>
                </Hud>
            )}
        </>
    );
}

//  Each call's colours: a named wave's own, the alarm's red, or the
//  fire's amber. Written whole, because Tailwind emits only the classes it
//  reads.
const alarmTitle =
    "text-red-400 [text-shadow:0_2px_0_rgb(60_0_0),0_0_24px_rgb(255_60_60/0.55)]";
const calmTitle =
    "text-amber-200 [text-shadow:0_2px_0_rgb(70_35_0),0_0_24px_rgb(255_177_59/0.55)]";
const alarmRule = "from-transparent via-red-400 to-transparent";
const calmRule = "from-transparent via-amber-300 to-transparent";

interface CallViewProps {
    call: Call;
    /** Whether it is the newest, drawn large; an older one is a line. */
    newest: boolean;
}

/** One call: it slams in, steps down to a line once a newer one comes,
 *  and lifts away as it leaves. */
function CallView({ call, newest }: CallViewProps) {
    const title = call.look
        ? `${call.look.text} ${call.look.glow}`
        : call.alarm
          ? alarmTitle
          : calmTitle;
    const rule = call.look
        ? `from-transparent to-transparent ${call.look.rule}`
        : call.alarm
          ? alarmRule
          : calmRule;
    return (
        <Text
            as="div"
            className={`hud-call flex flex-col items-center gap-1 ${call.leaving ? "animate-hud-leave" : ""}`}
        >
            {call.label && newest && (
                <Text
                    className={`${hudLabel} hud-call-label animate-hud-rise text-sm text-white/75`}
                >
                    {call.label}
                </Text>
            )}
            <Text
                className={`${hudDisplay} hud-call-title animate-hud-slam whitespace-nowrap uppercase ${newest ? "text-5xl" : "text-2xl"} ${title}`}
            >
                {call.title}
            </Text>
            {newest && (
                <Text
                    as="div"
                    className={`hud-call-rule h-0.5 w-72 animate-hud-sweep bg-linear-to-r ${rule}`}
                >
                    {null}
                </Text>
            )}
            {call.line && newest && (
                <Text className="hud-call-line animate-hud-rise text-base font-semibold tracking-wide text-white/90 uppercase [animation-delay:200ms]">
                    {call.line}
                </Text>
            )}
        </Text>
    );
}
