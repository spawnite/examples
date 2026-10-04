import { useHas, useQueryFirst, useWorld } from "koota/react";
import {
    AuthorityTrait,
    Button,
    ButtonVariant,
    HeroTrait,
    Icon,
    Text,
} from "@spawnite/engine";
import { ReadinessMachine } from "../siege/life";
import { siegePlugin } from "../siege/siege.plugin";
import { sendSignal } from "../weapons/signal";
import { hudTapTarget } from "./look";

//  Her ready in a breather, as a button with its key: the wave banner's
//  while her cards are folded, and the shop bar's while they are open.

/** Seconds of a breather's countdown that read as the last. */
export const urgentSeconds = 5;

interface ReadyButtonProps {
    /** A taller button, as the shop bar's. */
    tall?: boolean;
}

/** Ready (R), or Ready ticked once she is, which a press takes back. */
export function ReadyButton({ tall = false }: ReadyButtonProps) {
    const world = useWorld();
    const mine = useHas(
        useQueryFirst(HeroTrait, AuthorityTrait),
        ReadinessMachine.is.ready,
    );
    const height = tall ? `h-10 ${hudTapTarget}` : `h-8 ${hudTapTarget}`;
    return (
        <Button
            label={mine ? "Ready: press R to cancel" : "Ready (R)"}
            keyShortcuts="R"
            onPress={() =>
                sendSignal(
                    world,
                    mine
                        ? siegePlugin.messages.unready
                        : siegePlugin.messages.ready,
                    {},
                )
            }
            variant={mine ? ButtonVariant.Glass : ButtonVariant.Accent}
            className={
                mine
                    ? `${height} min-w-0 gap-1.5 rounded-lg border border-emerald-300/50 bg-emerald-400/20 bg-none px-2.5 font-display text-sm font-bold tracking-widest text-emerald-200 uppercase shadow-none inset-shadow-none font-stretch-condensed`
                    : `${height} min-w-0 gap-1.5 rounded-lg border py-0 pr-3 pl-1 font-display text-sm font-bold tracking-widest uppercase shadow-none font-stretch-condensed`
            }
        >
            <Text as="span" className="flex items-center gap-1.5">
                {mine ? (
                    <Icon name="check" className="size-4 text-emerald-200" />
                ) : (
                    <Text
                        as="span"
                        className="inline-flex size-6 items-center justify-center rounded-md bg-slate-950/85 font-display text-sm text-menu-accent pointer-coarse:hidden"
                    >
                        R
                    </Text>
                )}
                Ready
            </Text>
        </Button>
    );
}
