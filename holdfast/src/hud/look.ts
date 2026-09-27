import { menuPane } from "@spawnite/engine";

//  The HUD's one look, the same as the engine's menus: the menu pane in the
//  dusk slate and warm hairline this game sets on ui's menu tokens (see
//  styles.css), a condensed heavy face for numbers and titles, and a small
//  spaced label over them. One type scale: 11px labels and tags, text-sm
//  for body, text-base to text-2xl for values, text-4xl and up for the
//  banners. Written whole, because Tailwind emits only the classes it reads.

/** The pane every HUD readout stands on, for a Panel drawn bare: the
 *  engine's menu pane, so the HUD and the Escape menu read as one. */
export const hudPane = menuPane;

/** Big numbers and titles: the display face, condensed and heavy. */
export const hudDisplay =
    "font-display font-bold font-stretch-condensed leading-none tracking-wide";

/** The small spaced caps over a number or a list. */
export const hudLabel =
    "text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/60";

/** A small filled tag, as NEW on a card or DOWN on a row; the caller adds
 *  its colours. */
export const hudTag =
    "rounded px-1.5 py-0.5 text-[11px] leading-none font-bold tracking-[0.14em] uppercase";

/** The keycap a card or a prompt names. */
export const hudKey =
    "inline-flex size-7 items-center justify-center rounded-md border border-amber-200/50 bg-slate-950/80 font-display text-base font-bold text-amber-200 shadow-[0_2px_0_rgb(0_0_0/0.6)]";
