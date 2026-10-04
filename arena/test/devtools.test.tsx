// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import {
    createGameWorld,
    NetworkIdTrait,
    PlayerNameTrait,
    RoomStatus,
    useRoom,
    WireFormat,
} from "@spawnite/engine";
import { WorldProvider } from "koota/react";
import { afterEach, expect, it, vi } from "vitest";
import { reopenOnWire, RoomPanel } from "../src/app/devtools";

afterEach(() => {
    useRoom.setState(useRoom.getInitialState(), true);
});

it("reads the room's status as a word, a player by name and a labelled rate", () => {
    useRoom.setState({ status: RoomStatus.Joined, snapshotsPerSecond: 24 });
    const world = createGameWorld();
    world.spawn(NetworkIdTrait({ id: "1" }), PlayerNameTrait({ name: "Ada" }));
    const { unmount } = render(
        <WorldProvider world={world}>
            <RoomPanel />
        </WorldProvider>,
    );

    try {
        //  Each pair is a label beside its value in the same row, so a
        //  swapped label would fail here rather than pass on an unrelated
        //  match elsewhere in the panel.
        expect(screen.getByText("status").nextElementSibling).toHaveTextContent(
            RoomStatus.Joined,
        );
        expect(
            screen.getByText("players").nextElementSibling,
        ).toHaveTextContent("Ada");
        expect(
            screen.getByText("snapshots/s").nextElementSibling,
        ).toHaveTextContent("24");
    } finally {
        unmount();
        world.destroy();
    }
});

it("reads the round trip, the draw delay and her shots refused for their origin", () => {
    useRoom.setState({
        roundTripMilliseconds: 102.4,
        interpolationMilliseconds: 64.6,
        refusedShotOrigins: 4,
    });
    const world = createGameWorld();
    const { unmount } = render(
        <WorldProvider world={world}>
            <RoomPanel />
        </WorldProvider>,
    );

    try {
        expect(
            screen.getByText("round trip ms").nextElementSibling,
        ).toHaveTextContent("102");
        expect(
            screen.getByText("draw delay ms").nextElementSibling,
        ).toHaveTextContent("65");
        expect(
            screen.getByText("refused origins").nextElementSibling,
        ).toHaveTextContent("4");
    } finally {
        unmount();
        world.destroy();
    }
});

it("names the wire the page reads and reopens it on the other", () => {
    window.history.replaceState(null, "", "/?name=Ada");
    const world = createGameWorld();
    const { unmount } = render(
        <WorldProvider world={world}>
            <RoomPanel />
        </WorldProvider>,
    );

    try {
        const wire = screen.getByText("wire").nextElementSibling;
        expect(wire).toHaveTextContent("binary");
        //  The page reads its room once, as it mounts, so the switch is a
        //  reload on the other wire; jsdom reports the reload as missing.
        fireEvent.click(screen.getByRole("button", { name: "JSON" }));
        expect(window.location.search).toBe("?name=Ada&wire=json");
    } finally {
        unmount();
        world.destroy();
        window.history.replaceState(null, "", "/");
    }
});

it("reloads the page on the wire it switches to, and drops the query for binary", () => {
    window.history.replaceState(null, "", "/?name=Ada&wire=json");
    const reload = vi.fn();

    try {
        reopenOnWire(WireFormat.Binary, reload);

        expect(window.location.search).toBe("?name=Ada");
        expect(reload).toHaveBeenCalledOnce();
    } finally {
        window.history.replaceState(null, "", "/");
    }
});
