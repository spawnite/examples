import { useTag, useWorld } from "koota/react";
import { Button, freeWalker, StuckTrait, usePlayer } from "@spawnite/engine";

export function UnstuckButton() {
    const world = useWorld();
    const stuck = useTag(usePlayer().entity, StuckTrait);
    if (!stuck) return null;
    return <Button onPress={() => freeWalker(world)}>Unstuck</Button>;
}
