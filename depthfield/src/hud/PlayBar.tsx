import { Button, ButtonVariant, Icon, Text } from "@spawnite/engine";

//  Play below the picks: the one action the lobby leads with. The run is
//  played under the player's name in the app, or the default one.

interface PlayBarProps {
    onPlay: () => void;
}

export function PlayBar({ onPlay }: PlayBarProps) {
    return (
        <Text as="div" className="df-playbar">
            <Button
                variant={ButtonVariant.Accent}
                className="df-play"
                onPress={onPlay}
            >
                <Icon name="play" className="size-5" />
                Play
            </Button>
        </Text>
    );
}
