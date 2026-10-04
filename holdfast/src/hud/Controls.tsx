import { useQueryFirst, useTrait } from "koota/react";
import { useEffect, useState, type ReactNode } from "react";
import {
    AuthorityTrait,
    HeroTrait,
    Hud,
    Icon,
    Panel,
    PanelVariant,
    Slot,
    Text,
    TransformTrait,
} from "@spawnite/engine";
import { WardenTrait } from "../siege/traits";
import { measureSinceShot } from "../views/warden/muzzles";
import { usePhase } from "../views/phase";
import { readCardOffer, useHand } from "./hand";
import { hudBody, hudKey, hudPane } from "./look";

//  How to move, aim and fire, along the bottom from her first moment on the
//  page, as Vampire Survivors and Brotato show their controls once, small,
//  and let the first wave teach the rest. Moving checks off as she walks,
//  aiming and firing as she fires, and the strip goes a few seconds after
//  her first steps, fired or not, for the rest of the page's life. A touch
//  screen has no keys to show: the game has no touch controls yet.

/** Metres she walks from where the strip first saw her to count as moved. */
export const movedMetres = 2;
/** Milliseconds the strip stays after her first steps, so she reads how to
 *  aim and fire as she walks. */
const readMilliseconds = 3000;
/** Milliseconds the strip takes to leave: its fade in styles.css. */
const leaveMilliseconds = 280;

//  Whether she learned the controls on this page: a strip mounted again,
//  as a rejoin does, shows nothing.
let learned = false;

/** Forgets that she learned the controls, for a test. */
export function forgetControls() {
    learned = false;
}

/** What she has done of the controls: walked, and fired. */
interface Learning {
    moved: boolean;
    fired: boolean;
}

/** Whether she has walked `movedMetres` from where she first stood and
 *  fired her gun, read each animation frame until she has done both. */
function useLearning(hue: number | undefined): Learning {
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const [learning, setLearning] = useState<Learning>({
        moved: false,
        fired: false,
    });
    useEffect(() => {
        if (!hero || hue === undefined) return;
        const start = hero.get(TransformTrait)?.clone();
        let moved = false;
        let fired = false;
        let frame = 0;
        const read = () => {
            const feet = hero.get(TransformTrait);
            if (!moved && start && feet)
                moved =
                    Math.hypot(feet.x - start.x, feet.z - start.z) >=
                    movedMetres;
            if (!fired) fired = measureSinceShot(hue) !== Infinity;
            setLearning((was) =>
                was.moved === moved && was.fired === fired
                    ? was
                    : { moved, fired },
            );
            if (!moved || !fired) frame = requestAnimationFrame(read);
        };
        frame = requestAnimationFrame(read);
        return () => cancelAnimationFrame(frame);
    }, [hero, hue]);
    return learning;
}

interface StepProps {
    done: boolean;
    children: ReactNode;
}

/** One control and what it does, checked off once she has done it. */
function Step({ done, children }: StepProps) {
    return (
        <Text
            as="span"
            className={`flex items-center gap-2 transition-opacity duration-300 ${done ? "opacity-45" : ""}`}
        >
            {children}
            {done && (
                <Icon
                    name="check"
                    className="size-4 animate-hud-slam text-emerald-300"
                />
            )}
        </Text>
    );
}

interface MouseGlyphProps {
    /** Whether its left button is lit, the one that fires. */
    fire: boolean;
}

/** A mouse, with its left button lit where it fires. */
function MouseGlyph({ fire }: MouseGlyphProps) {
    return (
        <svg
            viewBox="0 0 16 22"
            className="h-6 w-4.5 shrink-0 text-menu-accent"
            aria-hidden
        >
            <rect
                x="1"
                y="1"
                width="14"
                height="20"
                rx="7"
                fill="rgb(2 6 23 / 0.8)"
                stroke="currentColor"
                strokeOpacity="0.6"
                strokeWidth="1.5"
            />
            {fire && (
                <path
                    d="M8 1.75 A6.25 6.25 0 0 0 1.75 8 V9 H8 Z"
                    fill="currentColor"
                />
            )}
            <line
                x1="8"
                y1="1.75"
                x2="8"
                y2="9"
                stroke="currentColor"
                strokeOpacity="0.6"
                strokeWidth="1.5"
            />
        </svg>
    );
}

/** The move keys, as a small cluster of keycaps. */
function MoveKeys() {
    return (
        <Text as="span" className="flex items-center gap-0.5">
            {["W", "A", "S", "D"].map((key) => (
                <Text
                    as="span"
                    key={key}
                    className={`${hudKey} size-6 text-sm`}
                >
                    {key}
                </Text>
            ))}
        </Text>
    );
}

/** The controls strip, until a few seconds after her first steps. */
export function Controls() {
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const survivor = useTrait(hero, WardenTrait);
    const hue = survivor?.hue;
    const [leaving, setLeaving] = useState(false);
    const [gone, setGone] = useState(learned);
    //  Gone, the strip reads nothing more.
    const { moved, fired } = useLearning(gone ? undefined : hue);
    //  A breather's open hand takes the bottom of the screen: the strip
    //  steps aside for it, and comes back as it folds.
    const offer = readCardOffer(usePhase(), survivor);
    const folded = useHand((state) => state.folded);
    const handOpen = offer.open && !offer.gathering && !folded;
    useEffect(() => {
        if (!moved) return;
        learned = true;
        const leave = setTimeout(() => setLeaving(true), readMilliseconds);
        const go = setTimeout(
            () => setGone(true),
            readMilliseconds + leaveMilliseconds,
        );
        return () => {
            clearTimeout(leave);
            clearTimeout(go);
        };
    }, [moved]);

    if (gone || handOpen || !hero || hue === undefined) return null;
    return (
        <Hud>
            {/*  Above her element's chip and her cards, which share the
                bottom. */}
            <Panel slot={Slot.Bottom} order={-1} variant={PanelVariant.Bare}>
                <Text
                    as="div"
                    aria-label="Controls"
                    className={`controls-strip mb-2 flex items-center pointer-coarse:hidden gap-5 px-4 py-2 ${hudBody} ${hudPane} ${leaving ? "animate-hud-leave" : "animate-hud-rise"}`}
                >
                    <Step done={moved}>
                        <MoveKeys />
                        Move
                    </Step>
                    <Step done={fired}>
                        <MouseGlyph fire={false} />
                        Aim
                    </Step>
                    <Step done={fired}>
                        <MouseGlyph fire />
                        Hold to fire
                    </Step>
                </Text>
            </Panel>
        </Hud>
    );
}
