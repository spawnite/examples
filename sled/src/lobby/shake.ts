import { useAnimate } from "motion/react";

/** A gentle no: a short side to side. */
const shake = { x: [0, -6, 6, -4, 4, 0] };

/** A scope for the element a refused tap shakes, the scope's animate for
 *  any other move it makes, and the shake. */
export function useShake<Shaken extends Element>() {
    const [scope, animate] = useAnimate<Shaken>();
    const run = () => {
        void animate(scope.current, shake, { duration: 0.35 });
    };
    return { scope, animate, shake: run };
}
