import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useWorld } from "koota/react";
import {
    Button,
    findPlayerHero,
    Icon,
    Panel,
    PanelVariant,
    Player,
    Slot,
    Text,
    TransformTrait,
    useScenes,
} from "@spawnite/engine";
import type { Entity } from "koota";
import { Particles } from "../combat/Particles";
import { TouchControls } from "../combat/TouchControls";
import { HeroModel } from "../hero/HeroModel";
import { deriveHero, useProgress } from "../hero/progress";
import { CharacterCreator } from "../hud/CharacterCreator";
import { ControlsHint } from "../hud/ControlsHint";
import { HeroBars } from "../hud/HeroBars";
import { HeroHud } from "../hud/HeroHud";
import {
    Anvil,
    Crates,
    Fence,
    Forge,
    Gate,
    House,
    Lamp,
    Stall,
    Well,
} from "../town/Buildings";
import { FolkWindow } from "../town/FolkWindow";
import { editLook, folk, talkTo, useTown } from "../town/folk";
import { Townsfolk } from "../town/Townsfolk";
import { usePortrait, useTouch } from "../view/device";
import { DetailedWorld } from "../view/graphics";
import { GroundTexture } from "../view/GroundTexture";
import { OrbitCamera } from "../view/OrbitCamera";

/** The town: a plaza round a well, the smithy on its west side and the
 *  general store on its east, houses round it and the gate to the wilds to
 *  the north, where the guard stands. She walks it as she walks the wilds,
 *  and talks to its people. On the first visit it is the backdrop to
 *  making her, close up. */
export function Lobby() {
    const maxHealth = deriveHero(useProgress.getState()).maxHealth;
    return (
        <DetailedWorld map="town">
            <Player
                position={[0, 0, 6]}
                health={{ current: maxHealth, maximum: maxHealth }}
            >
                {({ entity }) => (
                    <>
                        <HeroModel entity={entity} />
                        <HeroBars entity={entity} />
                    </>
                )}
            </Player>
            <GroundTexture />
            <TownView />
            <TouchControls peaceful />
            <Particles />
            <TownBuildings />
            <Townsfolk />
            <GateWatch />
            <HeroHud town menu={(close) => <TownMenu onChoose={close} />}>
                <TownScreen />
                <FolkWindow />
            </HeroHud>
        </DetailedWorld>
    );
}

function TownBuildings() {
    return (
        <>
            {/*  The smithy, its front to the plaza, its forge and anvil
                 before it. */}
            <House
                at={[-12.5, -3]}
                turn={1}
                width={6}
                depth={4.5}
                height={3}
                roof="#4b5563"
                walls="#d9cbb0"
            />
            <Forge at={[-8.8, -5.4]} turn={Math.PI / 2} />
            <Anvil at={[-8.6, -0.4]} />
            {/*  The general store, and its stall of potions. */}
            <House
                at={[12.5, -3]}
                turn={3}
                width={6}
                depth={4.5}
                height={3}
                roof="#b83a3a"
            />
            <Stall at={[9, -5.6]} turn={-Math.PI / 2} />
            {/*  Houses round the plaza. */}
            <House at={[-11, 9]} turn={1} roof="#3a6fb0" />
            <House at={[11, 9]} turn={3} roof="#4f8a3a" />
            <House at={[-8, -13]} roof="#c07a2a" />
            <House at={[8, -13]} roof="#8a4ab0" />
            <Well at={[0, -2.5]} />
            <Gate at={[0, -20]} />
            {[-4, 4].map((x) => (
                <Lamp key={`a${x}`} at={[x, 3.5]} />
            ))}
            {[-4, 4].map((x) => (
                <Lamp key={`b${x}`} at={[x, -9]} />
            ))}
            {[-2.2, 2.2].map((x) => (
                <Lamp key={`c${x}`} at={[x, -17.5]} />
            ))}
            <Crates at={[-13.8, 1.6]} />
            <Crates at={[13.2, 1.8]} />
            <Fence from={[-15, 13]} to={[-5, 15]} />
            <Fence from={[5, 15]} to={[15, 13]} />
            <Fence from={[-3.4, -20]} to={[-12, -18]} />
            <Fence from={[3.4, -20]} to={[12, -18]} />
        </>
    );
}

/** Walking out through the gate to the north leaves for the wilds. */
function GateWatch() {
    const world = useWorld();
    const hero = useRef<Entity | undefined>(undefined);
    const gone = useRef(false);
    useFrame(() => {
        if (gone.current) return;
        if (!hero.current?.isAlive()) hero.current = findPlayerHero(world);
        const at = hero.current?.get(TransformTrait);
        if (at && at.z < -21 && Math.abs(at.x) < 2.5) {
            gone.current = true;
            useTown.setState({ leaving: true });
        }
    });
    useEffect(() => () => useTown.setState({ leaving: false }), []);
    return null;
}

/** The town's screen, under the hunt's: while she is being made, the
 *  creator; after, her level and gold, the rules, and the way out. */
function TownScreen() {
    const scenes = useScenes();
    const created = useProgress((state) => state.created);
    const level = useProgress((state) => state.level);
    const gold = useProgress((state) => state.gold);
    const leaving = useTown((state) => state.leaving);
    const near = useTown((state) => (state.talking ? null : state.near));
    const nearFolk = folk.find((one) => one.id === near);
    const touch = useTouch();
    const editing = useTown((state) => state.editingLook);
    const [rulesOpen, setRulesOpen] = useState(false);
    const creating = !created || editing;
    //  Upright on a phone, the creator sits under her rather than beside.
    const portrait = usePortrait();

    //  Once, as she passes the gate: the scenes' handle changes as the
    //  scene does, so it is read here rather than watched.
    const go = useRef(scenes.go);
    go.current = scenes.go;
    useEffect(() => {
        if (leaving) go.current("run");
    }, [leaving]);
    //  Leaving town closes the creator, so the next visit opens on the town.
    useEffect(() => () => editLook(false), []);

    return (
        <>
            <Panel slot={Slot.Top}>
                <Text size="xl">Bladebound</Text>
                {created && (
                    <Text size="xs" className="whitespace-nowrap text-center">
                        Level {level} · {gold} gold
                    </Text>
                )}
            </Panel>
            {!creating && rulesOpen && (
                <Panel slot={portrait ? Slot.Bottom : Slot.Left} order={1}>
                    <Text>
                        Talk to Brom the smith to merge doubles into stronger
                        gear, to Mira for potions, and to Instructor Vale for a
                        job from level 10. Walk out through the north gate, or
                        ask the guard, to hunt in the wilds.
                    </Text>
                    <Text>
                        Fall in battle and you wake in town, a little less
                        experienced.
                    </Text>
                    <ControlsHint size="sm" />
                </Panel>
            )}
            {creating ? (
                <CharacterCreator
                    slot={portrait ? Slot.Bottom : Slot.Right}
                    onDone={() => editLook(false)}
                />
            ) : (
                <Panel slot={Slot.Bottom} variant={PanelVariant.Bare} order={2}>
                    <Text
                        as="div"
                        className="flex flex-wrap items-center justify-center gap-2"
                    >
                        <Button
                            label="How to play"
                            pressed={rulesOpen}
                            onPress={() => setRulesOpen(!rulesOpen)}
                        >
                            ?
                        </Button>
                        {nearFolk && (
                            //  A large button to talk to whoever she stands
                            //  near, easier for a thumb than the one over
                            //  their name.
                            <Button onPress={() => talkTo(nearFolk.id)}>
                                Talk to {nearFolk.name}
                                {touch ? "" : " (E)"}
                            </Button>
                        )}
                    </Text>
                </Panel>
            )}
        </>
    );
}

/** The town's own lines in the menu: changing her look, and the way out
 *  to the wilds. */
interface TownMenuProps {
    /** Closes the menu, as each line does when pressed. */
    onChoose: () => void;
}

function TownMenu({ onChoose }: TownMenuProps) {
    const scenes = useScenes();
    return (
        <>
            <Button
                onPress={() => {
                    onChoose();
                    editLook(true);
                }}
            >
                <Icon name="user" className="size-5" />
                Change look
            </Button>
            <Button
                onPress={() => {
                    onChoose();
                    scenes.go("run");
                }}
            >
                <Icon name="map" className="size-5" />
                Enter the wilds
            </Button>
        </>
    );
}

/** The town's camera: close up and nearly level while she is being made,
 *  as the creator's backdrop, turned round her with the right mouse
 *  button or two fingers; after, following her round the town as the
 *  wilds' does, a little closer. Held upright, as a phone in portrait, it
 *  stands further back. Its own component, so a phone turning or her
 *  making redraws the view and not the scene. */
function TownView() {
    const portrait = usePortrait();
    const created = useProgress((state) => state.created);
    if (!created)
        return (
            <OrbitCamera
                key="close"
                polar={(78 * Math.PI) / 180}
                distance={portrait ? 7 : 4.2}
                minDistance={2.5}
                maxDistance={9}
                minPolar={(40 * Math.PI) / 180}
                maxPolar={(88 * Math.PI) / 180}
                fov={30}
                lift={portrait ? 0.22 : 0}
            />
        );
    return (
        <OrbitCamera
            key="town"
            polar={(55 * Math.PI) / 180}
            distance={portrait ? 12 : 9}
            minDistance={3}
            maxDistance={16}
            minPolar={(20 * Math.PI) / 180}
            maxPolar={(82 * Math.PI) / 180}
            dynamic
        />
    );
}

//  A room loads this file alone, so it hands on the game's plugins.
export { plugins } from "../game";
