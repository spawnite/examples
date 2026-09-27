import type { Entity } from "koota";
import { Not } from "koota";
import { useQuery } from "koota/react";
import { Suspense, type ReactNode } from "react";
import {
    Hero,
    NetworkId,
    ScenePath,
    Transform,
    useEntityRef,
} from "@spawnite/engine";
import {
    BoltTrait,
    BurstTrait,
    CoinTrait,
    MonsterTrait,
} from "../siege/traits";
import { BoltView } from "./BoltView";
import { BurstView } from "./BurstView";
import { CoinView } from "./CoinView";
import { DownedMarker } from "./DownedMarker";
import { EffectPools } from "./effects/EffectPools";
import { MonsterView } from "./monsters/MonsterView";
import { WardenView } from "./WardenView";

//  Everything the room's stream spawns that the scene does not draw: the
//  wardens, the monsters, the bolts, the coins and the bursts, each
//  as this game draws it, and the pools their effects draw from. The
//  engine's Replicas draws every hero as its placeholder capsule, so the
//  game draws them all itself, placed as Replicas places them.

interface ActorProps {
    entity: Entity;
}

interface PlacedProps extends ActorProps {
    children: ReactNode;
}

/** A group the loop places where the stream puts `entity`. */
function Placed({ entity, children }: PlacedProps) {
    return <group ref={useEntityRef(entity)}>{children}</group>;
}

//  What an entity is, read once: the stream writes a new entity's traits in
//  the delta that spawns it, before React draws.
function Actor({ entity }: ActorProps) {
    if (entity.has(Hero))
        return (
            <WardenView entity={entity}>
                <DownedMarker entity={entity} />
            </WardenView>
        );
    if (entity.has(MonsterTrait)) return <MonsterView entity={entity} />;
    if (entity.has(BoltTrait))
        return (
            <Placed entity={entity}>
                <BoltView entity={entity} />
            </Placed>
        );
    if (entity.has(CoinTrait))
        return (
            <Placed entity={entity}>
                <CoinView entity={entity} />
            </Placed>
        );
    if (entity.has(BurstTrait))
        return (
            <Placed entity={entity}>
                <BurstView entity={entity} />
            </Placed>
        );
    return null;
}

export function Actors() {
    const entities = useQuery(NetworkId, Transform, Not(ScenePath));
    return (
        //  Its own boundary, so a view that suspends hides none of the rest.
        <Suspense fallback={null}>
            <EffectPools />
            {entities.map((entity) => (
                <Actor key={entity} entity={entity} />
            ))}
        </Suspense>
    );
}
