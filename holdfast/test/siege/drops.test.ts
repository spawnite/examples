// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    DisconnectedTrait,
    fixedStepSeconds,
    TransformTrait,
    WalletTrait,
} from "@spawnite/engine";
import { shareCoins } from "../../src/siege/coins";
import { lastFallSeconds } from "../../src/siege/siege";
import { spawnMonster } from "../../src/siege/monsters";
import {
    EndCause,
    MonsterKind,
    SiegeTrait,
    WardenTrait,
} from "../../src/siege/traits";
import { firstBreatherSeconds, planWave } from "../../src/siege/waves";
import {
    fortify,
    holdWave,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    takePlaces,
    type OpenedSiege,
} from "./room";
import { LifeMachine } from "../../src/siege/life";
import { findSiege, PhaseMachine } from "../../src/siege/phase";

//  A warden whose player's connection dropped: the room keeps her hero,
//  and the siege leaves her out of what she cannot answer.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

async function openRun() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-4) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(4) });
    takePlaces(siege, ada, bo);
    return { game: siege, ada, bo };
}

it("holds the run where it stands while no warden is connected", async () => {
    const { game, ada, bo } = await openRun();
    game.step(2);
    const left = readSiege(game.world).secondsLeft;

    ada.add(DisconnectedTrait);
    bo.add(DisconnectedTrait);
    game.step(firstBreatherSeconds);

    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.breather,
        secondsLeft: left,
    });
});

it("holds the breather's last step when the last warden drops on it", async () => {
    const { game, ada, bo } = await openRun();
    const siegeEntity = findSiege(game.world);
    if (!siegeEntity) throw new Error("the siege has not begun");
    while (
        (PhaseMachine.read(siegeEntity).secondsLeft ?? 0) >
        fixedStepSeconds * 1.5
    )
        game.step(fixedStepSeconds);

    ada.add(DisconnectedTrait);
    bo.add(DisconnectedTrait);
    game.step(fixedStepSeconds * 3);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
});

it("ends the run once every connected warden is down, whatever a dropped one does", async () => {
    const { game, ada, bo } = await openRun();
    game.step(firstBreatherSeconds);

    bo.add(DisconnectedTrait);
    //  Her self-revive spent: alone, she would otherwise get herself up.
    ada.set(WardenTrait, { health: 0, selfRevive: false });
    game.step(lastFallSeconds + 0.1);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
    expect(game.world.queryFirst(SiegeTrait)?.get(SiegeTrait)?.cause).toBe(
        EndCause.FellAlone,
    );
});

it("keeps the monsters off a dropped warden, and her health whole", async () => {
    const { game, bo } = await openRun();
    bo.add(DisconnectedTrait);
    const feet = bo.get(TransformTrait);
    if (!feet) throw new Error("No place.");
    spawnMonster(game.world, {
        kind: MonsterKind.Husk,
        position: feet.clone().setX(feet.x + 0.9),
        plan: planWave(1, 2),
    });

    game.step(2);

    const survivor = bo.get(WardenTrait);
    expect(survivor?.health).toBe(survivor?.maximum);
});

it("leaves a downed warden to the wardens whose player is connected, and pays the one who dropped her share", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(-5) });
    const cy = joinWarden(siege, { name: "Cy", position: onField(12) });
    takePlaces(siege, ada, bo, cy);
    siege.step(firstBreatherSeconds + 0.1);
    for (const warden of [ada, bo, cy]) fortify(siege, warden);

    bo.add(DisconnectedTrait);
    ada.set(WardenTrait, { health: 0 });
    siege.step(5);
    expect(ada.has(LifeMachine.is.down)).toBe(true);

    holdWave(siege);
    shareCoins(siege.world, { position: onField(-5), value: 11 });
    expect(bo.get(WalletTrait)?.coins).toBe(5);
    expect(ada.get(WalletTrait)?.coins).toBe(5);
});
