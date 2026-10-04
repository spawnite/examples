import { vi } from "vitest";
import { phoneUprightQuery } from "../../src/hud/coarse";

/** A touch screen's media queries, as a page reads them: its coarse
 *  pointer, and, `upright`, a phone held upright. Undo it with
 *  `vi.unstubAllGlobals()`. */
export function stubTouchScreen({ upright = false } = {}) {
    const matching = [
        "(pointer: coarse)",
        ...(upright ? [phoneUprightQuery] : []),
    ];
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: matching.includes(query),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    }));
}
