import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Phase } from "../../src/siege/phase";
import { showPhase } from "./phase";
import { WorldProvider } from "koota/react";
import { afterEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    HeroTrait,
    type PanelProps,
    Slot,
    useRoom,
    WalletTrait,
} from "@spawnite/engine";
import { CardPick } from "../../src/hud/CardPick";
import { useHand } from "../../src/hud/hand";
import { CardId, offerCards } from "../../src/siege/cards";
import { SiegeTrait, WardenTrait } from "../../src/siege/traits";
import { createPageWorld } from "./pageWorld";
import { stubTouchScreen } from "./pointer";

//  The HUD layer lives in the canvas; here it draws in place, each Panel
//  marked with its slot.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children, slot }: Pick<PanelProps, "children" | "slot">) => (
        <div data-slot={slot}>{children}</div>
    ),
}));

afterEach(() => {
    vi.unstubAllGlobals();
    useRoom.setState(useRoom.getInitialState(), true);
    useHand.setState(useHand.getInitialState(), true);
    document.body.replaceChildren();
});

/** Three cards on offer in `phase`, a breather when left out, to a
 *  warden with `catchUp` cards still to take, and the room's sends
 *  recorded. */
function renderOffer(
    phase: Phase = "breather",
    catchUp = 0,
    offer: readonly string[] = [
        CardId.HeavyRounds,
        CardId.HairTrigger,
        CardId.FleetFoot,
    ],
) {
    const sendMessage = vi.fn();
    useRoom.setState({ sendMessage });
    const world = createPageWorld();
    showPhase(world.spawn(SiegeTrait), phase);
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        WardenTrait({
            offer: offerCards(offer),
            catchUp,
        }),
    );
    const { container, unmount } = render(
        <WorldProvider world={world}>
            <CardPick />
        </WorldProvider>,
    );
    return {
        sendMessage,
        world,
        /** The slot the hand stands in. */
        readSlot: () =>
            container
                .querySelector(".card-hand")
                ?.closest("[data-slot]")
                ?.getAttribute("data-slot"),
        unmount: () => {
            unmount();
            world.destroy();
        },
    };
}

it("takes a card on its number key", () => {
    const { sendMessage, unmount } = renderOffer();

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit2" }));

    expect(sendMessage).toHaveBeenCalledWith({
        name: "siege.pick",
        payload: { slot: 1 },
    });
    unmount();
});

it("takes a card on its number key mid-wave while she catches up", () => {
    const { sendMessage, unmount } = renderOffer("fight", 2);

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit3" }));

    expect(sendMessage).toHaveBeenCalledWith({
        name: "siege.pick",
        payload: { slot: 2 },
    });
    unmount();
});

it("takes no card mid-wave from a warden with none to catch up", () => {
    const { sendMessage, unmount } = renderOffer("fight");

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit3" }));

    expect(sendMessage).not.toHaveBeenCalled();
    unmount();
});

it("takes no card on a number typed into a text field", () => {
    const { sendMessage, unmount } = renderOffer();
    const field = document.body.appendChild(document.createElement("input"));

    field.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Digit2", bubbles: true }),
    );

    expect(sendMessage).not.toHaveBeenCalled();
    unmount();
});

it("rerolls the offer on 4 where her purse meets the price, and sends nothing where it does not", async () => {
    const run = renderOffer();
    const hero = run.world.queryFirst(HeroTrait);
    hero?.add(WalletTrait({ coins: 5 }));
    await act(async () => undefined);

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit4" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Digit4" }));
    const short = run.sendMessage.mock.calls.length;
    act(() => hero?.set(WalletTrait, { coins: 10 }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit4" }));

    expect(short).toBe(0);
    expect(run.sendMessage).toHaveBeenCalledWith({
        name: "siege.reroll",
        payload: {},
    });
    run.unmount();
});

it("keeps the reroll on 4 once she has taken her free card and bought the other two", async () => {
    const run = renderOffer();
    const hero = run.world.queryFirst(HeroTrait);
    hero?.add(WalletTrait({ coins: 10 }));
    const warden = hero?.get(WardenTrait);
    hero?.set(WardenTrait, {
        ...warden,
        taken: CardId.HeavyRounds,
        bought: [CardId.HairTrigger, CardId.FleetFoot],
    });
    await act(async () => undefined);

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit4" }));

    expect(run.sendMessage).toHaveBeenCalledWith({
        name: "siege.reroll",
        payload: {},
    });
    run.unmount();
});

const elements = [CardId.Storm, CardId.Ember, CardId.Frost];

/** The slots of the element pick and of a breather's hand. */
function readHandSlots() {
    const picking = renderOffer("waiting", 0, elements);
    const pick = picking.readSlot();
    picking.unmount();
    const resting = renderOffer("breather");
    const breather = resting.readSlot();
    resting.unmount();
    return [pick, breather];
}

it("deals the hand at the top of a phone held upright, the element pick and a breather's hand alike", () => {
    stubTouchScreen({ upright: true });

    expect(readHandSlots()).toEqual([Slot.Top, Slot.Top]);
});

it("keeps the element pick in the middle and a breather's hand at the bottom on a computer and on a phone on its side", () => {
    const computer = readHandSlots();
    stubTouchScreen();
    const sideways = readHandSlots();

    expect([...computer, ...sideways]).toEqual([
        Slot.Center,
        Slot.Bottom,
        Slot.Center,
        Slot.Bottom,
    ]);
});
