import { act, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
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
