import {
    addItem,
    countItem,
    Dialog,
    dialog,
    Faction,
    Interact,
    Npc,
    NpcEvent,
    route,
    routines,
} from "@spawnite/engine";
import { avatars, AvatarId } from "../avatars";

//  Her day: the market round with a stop at the well, a rest on the bench,
//  and a hello for whoever comes close. Her conversation is below.
const market = route({
    stall: [-6, 0, -4],
    well: [-8, 0, -8],
    herbs: [-3, 0, -9],
});
const bench = route({ bench: [-2, 0, -4] });

const mira = routines("mira")
    .routine("morning", (r) =>
        r
            .walk(market, { pause: { well: 4 } })
            .wait(3)
            .then("rest"),
    )
    .routine("rest", (r) =>
        r
            .walk(bench)
            .wait({ between: [20, 40] })
            .say("*yawns*")
            .then("morning"),
    )
    .routine("greet", (r) => r.face().say("Hello!").resume())
    .on(NpcEvent.Approached, "greet")
    .start("morning");

//  She gives a player a potion while the player's bag holds fewer than
//  `spareBelow` of them.
const talk = dialog("mira", { gift: "potion", spareBelow: 2 })
    .node("hello", (n) =>
        n
            .say(
                "Morning, {player}! I'm {npc}. The meadow is kind to herb folk.",
            )
            .choice("What do you gather?", "herbs")
            .choice("Could you spare a potion?", "gift", {
                when: ({ player, values }) =>
                    countItem(player, values.gift) < values.spareBelow,
            })
            .choice("Just passing by.", "bye"),
    )
    .node("herbs", (n) =>
        n
            .say(
                "Moonleaf by the well, redcap past the bench. Boiled right, they make a {gift}.",
            )
            .choice("Back to the start.", "hello")
            .choice("Thanks, Mira.", "bye"),
    )
    .node("gift", (n) =>
        n
            .do(({ player, values }) =>
                addItem(player, { item: values.gift, count: 1 }),
            )
            .say("Here, take a {gift}. Mind the wolves past the well.")
            .choice("Thank you!", "bye"),
    )
    .node("bye", (n) => n.say("Safe roads, {player}.").end())
    .start("hello");

export function Mira() {
    return (
        <Npc
            name="Mira"
            title="Herbalist"
            level={5}
            faction={Faction.Friendly}
            avatar={avatars[AvatarId.Chifa]}
            position={[-3, 0, -3]}
            routines={mira}
        >
            <Interact prompt="Talk" />
            <Dialog tree={talk} />
        </Npc>
    );
}
