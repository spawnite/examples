import { afterEach, vi } from "vitest";

// Keep DOM libraries out of tests that use the default Node environment.
if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    await import("@testing-library/jest-dom/vitest");
    afterEach(cleanup);
}

//  jsdom has no matchMedia, and the devtools overlay reads it to tell a phone
//  from a desktop. A desktop, so every panel shows. The cast: the four
//  members are all the overlay reads of the list.
if (typeof window !== "undefined" && !window.matchMedia) {
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList;
}
