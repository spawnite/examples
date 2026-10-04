import type { ReactNode } from "react";
import { domAnimation, LazyMotion, m } from "motion/react";

/** A point on the screen, as fractions of its width and height from its
 *  top left corner: where the stage's camera draws a point of the stage. */
export interface ScreenPoint {
    x: number;
    y: number;
}

/** Centres its children on a point of the stage as the screen shows it,
 *  over the 3D stage: the scene projects the point and passes it. */
export function StageMark({
    at,
    children,
}: {
    at: ScreenPoint;
    children: ReactNode;
}) {
    return (
        <LazyMotion features={domAnimation}>
            <m.div
                className="pointer-events-none fixed flex -translate-1/2 items-center justify-center"
                style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
            >
                {children}
            </m.div>
        </LazyMotion>
    );
}
