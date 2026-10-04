import { useWorld } from "koota/react";
import { Footprints, HeartPulse, Skull, Sparkles, Swords } from "lucide-react";
import { useState } from "react";
import { Bar, Hud, Counter, Text, useEvent } from "@spawnite/engine";
import { bossAtSeconds, findClass, round2, weaponIcons } from "../rules/data";
import { readHeroHealth } from "../rules/hero";
import { EnemyTrait, RunPhase, ToastTrait } from "../rules/traits";
import { readHeightClass, readWidthClass } from "./fills";
import { Minimap } from "./Minimap";
import { usePhoneLayout } from "./usePhoneLayout";
import { useRunView } from "./useRunView";

//  The run's readout over the field, as the source laid it out: who and
//  how hurt at the top left, the clock, kills and level beside it, the
//  experience bar along the top edge, the live numbers along the card's
//  foot, each an icon and its value, a toast, the minimap at the top right, and the loadout's hotbar with the
//  dash at the bottom.

function formatClock(seconds: number) {
    const whole = Math.floor(seconds);
    return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

/** The live numbers' look: tight to their icons, bold and bright against
 *  the card's grey foot. */
const liveLook = "gap-[5px] font-bold text-[#eef3f6]";

function countLiving(world: ReturnType<typeof useWorld>) {
    return world.query(EnemyTrait).length;
}

export function RunHud() {
    const view = useRunView((run, world) => {
        const health = readHeroHealth(world);
        return {
            phase: run.phase,
            nickname: run.nickname || "You",
            classId: run.classId,
            health: Math.ceil(health.current),
            maximum: health.maximum,
            time: Math.floor(run.time),
            bossPhase: run.bossPhase,
            endless: run.endless,
            kills: run.kills,
            level: run.level,
            xpShare: Math.min(1, run.xp / run.nextXp),
            alive: countLiving(world),
            speed: run.speed,
            regen: run.regen,
            dealt: Math.round(run.damageDealt),
            xpBoost: run.xpBoost,
            loadout: run.loadout.map((id) => ({
                id,
                level: run.weapons[id].level,
                cooling: run.weapons[id].clock / run.weapons[id].interval,
            })),
            dash: run.dashCooldown,
            look: run.look,
        };
    });
    const [toast, setToast] = useState({ text: "", key: 0 });
    //  A phone shows the clock and the level in a chip, and the health over
    //  the soldier's head, in place of the run's panel.
    const phone = usePhoneLayout();
    useEvent(ToastTrait, (entity) => {
        const text = entity.get(ToastTrait)?.text ?? "";
        setToast((shown) => ({ text, key: shown.key + 1 }));
    });
    if (!view || view.phase === RunPhase.Title) return null;
    const runClass = findClass(view.classId);

    return (
        <Hud>
            <Text as="div" className="df-text">
                <Text as="div" className="df-xp">
                    <Text
                        as="i"
                        className={`df-fill ${readWidthClass(view.xpShare)}`}
                    >
                        {null}
                    </Text>
                </Text>
                {phone && (
                    <Text as="div" className="df-chip fixed top-3 left-3">
                        <Text as="b">
                            {view.bossPhase ? "BOSS" : formatClock(view.time)}
                        </Text>
                        <Text className="text-[11px] font-bold tracking-widest text-[#92a2ae]">
                            {`L${String(view.level).padStart(2, "0")}`}
                        </Text>
                        {view.endless && (
                            <Text className="text-[11px] font-bold tracking-widest text-[#92a2ae]">
                                ENDLESS
                            </Text>
                        )}
                    </Text>
                )}
                <Text
                    as="div"
                    className={`fixed top-3 left-3 flex flex-col gap-2 ${phone ? "hidden" : ""}`}
                >
                    <Text as="div" className="df-hud">
                        <Text as="div" className="df-hudtop">
                            <Text as="div">
                                <Text as="div" className="df-who">
                                    <Text
                                        as="b"
                                        className={`df-look-${view.look}`}
                                    >
                                        {view.nickname}
                                    </Text>
                                    <Text className={`df-${runClass.id}`}>
                                        {runClass.name}
                                    </Text>
                                </Text>
                                <Bar
                                    label="Health"
                                    value={view.health}
                                    maximum={view.maximum}
                                    showValue
                                    className="h-2 w-32"
                                />
                            </Text>
                            <Text as="div" className="df-runstats">
                                <Text as="div">
                                    <Text className="df-label">SURVIVE</Text>
                                    <Text as="b">
                                        {formatClock(view.time)}
                                        <Text as="small" className="ml-1">
                                            {view.bossPhase
                                                ? "BOSS"
                                                : view.endless
                                                  ? "ENDLESS"
                                                  : `/ ${formatClock(bossAtSeconds)}`}
                                        </Text>
                                    </Text>
                                </Text>
                                <Text as="div">
                                    <Text className="df-label">DEFEATED</Text>
                                    <Text as="b">{view.kills}</Text>
                                </Text>
                                <Text as="div">
                                    <Text className="df-label">LEVEL</Text>
                                    <Text as="b">
                                        {String(view.level).padStart(2, "0")}
                                    </Text>
                                </Text>
                            </Text>
                        </Text>
                        <Text as="div" className="df-hudfoot">
                            <Counter
                                size="sm"
                                className={liveLook}
                                icon={Skull}
                                label="Enemies alive"
                                value={view.alive}
                            />
                            <Counter
                                size="sm"
                                className={liveLook}
                                icon={Footprints}
                                label="Speed"
                                value={view.speed}
                            />
                            <Counter
                                size="sm"
                                className={liveLook}
                                icon={HeartPulse}
                                label="Regeneration a second"
                                value={view.regen.toFixed(1)}
                            />
                            <Counter
                                size="sm"
                                className={liveLook}
                                icon={Swords}
                                label="Damage dealt"
                                value={view.dealt}
                            />
                            <Counter
                                size="sm"
                                className={liveLook}
                                icon={Sparkles}
                                label="Double experience left"
                                value={
                                    view.xpBoost > 0
                                        ? `${view.xpBoost.toFixed(1)}s`
                                        : "—"
                                }
                            />
                        </Text>
                    </Text>
                </Text>
                <Minimap className="fixed top-3 right-3" />
                {toast.text && (
                    <Text
                        key={toast.key}
                        as="div"
                        className="df-toast fixed top-44 left-1/2 -translate-x-1/2 animate-[df-toast_3s_forwards]"
                    >
                        {toast.text}
                    </Text>
                )}
                <Text
                    as="div"
                    className="df-hotbar fixed bottom-4 left-1/2 -translate-x-1/2"
                >
                    {[0, 1, 2, 3].map((slot) => {
                        const weapon = view.loadout[slot];
                        if (!weapon)
                            return (
                                <Text
                                    key={slot}
                                    as="i"
                                    className="df-empty"
                                    aria-label="Empty weapon slot"
                                >
                                    {null}
                                </Text>
                            );
                        return (
                            <Text
                                key={slot}
                                as="i"
                                className={`df-${weapon.id}`}
                            >
                                {weaponIcons[weapon.id]}
                                <Text as="small">{weapon.level}</Text>
                                <Text
                                    as="b"
                                    className={readHeightClass(weapon.cooling)}
                                >
                                    {null}
                                </Text>
                            </Text>
                        );
                    })}
                    <Text as="i" className="df-dash" aria-label="Dash">
                        ⇢
                        <Text as="small">
                            {view.dash > 0 ? round2(view.dash).toFixed(1) : ""}
                        </Text>
                        <Text as="b" className={readHeightClass(view.dash / 4)}>
                            {null}
                        </Text>
                    </Text>
                </Text>
            </Text>
        </Hud>
    );
}
