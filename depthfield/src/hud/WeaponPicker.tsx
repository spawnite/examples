import { Button, Icon, Text } from "@spawnite/engine";
import {
    createWeapons,
    weaponBlurbs,
    weaponIcons,
    weaponIds,
    WeaponId,
} from "../rules/data";
import { useChoice } from "../store/choice";
import { isZapUnlocked, useProgress } from "../store/progress";

//  The starting weapons, each its icon in its colour and its name, and
//  what the picked one does. Zap waits on one finished run.

const weaponNames = createWeapons();

export function WeaponPicker() {
    const picked = useChoice((choice) => choice.starter);
    const zap = isZapUnlocked(useProgress());
    return (
        <Text as="div" className="df-weaponpick">
            <Text
                as="div"
                className="df-weapongrid"
                aria-label="Starting weapon"
            >
                {weaponIds.map((id) => {
                    const locked = id === WeaponId.Zap && !zap;
                    const { name } = weaponNames[id];
                    return (
                        <Button
                            key={id}
                            label={
                                locked ? `${name}, locked: finish a run` : name
                            }
                            disabled={locked}
                            className={`df-weapon-pick ${picked === id ? "df-picked" : ""}`}
                            onPress={() => useChoice.setState({ starter: id })}
                        >
                            <Text className={`df-weaponglyph df-${id}`}>
                                {locked ? (
                                    <Icon name="lock" className="size-4" />
                                ) : (
                                    weaponIcons[id]
                                )}
                            </Text>
                            <Text className="df-pickname">{name}</Text>
                            {locked && <Text as="small">Finish a run</Text>}
                        </Button>
                    );
                })}
            </Text>
            {picked && (
                <Text as="p" className="df-pickline">
                    {weaponBlurbs[picked]}
                </Text>
            )}
        </Text>
    );
}
