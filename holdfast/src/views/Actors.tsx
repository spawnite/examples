import type { Entity } from "koota";
import { Not } from "koota";
import { useQuery } from "koota/react";
import { memo, Suspense, type ReactNode } from "react";
import {
    HeroTrait,
    NetworkIdTrait,
    ScenePathTrait,
    TransformTrait,
    useEntityRef,
} from "@spawnite/engine";
import {
    BoltTrait,
    BurstTrait,
    MonsterTrait,
    SteamTrait,
} from "../siege/traits";
import { BoltView } from "./BoltView";
import { BurstView } from "./BurstView";
import { CoinField } from "./CoinView";
import { DownedMarker } from "./DownedMarker";
import { EffectPools } from "./effects/EffectPools";
import { StrikeView } from "./effects/StrikeView";
import { MonsterView } from "./monsters/MonsterView";
import { SteamView } from "./SteamView";
import { WardenView } from "./WardenView";

//  Everything the room's stream spawns that the scene does not draw: the
//  wardens, the monsters, the bolts, the bursts and the steam clouds, each
//  as this game draws it, the pools their effects draw from, and the
//  elements' strikes and the coins the room sends as events. The
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
//  the delta that spawns it, before React draws. Memoized, because the
//  query draws the list again on every spawn and destroy, and each actor
//  would draw its whole tree again with it.
const Actor = memo(function Actor({ entity }: ActorProps) {
    if (entity.has(HeroTrait))
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
    if (entity.has(BurstTrait))
        return (
            <Placed entity={entity}>
                <BurstView entity={entity} />
            </Placed>
        );
    if (entity.has(SteamTrait))
        return (
            <Placed entity={entity}>
                <SteamView entity={entity} />
            </Placed>
        );
    return null;
});

export function Actors() {
    const entities = useQuery(
        NetworkIdTrait,
        TransformTrait,
        Not(ScenePathTrait),
    );
    return (
        //  Its own boundary, so a view that suspends hides none of the rest.
        <Suspense fallback={null}>
            <EffectPools />
            <StrikeView />
            <CoinField />
            {entities.map((entity) => (
                <Actor key={entity} entity={entity} />
            ))}
        </Suspense>
    );
}
