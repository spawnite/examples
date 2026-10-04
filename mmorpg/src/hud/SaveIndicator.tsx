import { Fragment, useState } from "react";
import {
    domAnimation,
    LazyMotion,
    m,
    useReducedMotionConfig,
} from "motion/react";
import { SaveStatus, useSaveStatus } from "@spawnite/engine";
import { CompletionRing } from "@spawnite/ui";

const fillSeconds = 0.5;
const holdSeconds = 0.5;
const fadeSeconds = 0.6;
const visibleSeconds = fillSeconds + holdSeconds + fadeSeconds;
const fadeStart = (fillSeconds + holdSeconds) / visibleSeconds;

//  Where a change waits for its write, or the write is on its way.
const waiting: ReadonlySet<SaveStatus> = new Set([
    SaveStatus.Unsaved,
    SaveStatus.Saving,
]);

/** How many writes have landed since the component mounted: each move of
 *  the engine's save status from waiting to saved. */
function useLandedSaveCount() {
    const { status } = useSaveStatus();
    const [seen, setSeen] = useState({ status, count: 0 });
    if (seen.status !== status) {
        const count =
            seen.count +
            (waiting.has(seen.status) && status === SaveStatus.Saved ? 1 : 0);
        setSeen({ status, count });
        return count;
    }
    return seen.count;
}

//  A save fills the ring, holds it full, and gets out of the way. The region
//  around it is mounted from the start and empty: a live region that arrives
//  already full announces nothing, because assistive technology reads what
//  changes inside a region it was already watching.
export function SaveIndicator() {
    const saveCount = useLandedSaveCount();
    //  The region arrives empty and fills on the first save after it, which
    //  is what a screen reader is watching for.
    const [lastShownCount, setLastShownCount] = useState(saveCount);
    const reducedMotion = useReducedMotionConfig();
    const showing = saveCount > 0 && saveCount !== lastShownCount;

    return (
        <span role="status" className="inline-flex items-center">
            <LazyMotion features={domAnimation}>
                {showing && (
                    //  The key is on the words as well as the glyph, so a second
                    //  save inside one showing fills the ring again and replaces
                    //  the announcement with its own: a save is read out per save,
                    //  and a region whose text never changed would read the second
                    //  one out not at all.
                    <Fragment key={saveCount}>
                        <span className="sr-only">Saved</span>
                        <m.span
                            aria-hidden
                            className="block"
                            initial={{ opacity: 1 }}
                            //  Reduced motion keeps the same seconds of visibility
                            //  and drops the fade, per Motion's accessibility page.
                            //  The fill itself stays: it is opacity alone, with no
                            //  transform to drop.
                            animate={{ opacity: reducedMotion ? 0 : [1, 1, 0] }}
                            transition={
                                reducedMotion
                                    ? { duration: 0, delay: visibleSeconds }
                                    : {
                                          duration: visibleSeconds,
                                          times: [0, fadeStart, 1],
                                          ease: "easeOut",
                                      }
                            }
                            onAnimationComplete={() => {
                                setLastShownCount(saveCount);
                            }}
                        >
                            <CompletionRing className="size-6" />
                        </m.span>
                    </Fragment>
                )}
            </LazyMotion>
        </span>
    );
}
