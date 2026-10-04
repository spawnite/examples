import {
    DamagedTrait,
    TransformTrait,
    useFloatingText,
} from "@spawnite/engine";
import { u } from "../rules/data";
import { EnemyTrait } from "../rules/traits";
import { useEventRecords } from "./useEventRecords";

//  The damage numbers: each hit's number rises from the enemy it struck and
//  fades in three quarters of a second, gold from 50 up.

/** The look of each number, for the field's `FloatingText`. */
export const floatClassName =
    "font-[Arial,Helvetica,sans-serif] text-[15px] [text-shadow:1px_1px_0_#160810]";

/** Shows each hit's number over the enemy it struck. */
export function Floats() {
    const floatingText = useFloatingText();
    useEventRecords(
        DamagedTrait,
        (entity) => entity.get(DamagedTrait)?.hits,
        (hit, entity) => {
            const enemy = entity.get(EnemyTrait);
            const position = entity.get(TransformTrait);
            if (!enemy || !position || hit.amount <= 0) return;
            floatingText.show({
                at: {
                    x: position.x + u((Math.random() - 0.5) * 18),
                    y: enemy.radius * 2 + u(16),
                    z: position.z,
                },
                text: String(Math.round(hit.amount)),
                color: hit.amount >= 50 ? "#ffe08a" : "#fff6ea",
                rise: u(34 + Math.random() * 22),
            });
        },
    );
    return null;
}
