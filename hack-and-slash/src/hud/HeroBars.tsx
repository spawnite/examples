import { useEffect, useRef } from "react";
import type { Entity } from "koota";
import {
    Anchor,
    HealthTrait,
    Panel,
    PanelVariant,
    Text,
} from "@spawnite/engine";
import { HeroCombatTrait } from "../combat/traits";
import { headSize } from "../hero/modelRig";
import { deriveHero, dodgeStamina, useProgress } from "../hero/progress";

/** Metres over her feet her head bone stands, at her jaw, and her tallest
 *  hair or headset stands at the model's own head size. Her head shrinks
 *  about her jaw. */
const jawHeight = 0.89;
const tallestHair = 1.6;
/** Metres over her feet the bars stand: 10 cm clear of her tallest hair. */
const barsHeight = jawHeight + (tallestHair - jawHeight) * headSize + 0.1;

/** Her health and stamina over her head, as an MMO shows its hero's: her
 *  health as a bar, her stamina as a cell for each dodge it holds, the next
 *  filling as it comes back. Written from her state each frame straight into
 *  the page, so nothing here renders again but for a change of how many
 *  cells she has. Mounted in the Player's overlay. */
export function HeroBars({ entity }: { entity: Entity }) {
    const cellCount = useProgress((progress) =>
        Math.floor(deriveHero(progress).maxStamina / dodgeStamina),
    );
    const health = useRef<HTMLDivElement>(null);
    const cells = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        let request = 0;
        const draw = () => {
            request = requestAnimationFrame(draw);
            if (!entity.isAlive()) return;
            const hp = entity.get(HealthTrait);
            const combat = entity.get(HeroCombatTrait);
            if (health.current && hp)
                health.current.style.width = `${(100 * Math.max(0, hp.current)) / Math.max(1, hp.maximum)}%`;
            const stamina = combat?.stamina ?? 0;
            cells.current.forEach((cell, index) => {
                if (!cell) return;
                const full = Math.min(
                    1,
                    Math.max(0, stamina / dodgeStamina - index),
                );
                cell.style.width = `${full * 100}%`;
                //  A cell ready to dodge with stands bright; one filling, dim.
                cell.style.opacity = full >= 1 ? "1" : "0.55";
            });
        };
        request = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(request);
    }, [entity]);

    //  Anchored on a point of its own over her hair: the Panel stands on
    //  the top of what holds it, and her bounds, measured from her rest
    //  pose, reach no higher than her brow.
    return (
        <group position-y={barsHeight}>
            <Panel anchor={Anchor.Above} variant={PanelVariant.Bare}>
                <Text
                    as="div"
                    className="flex w-16 flex-col gap-0.5 drop-shadow-[0_1px_1px_rgb(0_0_0/0.8)]"
                >
                    <Text
                        as="div"
                        className="h-1.5 overflow-hidden rounded-full bg-black/55"
                    >
                        {/* eslint-disable-next-line no-restricted-syntax -- a bar written by ref each frame rather than rendered; Bar takes a value: a gap in the pull request */}
                        <div
                            ref={health}
                            className="h-full rounded-full bg-[var(--color-health-fill)]"
                        />
                    </Text>
                    <Text as="div" className="flex gap-0.5">
                        {Array.from({ length: cellCount }, (_, index) => (
                            <Text
                                as="div"
                                key={index}
                                className="h-1 flex-1 overflow-hidden rounded-full bg-black/55"
                            >
                                {/* eslint-disable-next-line no-restricted-syntax -- a cell written by ref each frame; a gap in the pull request */}
                                <div
                                    ref={(node) => {
                                        cells.current[index] = node;
                                    }}
                                    className="h-full rounded-full bg-amber-300"
                                />
                            </Text>
                        ))}
                    </Text>
                </Text>
            </Panel>
        </group>
    );
}
