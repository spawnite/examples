import { useLayoutEffect, useMemo } from "react";
import { Billboard } from "@spawnite/engine";
import { createMark, hideMarks, MarkKind, showMarks } from "./marks";

/** Metres tall a monster's bar stands. */
const barMetres = 0.08;

interface MonsterBarProps {
    /** Metres over the monster's feet the bar's middle stands. */
    height: number;
    /** Metres across. */
    width: number;
    current: number;
    maximum: number;
}

/** A hurt monster's bar over its head, facing the camera from every side
 *  whichever way the monster turns: its dark back, and its red share of
 *  health over it from the left. It shows only while the monster is hurt
 *  and standing. The marks layer draws both. */
export function MonsterBar({
    height,
    width,
    current,
    maximum,
}: MonsterBarProps) {
    const marks = useMemo(
        () => ({
            back: createMark(MarkKind.BarBack),
            fill: createMark(MarkKind.BarFill),
        }),
        [],
    );
    useLayoutEffect(() => {
        const own = Object.values(marks);
        showMarks(own);
        return () => hideMarks(own);
    }, [marks]);
    const share = Math.max(0, current / maximum);

    return (
        <Billboard offset={[0, height, 0]}>
            <group
                scale={[width, barMetres, 1]}
                visible={current < maximum && current > 0}
            >
                <primitive object={marks.back.object} />
                <primitive
                    object={marks.fill.object}
                    scale-x={share}
                    position-x={(share - 1) / 2}
                />
            </group>
        </Billboard>
    );
}
