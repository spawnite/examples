import { useEffect } from "react";
import {
    DisplayName,
    Entity,
    Faction,
    Health,
    NetworkIdTrait,
    Respawn,
    TargetableTrait,
    useEntity,
    type Position,
} from "@spawnite/engine";
import { Flinch } from "../behaviours/Flinch";
import "../models";

//  Past the well on Mira's round, at (-8, -8), where she tells a player
//  to mind the wolves: on the level ground before the meadow's edge rises.
const dens: Position[] = [
    [-12, 0, -12],
    [-14.5, 0, -9.5],
    [-10, 0, -14.5],
];

/** Marks its entity as a target every ability may strike. A wolf a room
 *  streams carries the room's own mark. */
function Hostile() {
    const entity = useEntity();
    useEffect(() => {
        if (entity.has(NetworkIdTrait)) return;
        entity.add(TargetableTrait({ faction: Faction.Hostile }));
        return () => {
            if (entity.isAlive()) entity.remove(TargetableTrait);
        };
    }, [entity]);
    return null;
}

/** One wolf: three bolts take its 60 health, a hit it survives flinches
 *  it, and at 0 it lies down and stands again 20 s later. Wolves do not
 *  fight back yet. */
export function Wolf({ position }: { position: Position }) {
    return (
        <Entity name="Wolf" model="wolf" animation="idle" position={position}>
            <DisplayName name="Wolf" />
            <Health maximum={60} />
            <Hostile />
            <Flinch clip="hit-left" />
            <Respawn seconds={20} clip="death" />
        </Entity>
    );
}

/** The wolves past the well. */
export function Wolves() {
    return dens.map((position) => (
        <Wolf key={position.join()} position={position} />
    ));
}
