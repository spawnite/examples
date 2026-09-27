import { afterEach } from "vitest";

// Keep DOM libraries out of tests that use the default Node environment.
if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    await import("@testing-library/jest-dom/vitest");
    afterEach(cleanup);

    //  jsdom has no showModal or close: these set and clear `open`, which is
    //  what the browser's own do to the attribute.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        this.open = true;
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
        this.open = false;
    };
}
