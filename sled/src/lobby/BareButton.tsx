import type { ReactNode } from "react";
import { Button, ButtonVariant } from "@spawnite/engine";

/** The engine's Button with its glass taken off, as RoundButton takes it
 *  off, for a control the lobby draws itself: the press, the focus ring
 *  and the key shortcut stay the engine's, and `className` draws the rest,
 *  transparent unless it fills it. */
export function BareButton({
    label,
    onPress,
    className,
    children,
}: {
    /** The accessible name: the button holds pictures and numbers. */
    label: string;
    onPress: () => void;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Button
            variant={ButtonVariant.Accent}
            label={label}
            onPress={onPress}
            //  The engine draws a dark halo round a button's icon for glass;
            //  on a drawn icon it blurs the ink.
            classNames={{ icon: "gap-1.5 [&_svg]:[filter:none]" }}
            className={`border-0 bg-transparent px-0 shadow-none hover:brightness-105 ${className ?? ""}`}
        >
            {children}
        </Button>
    );
}
