// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { create } from "zustand";
import { SaveStatus } from "@spawnite/engine";
import { SaveIndicator } from "../../src/hud/SaveIndicator";

//  The save's status, as the engine's scheduler moves it, in place of a
//  Game's save.
const useStatus = create<{ status: SaveStatus }>()(() => ({
    status: SaveStatus.Saved,
}));
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    useSaveStatus: () => ({
        status: useStatus((state) => state.status),
        destination: "platform",
        problem: null,
        size: null,
    }),
}));

afterEach(() => useStatus.setState({ status: SaveStatus.Saved }));

function renderIndicator() {
    return render(<SaveIndicator />);
}

//  The fill and the fade are asserted in the story's play function, which runs
//  in a browser. What jsdom is for here is the live region: it has to be
//  watched before it fills, or a screen reader announces nothing. Whether
//  VoiceOver speaks the word is read by hand; this pins the DOM it reads.

/** A change, then its write landing, as the scheduler reports them. */
function save() {
    act(() => useStatus.setState({ status: SaveStatus.Unsaved }));
    act(() => useStatus.setState({ status: SaveStatus.Saving }));
    act(() => useStatus.setState({ status: SaveStatus.Saved }));
}

it("appears when a save lands", () => {
    const { unmount } = renderIndicator();
    try {
        //  The same region throughout: a live region that arrives with the
        //  news already in it is one nothing was watching.
        const status = screen.getByRole("status");
        expect(status).toBeEmptyDOMElement();

        save();

        expect(status).toHaveTextContent("Saved");
    } finally {
        unmount();
    }
});

it("names every save, and fills the ring again for each one", () => {
    const { unmount } = renderIndicator();
    try {
        const status = screen.getByRole("status");
        //  A save that landed before the region mounted has already
        //  happened, and a region that arrives full is one nothing was
        //  watching.
        expect(status).toBeEmptyDOMElement();

        save();

        const announcement = within(status).getByText("Saved");
        const glyph = status.querySelector("[aria-hidden]");
        expect(glyph).not.toBeNull();

        //  A second save while the first is still showing: both the words and
        //  the glyph mount again, which is what restarts the fill and what
        //  gives the region something to read. Text that never changed is a
        //  save a screen reader passes over.
        save();

        expect(within(status).getByText("Saved")).not.toBe(announcement);
        expect(status.querySelector("[aria-hidden]")).not.toBe(glyph);
    } finally {
        unmount();
    }
});

it("shows nothing for a status that is no landed save: loading, a change waiting, a refusal", () => {
    const { unmount } = renderIndicator();
    try {
        const status = screen.getByRole("status");
        act(() => useStatus.setState({ status: SaveStatus.Unsaved }));
        act(() => useStatus.setState({ status: SaveStatus.Saving }));
        act(() => useStatus.setState({ status: SaveStatus.Refused }));
        expect(status).toBeEmptyDOMElement();
    } finally {
        unmount();
    }
});
