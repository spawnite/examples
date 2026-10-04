import type { IconProps } from "@spawnite/engine";

/** The dark edge every sled icon and HUD number is drawn with: the
 *  penguin's navy taken near black, so an outline reads over bright snow
 *  and stays warmer than the engine Text's black. The HUD's class strings
 *  write the same hex, because Tailwind reads only literal classes. */
export const ink = "#14213d";

/** The coin's gold, which the HUD's run coins are written in too. */
export const gold = "#ffc93c";

/** The props an icon of sled's draws with, as the engine's `Icon` takes
 *  them. */
export type SledIconProps = Pick<IconProps, "label" | "className">;

/** Names the icon for a screen reader, or hides it when it has no name. */
export function readIconLabelProps(label: string | undefined) {
    return label === undefined
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label };
}
