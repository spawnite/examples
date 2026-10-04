import { Vector3 } from "three";
import {
    DamagedTrait,
    FloatingText,
    TransformTrait,
    useEvent,
    useFloatingText,
} from "@spawnite/engine";

/** Metres over the feet of what was hit that a number starts at. */
const startHeight = 1.2;
//  Written in place for each number: the pool copies it.
const at = new Vector3();

/** Each hit's damage over what took it, rising and fading in under a
 *  second: white, and larger and gold on a crit. Mounted once in the
 *  scene. */
export function DamageNumbers() {
    const floatingText = useFloatingText();
    useEvent(DamagedTrait, (entity) => {
        const position = entity.get(TransformTrait);
        if (!position) return;
        for (const hit of entity.get(DamagedTrait)?.hits ?? []) {
            const crit = hit.data?.crit === true;
            const amount = Math.round(hit.amount);
            floatingText.show({
                at: at.set(position.x, position.y + startHeight, position.z),
                text: crit ? `${amount}!` : String(amount),
                seconds: 0.9,
                className: crit
                    ? "text-xl font-bold text-amber-300"
                    : "font-bold",
            });
        }
    });
    return <FloatingText />;
}
