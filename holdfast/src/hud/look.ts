import { menuPane } from "@spawnite/engine";

//  The HUD's one look, the same as the engine's menus: the menu pane in the
//  dusk slate and warm hairline this game sets on ui's tokens (see
//  styles.css), a
//  condensed heavy face for numbers and titles, and a small
//  spaced label over them. One type scale, all of it in rem so it grows
//  with the screen (see styles.css): hudLabel for labels and tags, hudBody
//  for a line of prose, text-base to text-2xl for values, text-4xl and up
//  for the banners. Written whole, because Tailwind emits only the classes
//  it reads.

/** The pane every HUD readout stands on, for a Panel drawn bare: the
 *  engine's menu pane, so the HUD and the Escape menu read as one. */
export const hudPane = menuPane;

/** Big numbers and titles: the display face, condensed and heavy. */
export const hudDisplay =
    "font-display font-bold font-stretch-condensed leading-none tracking-wide";

/** The small spaced caps over a number or a list. */
export const hudLabel =
    "text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-amber-100/60";

/** A line of prose in a pane: what to do, or why. */
export const hudBody = "text-sm font-semibold text-white/85";

/** A quieter line under it: the aside a player may skip. */
export const hudNote = "text-sm font-semibold text-white/60";

/** A small filled tag, as NEW on a card or DOWN on a row, on one line; the
 *  caller adds its colours. */
export const hudTag =
    "rounded px-1.5 py-0.5 text-[0.6875rem] leading-none font-bold tracking-[0.14em] whitespace-nowrap uppercase";

/** The keycap a card or a prompt names. */
export const hudKey =
    "inline-flex size-7 items-center justify-center rounded-md border border-menu-accent/50 bg-slate-950/80 font-display text-base font-bold text-menu-accent shadow-[0_2px_0_rgb(0_0_0/0.6)]";

/** A keycap only a keyboard needs, as the card shop's: a touch screen,
 *  with its coarse pointer, leaves it out and taps the control. */
export const hudKeyboardKey = `${hudKey} pointer-coarse:hidden`;

/** The order of the panels in the top of the screen, first at the top:
 *  the banner and the colossus's bar, in the order they mount; the wardens,
 *  on a touch screen, or in their place her open hand on a phone held
 *  upright, where the wardens step aside for it; the calls; and her own
 *  element level's call. */
export const topOrder = {
    banner: 0,
    wardens: 1,
    hand: 1,
    calls: 2,
    level: 3,
} as const;

/** A control a finger taps is 44 px tall at least on a touch screen, as
 *  Apple's and Google's guidelines ask. */
export const hudTapTarget = "pointer-coarse:min-h-[44px]";
