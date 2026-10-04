import type { Entity } from "koota";
import { useQuery, useQueryFirst, useTrait } from "koota/react";
import { useEffect, useRef, useState } from "react";
import {
    AuthorityTrait,
    HeroTrait,
    Hud,
    Panel,
    PanelVariant,
    PlayerNameTrait,
    Slot,
    Text,
} from "@spawnite/engine";
import { playSound, Sound } from "../audio/sounds";
import { readCard } from "../siege/cards";
import { Rarity, WardenTrait } from "../siege/traits";
import { readWardenTextClass } from "../views/palette";
import { Glint } from "./CardFace";
import { readOfferKey } from "./cardReveal";
import { hudDisplay } from "./look";

//  When a teammate is dealt an epic, every other page says so for a
//  couple of seconds under the scoreboard, as her row flashes, the way a
//  gacha calls a pull out to the room: "Ada EPIC Thunderhead".

/** Milliseconds a pull's line stays up. */
const pullTime = 2400;

/** One teammate's epic, as a line says it. */
interface Pull {
    key: string;
    name: string;
    hue: number;
    title: string;
}

interface TeammatePullsProps {
    entity: Entity;
    onPull: (pull: Pull) => void;
}

/** Watches one teammate's offers and calls `onPull` for each epic she is
 *  newly dealt: not for one she already held as this page joined. */
function TeammatePulls({ entity, onPull }: TeammatePullsProps) {
    const survivor = useTrait(entity, WardenTrait);
    const player = useTrait(entity, PlayerNameTrait);
    const offer = survivor?.offer ?? [];
    const key = `${entity.id()}:${readOfferKey(offer)}`;
    const seenRef = useRef(key);
    const pullRef = useRef({ offer, survivor, player, onPull });
    pullRef.current = { offer, survivor, player, onPull };
    useEffect(() => {
        if (seenRef.current === key) return;
        seenRef.current = key;
        const {
            offer: dealt,
            survivor: warden,
            player: name,
        } = pullRef.current;
        for (const { card, rarity } of dealt) {
            const title = readCard(card)?.title;
            if (rarity === Rarity.Epic && title)
                pullRef.current.onPull({
                    key: `${key}:${card}`,
                    name: name?.name ?? "A warden",
                    hue: warden?.hue ?? 0,
                    title,
                });
        }
    }, [key]);
    return null;
}

/** A line under the scoreboard for each epic a teammate is dealt, gone
 *  after a few seconds. Only a page with a warden of its own watches: the
 *  room mounts the scene too, and a Hud it drew would add to its world. */
export function EpicPulls() {
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const wardens = useQuery(PlayerNameTrait, WardenTrait).filter(
        (entity) => hero !== undefined && entity.id() !== hero.id(),
    );
    const [pulls, setPulls] = useState<Pull[]>([]);
    const timersRef = useRef<number[]>([]);
    useEffect(
        () => () => {
            for (const timer of timersRef.current) clearTimeout(timer);
        },
        [],
    );
    const onPull = (pull: Pull) => {
        playSound(Sound.RareCard, { volume: 0.5 });
        setPulls((shown) => [...shown, pull]);
        timersRef.current.push(
            window.setTimeout(
                () =>
                    setPulls((shown) =>
                        shown.filter(({ key }) => key !== pull.key),
                    ),
                pullTime,
            ),
        );
    };
    return (
        <>
            {wardens.map((entity) => (
                <TeammatePulls
                    key={entity.id()}
                    entity={entity}
                    onPull={onPull}
                />
            ))}
            {pulls.length > 0 && (
                <Hud>
                    <Panel
                        slot={Slot.TopRight}
                        variant={PanelVariant.Bare}
                        order={1}
                        className="items-end gap-2"
                    >
                        {pulls.map(({ key, name, hue, title }) => (
                            <Text
                                key={key}
                                as="span"
                                className="card-pull relative flex items-center gap-2 overflow-hidden rounded-full border border-amber-200/60 bg-[linear-gradient(90deg,rgb(88_28_135/0.95),rgb(162_28_175/0.9),rgb(124_58_237/0.95))] py-1.5 pr-4 pl-2 text-sm font-semibold text-white shadow-[0_0_24px_rgb(217_70_239/0.55)]"
                            >
                                <Glint className="size-5 text-amber-200" />
                                <Text
                                    className={`font-bold ${readWardenTextClass(hue)}`}
                                >
                                    {name}
                                </Text>
                                <Text
                                    className={`${hudDisplay} text-base tracking-[0.2em] text-amber-200`}
                                >
                                    EPIC
                                </Text>
                                <Text className={`${hudDisplay} text-base`}>
                                    {title}
                                </Text>
                            </Text>
                        ))}
                    </Panel>
                </Hud>
            )}
        </>
    );
}
