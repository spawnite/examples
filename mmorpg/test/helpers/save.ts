import type { Vector3 } from "three";
import type { Save } from "@spawnite/schema";
import { heroBuilder } from "./heroBuilder";

//  One save fixture for every suite that needs one: when the save grows a
//  field, the hero builder grows it and this follows.
export function buildSave(position: Vector3, current = 100): Save {
    return { hero: heroBuilder().at(position).withHealth(current).toSave() };
}
