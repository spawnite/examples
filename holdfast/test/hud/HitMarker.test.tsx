import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
    HitMark,
    LatestHitMark,
    markHit,
    settleHitMark,
    takeBackHitMark,
} from "../../src/hud/HitMarker";

it("shows nothing before a shot lands", () => {
    render(<LatestHitMark />);

    expect(screen.queryByLabelText("Hit")).toBeNull();
    expect(screen.queryByLabelText("Kill")).toBeNull();
});

it("draws a hit mark for a hit and a kill mark for a kill", () => {
    render(<LatestHitMark />);

    act(() => markHit(HitMark.Hit));
    expect(screen.getByLabelText("Hit")).toBeInTheDocument();

    act(() => markHit(HitMark.Kill));
    expect(screen.getByLabelText("Kill")).toBeInTheDocument();
    expect(screen.queryByLabelText("Hit")).toBeNull();
});

it("keeps the kill mark up for its fade, then takes it off the page", () => {
    vi.useFakeTimers();
    try {
        render(<LatestHitMark />);

        act(() => markHit(HitMark.Kill));
        act(() => vi.advanceTimersByTime(200));
        expect(screen.getByLabelText("Kill")).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(50));
        expect(screen.queryByLabelText("Kill")).toBeNull();
    } finally {
        vi.useRealTimers();
    }
});

it("keeps a second mark for its whole fade after the first ends", () => {
    vi.useFakeTimers();
    try {
        render(<LatestHitMark />);

        act(() => markHit(HitMark.Hit));
        act(() => vi.advanceTimersByTime(200));
        act(() => markHit(HitMark.Hit));
        act(() => vi.advanceTimersByTime(200));
        expect(screen.getByLabelText("Hit")).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(50));
        expect(screen.queryByLabelText("Hit")).toBeNull();
    } finally {
        vi.useRealTimers();
    }
});

it("takes a mark back when the room refuses the shot that drew it", () => {
    render(<LatestHitMark />);

    act(() => markHit(HitMark.Kill, [7, 8]));
    act(() => takeBackHitMark(8));

    expect(screen.queryByLabelText("Kill")).toBeNull();
});

it("keeps a later shot's mark when the room refuses an earlier shot", () => {
    render(<LatestHitMark />);

    act(() => markHit(HitMark.Hit, [7]));
    act(() => markHit(HitMark.Hit, [9]));
    act(() => takeBackHitMark(7));

    expect(screen.getByLabelText("Hit")).toBeInTheDocument();
});

it("draws a critical mark for a hit on a weak spot, and a critical kill mark for a kill there", () => {
    render(<LatestHitMark />);

    act(() => markHit(HitMark.Hit, [], true));
    expect(screen.getByLabelText("Critical hit")).toBeInTheDocument();

    act(() => markHit(HitMark.Kill, [], true));
    expect(screen.getByLabelText("Critical kill")).toBeInTheDocument();
});

it("turns a critical mark plain when the room judges its shot struck no weak spot, and critical when it did", () => {
    render(<LatestHitMark />);

    act(() => markHit(HitMark.Hit, [7], true));
    act(() => settleHitMark(7, false));
    expect(screen.getByLabelText("Hit")).toBeInTheDocument();

    act(() => settleHitMark(7, true));
    expect(screen.getByLabelText("Critical hit")).toBeInTheDocument();
});

it("keeps a later shot's critical mark when the room's word is on an earlier shot", () => {
    render(<LatestHitMark />);

    act(() => markHit(HitMark.Hit, [7], true));
    act(() => markHit(HitMark.Hit, [9], true));
    act(() => settleHitMark(7, false));

    expect(screen.getByLabelText("Critical hit")).toBeInTheDocument();
});

it("keeps a mark two shots drew critical when the room judges one of them struck a weak spot and the other did not", () => {
    render(<LatestHitMark />);

    act(() => markHit(HitMark.Hit, [7, 8], true));
    act(() => settleHitMark(7, true));
    act(() => settleHitMark(8, false));

    expect(screen.getByLabelText("Critical hit")).toBeInTheDocument();
});
