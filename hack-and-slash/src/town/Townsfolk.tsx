import { Suspense, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useWorld } from "koota/react";
import {
    Anchor,
    BodyKind,
    Button,
    ColliderShape,
    engineActions,
    Entity,
    findPlayerHero,
    listenToAction,
    Panel,
    PanelVariant,
    Text,
    TransformTrait,
} from "@spawnite/engine";
import type { Entity as KootaEntity } from "koota";
import { FolkModel } from "../hero/HeroModel";
import { useTouch } from "../view/device";
import {
    folk,
    talkReach,
    talkTo,
    useTown,
    type Folk,
    type FolkId,
} from "./folk";

//  The town's people, standing at their places: each turns to face her as
//  she comes near, and over their name a Talk button shows while she is
//  near enough, as E does on a keyboard. Each stands solid, so she walks
//  round them.

export function Townsfolk() {
    //  Interact, E, talks to whoever she stands near.
    useEffect(() => {
        const stopTalk = listenToAction(engineActions.interact, {
            onPress: () => {
                const { near, talking } = useTown.getState();
                if (near && !talking) talkTo(near);
            },
        });
        //  A development playtest's handle on who she stands near.
        if (import.meta.env.DEV)
            Object.assign(window, { bladeboundTown: useTown });
        return () => {
            stopTalk();
            useTown.setState({ near: null, talking: null });
        };
    }, []);

    return (
        <>
            {folk.map((one) => (
                <Townsperson key={one.id} one={one} />
            ))}
        </>
    );
}

function Townsperson({ one }: { one: Folk }) {
    const world = useWorld();
    const hero = useRef<KootaEntity | undefined>(undefined);
    const facing = useRef(one.facing);

    //  Whether she is near, written to the store only when it changes; and
    //  the way to face, toward her while she is near.
    useFrame(() => {
        if (!hero.current?.isAlive()) hero.current = findPlayerHero(world);
        const at = hero.current?.get(TransformTrait);
        if (!at) return;
        const toX = at.x - one.at[0];
        const toZ = at.z - one.at[1];
        const near = Math.hypot(toX, toZ) <= talkReach;
        facing.current =
            Math.hypot(toX, toZ) < talkReach * 2.2
                ? Math.atan2(toX, toZ)
                : one.facing;
        const { near: was } = useTown.getState();
        if (near && was !== one.id) useTown.setState({ near: one.id });
        else if (!near && was === one.id) useTown.setState({ near: null });
    });

    return (
        <Entity
            position={[one.at[0], 0.8, one.at[1]]}
            collider={{
                shape: ColliderShape.Capsule,
                kind: BodyKind.Fixed,
                size: [0.7, 1.6, 0.7],
            }}
        >
            {/*  Their name comes with their model, over their head on a
                 point of its own: a plate mounted while the model still
                 loads is unmounted as it suspends. */}
            <Suspense fallback={null}>
                <group position-y={-0.8}>
                    <FolkModel
                        look={one.look}
                        gear={one.gear}
                        facing={() => facing.current}
                    />
                </group>
                <group position-y={1.1}>
                    <Nameplate id={one.id} name={one.name} title={one.title} />
                </group>
            </Suspense>
        </Entity>
    );
}

function Nameplate({
    id,
    name,
    title,
}: {
    id: FolkId;
    name: string;
    title: string;
}) {
    const near = useTown(
        (state) => state.near === id && state.talking === null,
    );
    const touch = useTouch();
    return (
        <Panel
            anchor={Anchor.Above}
            variant={PanelVariant.Bare}
            maxDistance={28}
        >
            <Text
                size="xs"
                className="font-semibold text-amber-200 [text-shadow:0_1px_2px_black]"
            >
                {name}
            </Text>
            <Text
                size="xs"
                className="-mt-2 opacity-80 [text-shadow:0_1px_2px_black]"
            >
                {title}
            </Text>
            {near && (
                <Button
                    onPress={() => talkTo(id)}
                    className="pointer-events-auto"
                >
                    Talk{touch ? "" : " (E)"}
                </Button>
            )}
        </Panel>
    );
}
