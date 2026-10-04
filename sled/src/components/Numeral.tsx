import type { ComponentProps, ReactNode } from "react";
import { Text } from "@spawnite/engine";

/** A number drawn onto the world in the HUD's chunky look: the engine
 *  Text's white, heavy, with a thick ink edge and a drop under it, as a
 *  mobile game draws its score. The edge is a stroke painted under the
 *  fill, so it thickens the outline without eating the glyph, and it
 *  scales with the size, which the className sets. The spacing keeps one
 *  digit's edge off the next one's fill. A number with a name of its own,
 *  such as a total, is an `output` with an `aria-label`, as the engine
 *  Text draws one. */
export function Numeral({
    as,
    "aria-label": label,
    className,
    children,
}: Pick<ComponentProps<typeof Text>, "as" | "aria-label"> & {
    className?: string;
    children: ReactNode;
}) {
    return (
        <Text
            as={as}
            aria-label={label}
            tabular
            className={`leading-none font-black tracking-[0.08em] [paint-order:stroke_fill] [-webkit-text-stroke:0.2em_#14213d] [text-shadow:0_0.09em_0_#14213d] ${className ?? ""}`}
        >
            {children}
        </Text>
    );
}
