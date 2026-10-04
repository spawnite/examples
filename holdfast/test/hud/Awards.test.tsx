import { render, screen } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import { afterEach, expect, it } from "vitest";
import { createGameWorld } from "@spawnite/engine";
import { Awards } from "../../src/hud/Awards";
import { Reaction } from "../../src/siege/elements";
import {
    type Award,
    AwardKind,
    AwardsTrait,
    SiegeTrait,
} from "../../src/siege/traits";

//  The run's awards as the dawn screen and the end screen show them: each
//  award named for the wardens who earned it, with its count in words.

afterEach(() => {
    document.body.replaceChildren();
});

/** Renders the awards the room set on the siege. */
function renderAwards(list: Award[]) {
    const world = createGameWorld();
    world.spawn(SiegeTrait, AwardsTrait({ list }));
    const { unmount } = render(
        <WorldProvider world={world}>
            <Awards />
        </WorldProvider>,
    );
    return () => {
        unmount();
        world.destroy();
    };
}

/** An award naming `names`, of the colours 0 and up. */
function award(
    kind: AwardKind,
    names: string[],
    value: number,
    reaction = "",
): Award {
    return {
        kind,
        wardens: names.map((name, hue) => ({ name, hue })),
        value,
        reaction,
    };
}

it("names each award's wardens and says what it counts", () => {
    const unmount = renderAwards([
        award(AwardKind.BestDuo, ["Ada", "Bo"], 37),
        award(AwardKind.TopReaction, ["Ada", "Bo"], 21, Reaction.ChainShock),
        award(AwardKind.TopDamage, ["Cy"], 12400),
        award(AwardKind.MostRevives, ["Bo"], 1),
        award(AwardKind.LastStanding, ["Di"], 18),
    ]);

    for (const name of [
        "Best duo",
        "Top reaction",
        "Top damage",
        "Most revives",
        "Last one standing",
    ])
        expect(screen.queryByText(name)).not.toBeNull();
    expect(screen.queryByText("37 reactions")).not.toBeNull();
    expect(screen.queryByText("Chain Shock ×21")).not.toBeNull();
    expect(screen.queryByText("12,400 damage")).not.toBeNull();
    expect(screen.queryByText("1 revive")).not.toBeNull();
    expect(screen.queryByText("18 s alone")).not.toBeNull();
    expect(screen.getAllByText("& Bo")).toHaveLength(2);
    unmount();
});

it("shows nothing where nobody earned an award", () => {
    const unmount = renderAwards([]);

    expect(screen.queryByText("Awards")).toBeNull();
    unmount();
});
