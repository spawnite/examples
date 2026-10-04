import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { loadRapier, useVoice, WireFormat } from "@spawnite/engine";
import App from "../src/app/app";

//  jsdom has no WebGL, and the views are off below: see
//  https://wiki.spawnite.com/engine/testing/devtools/#a-whole-game-in-jsdom
vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);
vi.mock("@react-three/drei", async (importOriginal) =>
    (await import("@spawnite/testing/fiber")).fakeDrei(importOriginal),
);

/** The sockets the app opened, which never connect: the room is not
 *  running, and the app is only asked where it would go and as whom. */
const sockets: FakeSocket[] = [];

class FakeSocket extends EventTarget {
    readonly sent: string[] = [];
    constructor(readonly url: string) {
        super();
        sockets.push(this);
    }
    send(text: string) {
        this.sent.push(text);
    }
    close() {
        this.dispatchEvent(new Event("close"));
    }
}

//  The loop suspends until the physics wasm is loaded; loaded first, the
//  render inside act settles in one pass.
beforeAll(loadRapier);
//  Never unstubbed here: the setup's cleanup unmounts the app after this
//  file's afterEach, and a render in between would mount the views.
beforeEach(() => vi.stubEnv("GAME_ENGINE_VIEWS", "off"));
afterEach(() => {
    sockets.length = 0;
    useVoice.setState(useVoice.getInitialState(), true);
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
});

async function renderApp() {
    vi.stubGlobal("WebSocket", FakeSocket);
    await act(async () => {
        render(<App />);
    });
}

it("opens the arena with the scoreboard, the instructions and the room connecting", async () => {
    await renderApp();

    expect(screen.getByTestId("canvas")).toHaveAttribute(
        "data-game-name",
        "arena",
    );
    expect(screen.getByText("Coins")).toBeInTheDocument();
    expect(
        await screen.findByText(
            "WASD walks and the mouse looks. A click shoots, a right click slings a stone. Grab the coins.",
        ),
    ).toBeInTheDocument();
    expect(screen.getByText("Joining the game…")).toBeInTheDocument();
    expect(sockets.map((socket) => socket.url)).toEqual([
        "ws://localhost:8787",
    ]);
});

it("joins the room the address names, under the name it names", async () => {
    window.history.replaceState(
        null,
        "",
        "/?room=ws://room.test:9000&name=Ada",
    );
    await renderApp();
    const [socket] = sockets;

    act(() => {
        socket.dispatchEvent(new Event("open"));
    });

    expect(socket.url).toBe("ws://room.test:9000");
    //  The engine adds what its own client predicts to the join.
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toMatchObject({
        type: "join",
        name: "Ada",
        wire: WireFormat.Binary,
    });
});

it("asks the room for JSON text when the address says wire=json", async () => {
    window.history.replaceState(null, "", "/?name=Ada&wire=json");
    await renderApp();
    const [socket] = sockets;

    act(() => {
        socket.dispatchEvent(new Event("open"));
    });

    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toMatchObject({
        type: "join",
        name: "Ada",
        wire: "json",
    });
});
