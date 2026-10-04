import { createElement, type ComponentType } from "react";
import { Button, ButtonVariant, Icon, type IconName } from "@spawnite/engine";
import type { SledIconProps } from "../icons/svg";

//  Written whole, because Tailwind emits only the classes it reads.
const tones = {
    /** The one action the screen leads with: gold, and larger. */
    lead: "size-24 bg-[#ffc93c]",
    /** A lesser choice beside it: snow white. */
    plain: "size-20 bg-white",
};

/** A round icon button for a thumb, as a mobile game's result screen draws
 *  one: a filled disc with a thick ink edge and a hard drop under it. The
 *  engine's Button with its glass taken off, so the press, the focus ring
 *  and the key shortcut stay the engine's. */
export function RoundButton({
    icon,
    label,
    onPress,
    lead = false,
}: {
    /** An engine icon by name, or one of sled's own. */
    icon: IconName | ComponentType<SledIconProps>;
    /** The accessible name: the button holds only its icon. */
    label: string;
    onPress: () => void;
    lead?: boolean;
}) {
    const size = lead ? "size-12" : "size-10";
    return (
        <Button
            variant={ButtonVariant.Accent}
            label={label}
            onPress={onPress}
            //  The engine draws a dark halo round a button's icon for glass;
            //  on a filled disc it blurs the ink.
            classNames={{ icon: "[&_svg]:[filter:none]" }}
            className={`rounded-full border-4 border-[#14213d] px-0 shadow-[0_6px_0_#14213d] hover:brightness-105 ${tones[lead ? "lead" : "plain"]}`}
        >
            {typeof icon === "string" ? (
                <Icon
                    name={icon}
                    className={`text-[#14213d] [stroke-width:3] ${size}`}
                />
            ) : (
                createElement(icon, { className: size })
            )}
        </Button>
    );
}
