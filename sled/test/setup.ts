import { afterEach } from "vitest";

// Keep DOM libraries out of tests that use the default Node environment.
if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    await import("@testing-library/jest-dom/vitest");
    afterEach(cleanup);
}
