import { Modal, Text } from "@spawnite/engine";
import { dialogLook, paneLook } from "./classes";
import {
    rarities,
    round2,
    weaponIcons,
    weaponIds,
    weaponSummaries,
    WeaponId,
    type WeaponState,
} from "../rules/data";
import { readHeroHealth } from "../rules/hero";
import { useChoice } from "../store/choice";
import { isZapUnlocked } from "../store/progress";
import { useRunView } from "./useRunView";

//  M's field notes: the loadout with each weapon's numbers and level, the
//  run's stats, the rarity odds and how the run works. The world holds
//  still while they are open, as the source's did.

/** A weapon's numbers, as the loadout lists them. */
function describeWeapon(id: WeaponId, weapon: WeaponState) {
    const base = `${weapon.damage} dmg · ${weapon.interval.toFixed(2)}s`;
    if (id === WeaponId.Nova) return `${base} · r${weapon.radius}`;
    if (id === WeaponId.Shard) return `${base} · ${weapon.range} range`;
    if (id === WeaponId.Zap)
        return `${base} · ${weapon.bounces} bounce${weapon.bounces === 1 ? "" : "s"}`;
    return `${base} · ×${weapon.count}`;
}

/** How the run works, as the source's notes told it. */
const notes = [
    "Choose any starting weapon. Add weapons at levels 3, 5, and 7. Regular upgrades offer four choices.",
    "Specialist power upgrades give the largest gain to one weapon. Arsenal power gives each weapon 65% of that gain, rounded down. Arsenal haste gives 75% of the specialist speed bonus. Both apply to future weapon unlocks.",
    "New enemy types arrive as the clock runs, each stage on its own schedule. Enemy health and damage keep rising with the clock and with your level. Elites arrive at 1:00 and 2:00; the boss arrives at 3:00. Beat it to keep going, endless: an elite every 45 seconds and the boss every three minutes.",
    "Pink pickups add 5 maximum health for this run; food heals 35. Magnets pull all XP orbs toward you. Regen caps at 2 health/second. Every new run starts at its class's full health.",
    "Tanks dash then stomp. Summoners spawn up to three shooters, with at most three summoners alive. Watch the attack warnings and use Space to dash.",
    "Ember Foundry's vents glow, then erupt, burning anything standing in them. Prism Vault's beam draws its line, then sweeps the whole field: dash through it.",
];

interface StatProps {
    label: string;
    value: string | number;
}

function Stat({ label, value }: StatProps) {
    return (
        <Text as="div">
            {label}
            <Text as="b">{value}</Text>
        </Text>
    );
}

export function FieldNotes() {
    const open = useChoice((state) => state.notes);
    const view = useRunView((run, world) => ({
        weapons: weaponIds.map((id) => ({
            id,
            name: run.weapons[id].name,
            owned: run.weapons[id].owned,
            level: run.weapons[id].level,
            numbers: describeWeapon(id, run.weapons[id]),
        })),
        speed: run.speed,
        maximum: readHeroHealth(world).maximum,
        dropChance: round2(run.dropChance * 100),
        supply: 1 + run.consumableBonus,
        permanentHealth: run.permanentHealth,
        regen: run.regen,
        xpMult: round2(run.xpMult * 100),
    }));
    const close = () => useChoice.setState({ notes: false });
    if (!view) return null;
    const zap = isZapUnlocked();
    return (
        <Modal
            className={paneLook}
            dialogClassName={dialogLook}
            open={open}
            pause
            title="Field notes"
            onClose={close}
        >
            <Text as="div" className="df-pane df-text">
                <Text as="div" className="df-sectiontitle">
                    YOUR LOADOUT
                </Text>
                {view.weapons.map((weapon) => (
                    <Text key={weapon.id} as="div" className="df-weapon">
                        <Text className={`df-weaponicon df-${weapon.id}`}>
                            {weaponIcons[weapon.id]}
                        </Text>
                        <Text as="div">
                            <Text as="b">{weapon.name}</Text>
                            <Text as="small">{weaponSummaries[weapon.id]}</Text>
                            <Text as="small">
                                {weapon.id === WeaponId.Zap && !zap
                                    ? "Finish 1 run"
                                    : weapon.owned
                                      ? weapon.numbers
                                      : "Levels 3, 5, 7"}
                            </Text>
                        </Text>
                        <Text className="df-weaponlevel">
                            {weapon.owned ? `LV ${weapon.level}` : "LOCKED"}
                        </Text>
                    </Text>
                ))}
                <Text as="div" className="df-stats">
                    <Stat label="Move speed" value={view.speed} />
                    <Stat label="Maximum health" value={view.maximum} />
                    <Stat
                        label="Health drop chance"
                        value={`${view.dropChance}%`}
                    />
                    <Stat
                        label="Magnet drop chance"
                        value={`${round2(0.4 * view.supply)}%`}
                    />
                    <Stat
                        label="Double XP drop chance"
                        value={`${round2(0.5 * view.supply)}%`}
                    />
                    <Stat
                        label="Food drop chance"
                        value={`${round2(5 * view.supply)}%`}
                    />
                    <Stat
                        label="Health bonus this run"
                        value={`+${view.permanentHealth}`}
                    />
                    <Stat
                        label="Health regen"
                        value={`${view.regen.toFixed(1)}/s`}
                    />
                    <Stat
                        label="Experience multiplier"
                        value={`${view.xpMult}%`}
                    />
                </Text>
                <Text
                    as="div"
                    className="df-raritykey"
                    aria-label="Upgrade rarity odds"
                >
                    {rarities.map((rarity) => (
                        <Text
                            key={rarity.id}
                            className={`df-${rarity.id}-text`}
                        >
                            {`${rarity.name} ${round2(rarity.weight * 100)}%`}
                        </Text>
                    ))}
                </Text>
                <Text as="div" className="df-note">
                    <Text as="b">A space to experiment.</Text>
                    {notes.map((note) => (
                        <Text key={note} as="p">
                            {note}
                        </Text>
                    ))}
                </Text>
            </Text>
        </Modal>
    );
}
