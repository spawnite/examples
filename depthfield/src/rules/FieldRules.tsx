import { createQuery, type World } from "koota";
import { useWorld } from "koota/react";
import { useEffect } from "react";
import {
    BlastTrait,
    BoltTrait,
    BoomerangTrait,
    DropTrait,
    EnemyTrait,
    EnemyShotTrait,
    GemTrait,
    LaserTrait,
    MineTrait,
    NovaTrait,
    RunTrait,
    StompTrait,
} from "./traits";
import { startRun, type RunStart } from "./run";

//  Every trait a thing on the field carries: the run's own entity and each
//  enemy, shot, drop and ring, which the field takes with it when it goes.
const fieldTraits = [
    RunTrait,
    EnemyTrait,
    BoltTrait,
    LaserTrait,
    BoomerangTrait,
    NovaTrait,
    MineTrait,
    EnemyShotTrait,
    BlastTrait,
    StompTrait,
    GemTrait,
    DropTrait,
];

function clearField(world: World) {
    for (const each of fieldTraits)
        for (const entity of world.query(createQuery(each))) entity.destroy();
}

interface FieldRulesProps {
    /** Starts the run as the field mounts, with no title: a restart, or a
     *  headless world an agent simulates. */
    start?: RunStart;
}

/** The run's entity, spawned as the field mounts and cleared with every
 *  thing on the field as it goes. */
export function FieldRules({ start }: FieldRulesProps) {
    const world = useWorld();
    useEffect(() => {
        clearField(world);
        world.spawn(RunTrait);
        if (start) startRun(world, start);
        return () => clearField(world);
    }, [world, start]);
    return null;
}
