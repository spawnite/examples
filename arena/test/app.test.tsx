import { act, fireEvent, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { loadRapier, useVoice } from "@spawnite/engine";
import App from "../src/app/app";

//  jsdom has no WebGL: the canvas is a div that renders its children, as
//  the engine's own sample test mounts them, and the engine leaves out the
//  views that draw the world, turned off below: see
//  https://create.spawnite.com/engine/testing/devtools/#a-whole-game-in-jsdom
vi.mock("@react-three/fiber", () => {
    //  What a selector reads: the camera's canvas in the page, no pointer
    //  events on it, and the frameloop behind `get`. The devtools overlay,
    //  which can mount before a case ends, has the loop time its frames,
    //  which wraps the renderer's render and brackets it with fiber's
    //  global effects.
    const three = {
        get: () => ({
            frameloop: "always",
            setFrameloop: () => undefined,
            invalidate: () => undefined,
            gl: {
                render: () => undefined,
                getContext: () => ({ getExtension: () => null }),
            },
        }),
        gl: { domElement: document.createElement("canvas") },
        events: { connected: undefined },
    };
    return {
        Canvas: ({ children, ...props }: PropsWithChildren) => (
            <div data-testid="canvas" {...props}>
                {children}
            </div>
        ),
        useFrame: () => undefined,
        extend: () => undefined,
        useThree: (select: (state: typeof three) => unknown) => select(three),
        addEffect: () => () => undefined,
        addAfterEffect: () => () => undefined,
    };
});
vi.mock("@react-three/drei", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@react-three/drei")>()),
    CameraControls: () => null,
}));

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
    expect(screen.getByText("Connecting to the room.")).toBeInTheDocument();
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
    expect(socket.sent.map((text) => JSON.parse(text))).toEqual([
        { type: "join", name: "Ada", wire: "binary-2" },
    ]);
});

it("asks the room for JSON text when the address says wire=json", async () => {
    window.history.replaceState(null, "", "/?name=Ada&wire=json");
    await renderApp();
    const [socket] = sockets;

    act(() => {
        socket.dispatchEvent(new Event("open"));
    });

    expect(socket.sent.map((text) => JSON.parse(text))).toEqual([
        { type: "join", name: "Ada", wire: "json" },
    ]);
});

it("offers her microphone on once the room opens voice, and turns it off", async () => {
    await renderApp();
    expect(
        screen.queryByRole("button", { name: "Microphone" }),
    ).not.toBeInTheDocument();

    act(() => useVoice.setState({ microphone: true }));
    const button = await screen.findByRole("button", { name: "Microphone" });
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);

    expect(useVoice.getState().muted).toBe(true);
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);

    expect(useVoice.getState().muted).toBe(false);
});
