import { act, fireEvent, render, screen } from "@testing-library/react";
import { useWorld } from "koota/react";
import { useState, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Game, Hud, Scene, type LevelId } from "@spawnite/engine";
import { bankCoins, readBank } from "../../src/bank";
import { Track } from "../../src/levels";
import { LookKind, LookPicker } from "../../src/lobby/LookPicker";
import { SpeedUpgrade } from "../../src/lobby/SpeedUpgrade";
import { TrackMap } from "../../src/lobby/TrackMap";
import { RiderId } from "../../src/ride/riders";
import { readProgress } from "../../src/shop";

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);

let world: ReturnType<typeof useWorld> | undefined;
afterEach(() => {
    world = undefined;
});

/** Mounts `children` in a lobby whose bank holds `coins`. */
async function openLobby(coins: number, children: ReactNode) {
    function Lobby() {
        world = useWorld();
        //  Before the first paint, so the controls draw the bank.
        useState(() => bankCoins(world!, coins));
        return <Hud>{children}</Hud>;
    }
    await act(async () => {
        render(
            <Game name="lobby-test" start="lobby" levels={Track}>
                <Scene name="lobby" component={Lobby} />
            </Game>,
        );
    });
}

const middle = { x: 0.5, y: 0.5 };

it("buys a Speed step with the dial's +, from the bank", async () => {
    await openLobby(3, <SpeedUpgrade at={middle} />);
    act(() => screen.getByRole("button", { name: "Buy Speed step 1" }).click());
    expect(screen.getByRole("meter", { name: "Speed" })).toHaveAttribute(
        "aria-valuenow",
        "1",
    );
    expect(readProgress(world!).step).toBe(1);
});

it("shows a look not owned with its price tag, and equips none", async () => {
    const shown: RiderId[] = [];
    function Picker() {
        const [look, setLook] = useState<RiderId>(RiderId.Penguin);
        return (
            <LookPicker
                kind={LookKind.Rider}
                shown={look}
                onShow={(next) => {
                    shown.push(next);
                    setLook(next);
                }}
                at={middle}
                spread={120}
            />
        );
    }
    await openLobby(0, <Picker />);
    expect(screen.queryByRole("button", { name: /Buy for/ })).toBeNull();
    act(() => screen.getByRole("button", { name: "Next animal" }).click());
    expect(shown).toEqual([RiderId.Bear]);
    expect(
        screen.getByRole("button", { name: "Buy for 50 coins" }),
    ).toBeInTheDocument();
    expect(readProgress(world!).rider).toBe(RiderId.Penguin);
});

it("takes a look's price from the bank at the tap, and flies the coins on", async () => {
    function Picker() {
        const [look, setLook] = useState<RiderId>(RiderId.Bear);
        return (
            <LookPicker
                kind={LookKind.Rider}
                shown={look}
                onShow={setLook}
                at={middle}
                spread={120}
            />
        );
    }
    await openLobby(70, <Picker />);
    act(() => screen.getByRole("button", { name: "Buy for 50 coins" }).click());
    expect(readBank(world!)).toBe(20);
    expect(readProgress(world!).riders).toContain(RiderId.Bear);
    //  The tag's owner drops it once the look is owned; its coins still fly.
    expect(
        document.body.querySelectorAll(":scope > [aria-hidden].fixed"),
    ).toHaveLength(6);
});

it("pins the first track as the next and locks the rest", async () => {
    function Map() {
        const [selected, setSelected] = useState<LevelId>(Track.One);
        return <TrackMap selected={selected} onSelect={setSelected} />;
    }
    await openLobby(0, <Map />);
    expect(screen.getByRole("button", { name: "Track 1" })).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Track 2, locked" }),
    ).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "To the desert, locked" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show the map" }));
    expect(
        screen.getByRole("button", { name: "Hide the map" }),
    ).toBeInTheDocument();
});

it("raises and lowers the map at a tap anywhere on its tab, and at a drag", async () => {
    await openLobby(0, <TrackMap selected={Track.One} onSelect={vi.fn()} />);
    const button = () =>
        screen.getByRole("button", { name: /^(Show|Hide) the map$/ });
    const tab = button().parentElement!;
    //  The white under the tab, clear of a phone's home bar.
    const strip = tab.parentElement!.lastElementChild!;
    const press = (
        target: Element,
        from: { x: number; y: number },
        to: { x: number; y: number },
        mouseButton = 0,
    ) => {
        fireEvent.pointerDown(target, {
            pointerId: 1,
            button: mouseButton,
            clientX: from.x,
            clientY: from.y,
        });
        fireEvent.pointerUp(tab, {
            pointerId: 1,
            button: mouseButton,
            clientX: to.x,
            clientY: to.y,
        });
    };
    const at = { x: 10, y: 100 };

    //  The tab's white margin, beside the button.
    press(tab, at, at);
    expect(button()).toHaveAccessibleName("Hide the map");
    press(tab, at, { x: 12, y: 102 });
    expect(button()).toHaveAccessibleName("Show the map");
    //  A tap on the button itself raises it once, by the button's press.
    press(button(), at, at);
    fireEvent.click(button());
    expect(button()).toHaveAccessibleName("Hide the map");
    //  A drag down lowers it, and the click it ends in changes nothing.
    press(button(), at, { x: 10, y: 160 });
    fireEvent.click(button());
    expect(button()).toHaveAccessibleName("Show the map");
    //  A drag across is neither a tap nor a drag up or down.
    press(tab, at, { x: 200, y: 100 });
    expect(button()).toHaveAccessibleName("Show the map");
    //  A right click opens the menu, and leaves the sheet as it was.
    press(tab, at, at, 2);
    expect(button()).toHaveAccessibleName("Show the map");
    //  The white strip under the tab raises the sheet and lowers it.
    fireEvent.click(strip);
    expect(button()).toHaveAccessibleName("Hide the map");
    fireEvent.click(strip);
    expect(button()).toHaveAccessibleName("Show the map");
});
