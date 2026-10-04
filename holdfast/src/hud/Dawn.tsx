import {
    useHas,
    useQuery,
    useQueryFirst,
    useTrait,
    useWorld,
} from "koota/react";
import { useState } from "react";
import {
    AuthorityTrait,
    HeroTrait,
    Icon,
    Modal,
    ModalVariant,
    PlayerNameTrait,
    Text,
} from "@spawnite/engine";
import { siegePlugin } from "../siege/siege.plugin";
import { SiegeTrait, WardenTrait } from "../siege/traits";
import { sendSignal } from "../weapons/signal";
import { Awards } from "./Awards";
import { CareerLine } from "./CareerLine";
import { hudBody, hudDisplay, hudLabel, hudPane } from "./look";
import { RunEndActions, runEndPane, RunEndShade, RunRow } from "./RunOver";
import { ReadinessMachine } from "../siege/life";
import { usePhase } from "../views/phase";

/** The team's kills over the night, read off every warden. */
function useTeamKills() {
    const wardens = useQuery(WardenTrait);
    let kills = 0;
    for (const entity of wardens) kills += entity.get(WardenTrait)?.kills ?? 0;
    return kills;
}

/** The night won: dawn over the circle, the waves the wardens held, her
 *  level and the XP the night added, each warden's coins, kills and cards,
 *  and the way on into Endless, where the waves keep climbing. Into Endless
 *  says she is ready on the way, as her key does; Back to the circle closes
 *  the screen, and the ring by the fire readies her from there. */
export function Dawn() {
    const world = useWorld();
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = usePhase();
    const wardens = useQuery(PlayerNameTrait, WardenTrait);
    const ready = useHas(
        useQueryFirst(HeroTrait, AuthorityTrait),
        ReadinessMachine.is.ready,
    );
    const kills = useTeamKills();
    const dawn = phase === "dawn";
    //  Put aside once she leaves it, until the next dawn.
    const [dismissed, setDismissed] = useState(false);
    const [wasDawn, setWasDawn] = useState(dawn);
    if (dawn !== wasDawn) {
        setWasDawn(dawn);
        if (!dawn) setDismissed(false);
    }
    const showing = dawn && !dismissed;
    if (!siege || !showing) return null;

    return (
        <Modal
            open
            title="Dawn"
            variant={ModalVariant.Bare}
            dialogClassName="backdrop:bg-transparent backdrop:bg-[radial-gradient(ellipse_120%_70%_at_50%_110%,rgb(255_170_90/38%),transparent_70%),radial-gradient(ellipse_at_center,rgb(30_18_10/25%),rgb(12_8_6/62%))]"
            actions={
                <RunEndActions
                    onBack={() => setDismissed(true)}
                    onGo={() => {
                        if (!ready)
                            sendSignal(world, siegePlugin.messages.ready, {});
                        setDismissed(true);
                    }}
                >
                    Into Endless
                </RunEndActions>
            }
        >
            <Text
                as="div"
                className={`dawn-pane ${runEndPane} gap-3.5 px-7 pt-4 pb-6 [@media(max-height:480px)]:gap-2.5 [@media(max-height:480px)]:pt-3 [@media(max-height:480px)]:pb-4 ${hudPane}`}
            >
                <Text as="div" className="flex flex-col items-center gap-1">
                    <Icon
                        name="trophy"
                        className="size-7 text-amber-200 [@media(max-height:480px)]:hidden drop-shadow-[0_0_12px_rgb(253_230_138/0.8)]"
                    />
                    <Text
                        className={`${hudDisplay} animate-hud-slam text-6xl [@media(max-height:480px)]:text-4xl text-amber-200 uppercase [text-shadow:0_2px_0_rgb(90_45_0),0_0_32px_rgb(255_190_90/0.7)]`}
                    >
                        Dawn
                    </Text>
                    <Text
                        as="div"
                        className="h-0.5 w-72 animate-hud-sweep bg-linear-to-r from-transparent via-amber-200 to-transparent"
                    >
                        {null}
                    </Text>
                    <Text className="pt-1 text-base font-semibold tracking-wide text-pane-ink/90 uppercase">
                        The circle held
                    </Text>
                </Text>
                <Text
                    as="div"
                    className="flex items-center justify-center gap-8"
                >
                    <Text as="div" className="flex flex-col items-center">
                        <Text className={hudLabel}>Waves held</Text>
                        <Text
                            className={`${hudDisplay} text-5xl [@media(max-height:480px)]:text-4xl text-amber-200 [text-shadow:0_0_24px_rgb(255_177_59/0.45)]`}
                        >
                            {siege.wave}
                        </Text>
                    </Text>
                    <Text as="div" className="h-12 w-px bg-amber-100/15">
                        {null}
                    </Text>
                    <Text as="div" className="flex flex-col items-center">
                        <Text className={hudLabel}>The Hollow felled</Text>
                        <Text
                            className={`${hudDisplay} text-5xl text-white/90 [@media(max-height:480px)]:text-4xl`}
                        >
                            {kills}
                        </Text>
                    </Text>
                </Text>
                <CareerLine />
                <Text as="div" className="flex flex-col gap-1.5">
                    <Text
                        as="div"
                        className="flex items-center gap-3 pr-3 pl-5"
                    >
                        <Text className={`${hudLabel} flex-1`}>Warden</Text>
                        <Text className={`${hudLabel} w-14 text-right`}>
                            Coins
                        </Text>
                        <Text className={`${hudLabel} w-14 text-right`}>
                            Kills
                        </Text>
                    </Text>
                    {wardens.map((entity) => (
                        <RunRow key={entity} entity={entity} />
                    ))}
                </Text>
                <Awards />
                <Text className={`text-center ${hudBody}`}>
                    The Hollow does not stop at sunrise. Hold on into Endless,
                    where the waves keep climbing, with everything you built.
                </Text>
                <RunEndShade />
            </Text>
        </Modal>
    );
}
