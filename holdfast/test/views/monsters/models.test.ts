import { expect, it } from "vitest";
import {
    listModelKinds,
    monsterModels,
    readModelDressing,
} from "../../../src/views/monsters/models";

//  Kinds dressed alike share their shaders, so the warm-up builds one rig
//  for each dressing, and a kind with a new one is warmed with no change
//  there.
it("names one kind for each way a model file is dressed, and every way", () => {
    const dressings = listModelKinds().map((kind) =>
        readModelDressing(monsterModels[kind]),
    );

    expect(dressings).toHaveLength(new Set(dressings).size);
    expect(new Set(dressings)).toEqual(
        new Set(Object.values(monsterModels).map(readModelDressing)),
    );
});
