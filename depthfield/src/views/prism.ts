import { Color, MathUtils } from "three";
import { findLook, LookId } from "../rules/data";

/** Degrees round the colour wheel the Prismatic look stands at now. */
export function readPrismHue(shift = 0) {
    return (performance.now() / 14 + shift) % 360;
}

/** The hue, in degrees, of the soldier model's painted mint armour. */
const modelHue = 145;

const scratch = new Color();
const hsl = { h: 0, s: 0, l: 0 };

/** Radians the soldier model's colours turn to wear `look`: Grove keeps
 *  the armour's painted mint, another look turns it to the look's own
 *  hue, and the Prismatic look cycles. */
export function readLookTurn(look: LookId) {
    if (look === LookId.Grove) return 0;
    const hue =
        look === LookId.Prismatic
            ? readPrismHue()
            : scratch.set(findLook(look).color).getHSL(hsl).h * 360;
    return MathUtils.degToRad(hue - modelHue);
}
