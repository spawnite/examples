import { Text } from "@spawnite/engine";

//  The keys, as the lobby and the pause menu list them.

interface KeyProps {
    name: string;
}

function Key({ name }: KeyProps) {
    return (
        <Text as="kbd" className="df-kbd">
            {name}
        </Text>
    );
}

interface KeysProps {
    names: string[];
    action: string;
}

function Keys({ names, action }: KeysProps) {
    return (
        <Text>
            {names.map((name) => (
                <Key key={name} name={name} />
            ))}
            <Text className="ml-1">{action}</Text>
        </Text>
    );
}

export function KeyHelp() {
    return (
        <Text as="div" className="df-keys" aria-label="Keybinds">
            <Keys names={["W", "A", "S", "D"]} action="or arrows move" />
            <Keys names={["Space"]} action="dash" />
            <Keys names={["P"]} action="pause" />
            <Keys names={["M"]} action="field notes" />
            <Keys names={["1", "2", "3", "4"]} action="choose upgrade" />
        </Text>
    );
}
