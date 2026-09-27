// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { Vector3 } from "three";
import { expect, it } from "vitest";
import { SaveIndicator } from "../../src/hud/SaveIndicator";
import { createGameStores, GameStoresContext } from "@spawnite/engine";
import { heroBuilder } from "../helpers/heroBuilder";

//  One for the file: the second case reads the count the first one raised.
const stores = createGameStores("three-mmorpg");

function renderIndicator() {
    return render(
        <GameStoresContext value={stores}>
            <SaveIndicator />
        </GameStoresContext>,
    );
}

//  The fill and the fade are asserted in the story's play function, which runs
//  in a browser. What jsdom is for here is the live region: it has to be
//  watched before it fills, or a screen reader announces nothing. Whether
//  VoiceOver speaks the word is read by hand; this pins the DOM it reads.

//  Every save writes a different position, because a payload identical to the
//  last one is a save the store skips, and a skipped save raises no count.
function save(distance: number) {
    act(() => {
        stores.save.getState().writeSave({
            hero: heroBuilder()
                .at(new Vector3(distance, 0.5, 2))
                .withHealth(80)
                .toSave(),
        });
    });
}

it("appears when a save lands", () => {
    const { unmount } = renderIndicator();
    try {
        //  The same region throughout: a live region that arrives with the
        //  news already in it is one nothing was watching.
        const status = screen.getByRole("status");
        expect(status).toBeEmptyDOMElement();

        save(7);

        expect(status).toHaveTextContent("Saved");
    } finally {
        unmount();
        localStorage.clear();
    }
});

it("names every save, and fills the ring again for each one", () => {
    const { unmount } = renderIndicator();
    try {
        const status = screen.getByRole("status");
        //  A save has already landed by now, in the case above. Whatever the
        //  count is when the region mounts has already happened, and a region
        //  that arrives full is one nothing was watching.
        expect(status).toBeEmptyDOMElement();

        save(11);

        const announcement = within(status).getByText("Saved");
        const glyph = status.querySelector("[aria-hidden]");
        expect(glyph).not.toBeNull();

        //  A second save while the first is still showing: both the words and
        //  the glyph mount again, which is what restarts the fill and what
        //  gives the region something to read. Text that never changed is a
        //  save a screen reader passes over.
        save(13);

        expect(within(status).getByText("Saved")).not.toBe(announcement);
        expect(status.querySelector("[aria-hidden]")).not.toBe(glyph);
    } finally {
        unmount();
        localStorage.clear();
    }
});
