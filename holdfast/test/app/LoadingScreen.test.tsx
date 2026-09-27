import { act, render, screen } from "@testing-library/react";
import { useProgress } from "@react-three/drei";
import { afterEach, expect, it } from "vitest";
import {
    HoldfastLoadingScreen,
    readLoadShare,
} from "../../src/app/LoadingScreen";

afterEach(() => {
    useProgress.setState({ loaded: 0, total: 0 });
});

it("counts the engine's steps and the files landed as half the load each", () => {
    expect(readLoadShare({ steps: 0.4, filesLoaded: 3, filesTotal: 4 })).toBe(
        0.575,
    );
    //  Before a file is asked for, the files count for nothing yet.
    expect(readLoadShare({ steps: 0.4, filesLoaded: 0, filesTotal: 0 })).toBe(
        0.2,
    );
});

it("shows the share landed and never moves back when more files are asked for", () => {
    act(() => useProgress.setState({ loaded: 4, total: 4 }));
    const { rerender } = render(<HoldfastLoadingScreen value={0.6} />);
    const bar = screen.getByRole("progressbar", { name: "Loading" });
    expect(bar).toHaveAttribute("aria-valuenow", "80");

    //  Four more files start: the files landed fall to half.
    act(() => useProgress.setState({ loaded: 4, total: 8 }));
    rerender(<HoldfastLoadingScreen value={0.6} />);
    expect(bar).toHaveAttribute("aria-valuenow", "80");

    act(() => useProgress.setState({ loaded: 8, total: 8 }));
    rerender(<HoldfastLoadingScreen value={1} />);
    expect(bar).toHaveAttribute("aria-valuenow", "100");
});
