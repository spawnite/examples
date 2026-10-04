import { Button, Select, Text, Toggle } from "@spawnite/engine";
import {
    DashLook,
    DeathLook,
    defaultLook,
    Figures,
    GlowLook,
    MuzzleLook,
    SpareGuns,
    useLook,
    type LookState,
} from "../store/look";

//  How the field is drawn, in development only: the Meshy models or the
//  source's flat figures, and each effect's variant to try against the
//  others. Every choice is kept in this browser.

/** A choice's options, each its value and the words it shows. */
type Options<Value extends string | number> = [Value, string][];

interface ChoiceProps<Key extends keyof LookState> {
    label: string;
    field: Key;
    options: Options<Extract<LookState[Key], string | number>>;
}

function Choice<Key extends keyof LookState>({
    label,
    field,
    options,
}: ChoiceProps<Key>) {
    const value = useLook((look) => look[field]);
    return (
        <Text as="label" className="flex items-center justify-between gap-2">
            {label}
            <Select
                label={label}
                options={options.map(([option, words]) => ({
                    value: String(option),
                    label: words,
                }))}
                value={String(value)}
                onChange={(chosen) => {
                    const picked = options.find(
                        ([option]) => String(option) === chosen,
                    );
                    if (picked) useLook.setState({ [field]: picked[0] });
                }}
            />
        </Text>
    );
}

interface LookToggleProps {
    label: string;
    field: "shake" | "rims";
}

function LookToggle({ label, field }: LookToggleProps) {
    const on = useLook((look) => look[field]);
    return (
        <Text as="label" className="flex justify-between gap-2">
            {label}
            <Toggle
                label={label}
                value={on}
                onChange={(next) => useLook.setState({ [field]: next })}
            />
        </Text>
    );
}

export function LookPanel() {
    return (
        <Text as="div" className="flex flex-col gap-2 text-xs">
            <Choice
                label="Figures"
                field="figures"
                options={[
                    [Figures.Models, "3D models"],
                    [Figures.Flat, "Flat (source)"],
                ]}
            />
            <Choice
                label="Model lean"
                field="lean"
                options={[
                    [0, "Upright"],
                    [20, "20°"],
                    [35, "35°"],
                    [50, "50°"],
                ]}
            />
            <Choice
                label="Spare guns"
                field="spareGuns"
                options={[
                    [SpareGuns.Orbit, "Float round"],
                    [SpareGuns.Swap, "Swap in hands"],
                ]}
            />
            <Choice
                label="Muzzle"
                field="muzzle"
                options={[
                    [MuzzleLook.FlashAndLight, "Flash and light"],
                    [MuzzleLook.Flash, "Flash"],
                    [MuzzleLook.Off, "Off"],
                ]}
            />
            <Choice
                label="Dash"
                field="dash"
                options={[
                    [DashLook.Both, "Roll and copies"],
                    [DashLook.Roll, "Roll"],
                    [DashLook.Ghosts, "Copies"],
                ]}
            />
            <Choice
                label="Death"
                field="death"
                options={[
                    [DeathLook.Burst, "Burst"],
                    [DeathLook.Tumble, "Tumble"],
                    [DeathLook.Shatter, "Shatter"],
                ]}
            />
            <Choice
                label="Glow"
                field="glow"
                options={[
                    [GlowLook.Soft, "Soft"],
                    [GlowLook.Strong, "Strong"],
                    [GlowLook.Off, "Off"],
                ]}
            />
            <LookToggle label="Model rims" field="rims" />
            <LookToggle label="Camera shake" field="shake" />
            <Button
                className="df-btn"
                onPress={() => useLook.setState(defaultLook)}
            >
                Reset the look
            </Button>
        </Text>
    );
}
