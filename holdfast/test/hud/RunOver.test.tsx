import { act, render } from "@testing-library/react";
import type { Entity } from "koota";
import { useTrait, WorldProvider } from "koota/react";
import { expect, it } from "vitest";
import { CameraTrait, createGameWorld, readStrafe } from "@spawnite/engine";
import { useRunEndCursor } from "../../src/hud/RunOver";
import { SiegePhase, SiegeTrait } from "../../src/siege/traits";

//  The run's end as the engine sees it: a camera that stops wanting the
//  cursor is one the engine lets go with no menu, so the end screen's
//  button takes a click; one that wants it back and does not hold it is one
//  the engine shows Play for. The engine's own tests pin those two answers
//  (packages/engine/test/components/PlayMenu.test.tsx, the run's end); this
//  pins what Holdfast asks of the camera at each moment.

interface RunEndCursorProps {
    siege: Entity;
}

/** The end screen's hold on the cursor, as RunOver takes it, with none of
 *  the screen it draws. */
function RunEndCursor({ siege }: RunEndCursorProps) {
    const phase = useTrait(siege, SiegeTrait)?.phase;
    useRunEndCursor(phase === SiegePhase.Over);
    return null;
}

function renderRunEnd(phase: SiegePhase) {
    const world = createGameWorld();
    world.spawn(CameraTrait({ locked: true }));
    const siege = world.spawn(SiegeTrait({ phase }));
    const { unmount } = render(
        <WorldProvider world={world}>
            <RunEndCursor siege={siege} />
        </WorldProvider>,
    );
    return {
        wantsCursor: () => readStrafe(world),
        setPhase: (next: SiegePhase) =>
            act(() => siege.set(SiegeTrait, { phase: next })),
        unmount: () => {
            unmount();
            world.destroy();
        },
    };
}

it("gives up the cursor when the last warden falls", () => {
    const run = renderRunEnd(SiegePhase.Fight);
    expect(run.wantsCursor()).toBe(true);

    run.setPhase(SiegePhase.Over);

    expect(run.wantsCursor()).toBe(false);
    run.unmount();
});

//  Go again from every warden and the lobby's timer both start the next run
//  in its first breather.
it("wants the cursor back when the next run starts, by Go again or by the lobby's timer", () => {
    const run = renderRunEnd(SiegePhase.Over);
    expect(run.wantsCursor()).toBe(false);

    run.setPhase(SiegePhase.Breather);

    expect(run.wantsCursor()).toBe(true);
    run.unmount();
});
