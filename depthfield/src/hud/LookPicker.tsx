import { Button, Icon, Text } from "@spawnite/engine";
import { LookId, looks, prismaticKills } from "../rules/data";
import { useChoice } from "../store/choice";
import { isPrismaticUnlocked, useProgress } from "../store/progress";

//  The looks as swatches, the picked one ringed. Prismatic waits on a
//  hundred kills and shows how many there are so far.

export function LookPicker() {
    const picked = useChoice((choice) => choice.look);
    const progress = useProgress();
    const prismatic = isPrismaticUnlocked(progress);
    return (
        <Text as="div" className="df-lookgrid" aria-label="Look">
            {looks.map((look) => {
                const locked = look.id === LookId.Prismatic && !prismatic;
                return (
                    <Button
                        key={look.id}
                        label={
                            locked
                                ? `${look.name}, locked: ${prismaticKills} kills`
                                : look.name
                        }
                        disabled={locked}
                        className={`df-look ${picked === look.id ? "df-picked" : ""}`}
                        onPress={() => useChoice.setState({ look: look.id })}
                    >
                        <Text
                            as="i"
                            className={`df-bigswatch df-look-${look.id}`}
                        >
                            {locked && <Icon name="lock" className="size-4" />}
                        </Text>
                        <Text className="df-pickname">{look.name}</Text>
                        {locked && (
                            <Text as="small" tabular>
                                {`${Math.min(progress.careerKills, prismaticKills)}/${prismaticKills} kills`}
                            </Text>
                        )}
                    </Button>
                );
            })}
        </Text>
    );
}
