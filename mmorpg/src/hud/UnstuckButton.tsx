import { useTag, useWorld } from "koota/react";
import { Button, freeWalker, Stuck, usePlayer } from "@spawnite/engine";

export function UnstuckButton() {
    const world = useWorld();
    const stuck = useTag(usePlayer().entity, Stuck);
    if (!stuck) return null;
    return <Button onPress={() => freeWalker(world)}>Unstuck</Button>;
}
