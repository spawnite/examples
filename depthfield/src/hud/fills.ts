//  A fill's share as a Tailwind class, in twentieths: the primitives take a
//  class and no style, so a bar that follows a value picks the class nearest
//  it. Written out whole, because Tailwind emits only the classes it reads.
//  ponytail: twentieths, close enough for a cooldown and a damage bar; a
//  primitive fill that takes its share would lift it (the pull request's
//  engine gaps).

const widths = [
    "w-[0%]",
    "w-[5%]",
    "w-[10%]",
    "w-[15%]",
    "w-[20%]",
    "w-[25%]",
    "w-[30%]",
    "w-[35%]",
    "w-[40%]",
    "w-[45%]",
    "w-[50%]",
    "w-[55%]",
    "w-[60%]",
    "w-[65%]",
    "w-[70%]",
    "w-[75%]",
    "w-[80%]",
    "w-[85%]",
    "w-[90%]",
    "w-[95%]",
    "w-[100%]",
];

const heights = [
    "h-[0%]",
    "h-[5%]",
    "h-[10%]",
    "h-[15%]",
    "h-[20%]",
    "h-[25%]",
    "h-[30%]",
    "h-[35%]",
    "h-[40%]",
    "h-[45%]",
    "h-[50%]",
    "h-[55%]",
    "h-[60%]",
    "h-[65%]",
    "h-[70%]",
    "h-[75%]",
    "h-[80%]",
    "h-[85%]",
    "h-[90%]",
    "h-[95%]",
    "h-[100%]",
];

function readStep(share: number) {
    return Math.round(Math.max(0, Math.min(1, share)) * 20);
}

/** The width class nearest `share`, 0 to 1. */
export function readWidthClass(share: number) {
    return widths[readStep(share)];
}

/** The height class nearest `share`, 0 to 1. */
export function readHeightClass(share: number) {
    return heights[readStep(share)];
}
