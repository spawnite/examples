import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { HitMark, LatestHitMark, markHit } from "../../src/hud/HitMarker";

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
