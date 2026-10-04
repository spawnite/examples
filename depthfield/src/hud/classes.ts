//  Depthfield's looks on the engine's primitives, as Tailwind classes:
//  every dialog's pane and backdrop, and the primary button's shape. Written
//  whole, because Tailwind emits only the classes it reads.

/** A dialog's pane, its text to the left. The slate theme gives the slab,
 *  its edge colour, radius, ink and shadow colour; this keeps the source's
 *  hairline edge, deeper shadow and padding, and turns off the glass's
 *  inset top edge, which no theme token reaches. */
export const paneLook =
    "items-stretch gap-0 p-[30px] text-left font-[Arial,Helvetica,sans-serif] border shadow-[0_20px_90px_#0007] inset-shadow-none focus-visible:outline-none";

/** The dialog around the pane: its buttons as wide as the pane, no text
 *  shadow anywhere in it, and the field blurred behind it. */
export const dialogLook =
    "items-stretch focus-visible:outline-none [&_*]:[text-shadow:none] backdrop:bg-[#0a111969] backdrop:backdrop-blur-[3px]";

/** The primary button in the source's shape: a flat slab with a hairline
 *  edge. The theme brings the radius and the variant the colours. */
export const primaryLook =
    "h-auto min-w-0 border p-3.5 font-[Arial,Helvetica,sans-serif] font-bold shadow-none";
