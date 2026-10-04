import type { ReactNode } from "react";
import { m } from "motion/react";
import { ArrowIcon } from "../icons/ArrowIcon";
import { BareButton } from "./BareButton";
import { StageMark, type ScreenPoint } from "./StageMark";

/** An arrow with no disc. */
function Arrow({
    direction,
    label,
    onPress,
}: {
    direction: "left" | "right";
    label: string;
    onPress: () => void;
}) {
    return (
        <BareButton label={label} onPress={onPress} className="size-16">
            <ArrowIcon
                direction={direction}
                className="size-12 drop-shadow-[0_4px_0_rgb(20_33_61/0.5)]"
            />
        </BareButton>
    );
}

/** The arrows either side of a look on the stage, which cycle it, with
 *  what stands over the look between them, such as its price tag. The
 *  real model on the stage is the picture, so no card and no name. */
export function LookArrows({
    look,
    at,
    spread,
    onPrevious,
    onNext,
    children,
}: {
    /** What the arrows cycle, which their accessible names say, such as
     *  "animal" or "ride". */
    look: string;
    /** The look's middle on the screen. */
    at: ScreenPoint;
    /** Pixels between the arrows' inner edges: the look's width. */
    spread: number;
    onPrevious: () => void;
    onNext: () => void;
    children?: ReactNode;
}) {
    return (
        <StageMark at={at}>
            <Arrow
                direction="left"
                label={`Previous ${look}`}
                onPress={onPrevious}
            />
            <m.div className="flex justify-center" style={{ width: spread }}>
                {children}
            </m.div>
            <Arrow direction="right" label={`Next ${look}`} onPress={onNext} />
        </StageMark>
    );
}
