import { createStore } from "@spawnite/engine";
import type { MonsterKindName } from "./kinds";

//  Where the wilds' monsters live, and which of them are up. Each area
//  holds a few monsters of one kind, which spawn, wander and respawn inside
//  it: a slain monster's slot waits `respawnSeconds` of game time, then
//  spawns a fresh one somewhere in the area, as MapleStory's maps refill.
//  An area with a boss counts its kills, and enough of them wake the boss
//  at the area's heart; it does not respawn until the count fills again.

export type SpawnArea = {
    name: string;
    kind: MonsterKindName;
    x: number;
    z: number;
    radius: number;
    count: number;
    /** The boss that wakes after `bossAfter` kills in the area. */
    boss?: MonsterKindName;
    bossAfter?: number;
};

export type SpawnSlot = {
    id: number;
    kind: MonsterKindName;
    area: SpawnArea;
    /** Where the current monster spawned. */
    x: number;
    z: number;
    /** Counts the monsters this slot has spawned, one Entity each. */
    generation: number;
    alive: boolean;
    /** The area's boss, which kills wake rather than time. */
    boss: boolean;
};

export const respawnSeconds = 4;

type Spawns = {
    slots: SpawnSlot[];
    /** Kills toward each area's boss, by the area's name. */
    kills: Record<string, number>;
    /** The area a kill last counted in, for the HUD's count. */
    lastArea: string | null;
    /** The boss that woke last, and a count that changes with each, so the
     *  banner shows again for the next. */
    awoken: { name: string; area: string; count: number } | null;
};

export const useSpawns = createStore<Spawns>()(() => ({
    slots: [],
    kills: {},
    lastArea: null,
    awoken: null,
}));

/** Seconds each slain slot has left, by id: counted every step, so kept
 *  off the store, which changes only when a monster falls or returns. A
 *  boss's slot waits forever, until its area wakes it. */
let waits: number[] = [];

/** A point inside the area's inner part, away from its rim. */
function pointIn(area: SpawnArea) {
    const angle = Math.random() * Math.PI * 2;
    const reach = Math.sqrt(Math.random()) * area.radius * 0.7;
    return {
        x: area.x + Math.cos(angle) * reach,
        z: area.z + Math.sin(angle) * reach,
    };
}

export function laySpawns(areas: SpawnArea[]) {
    const slots: SpawnSlot[] = [];
    for (const area of areas) {
        for (let index = 0; index < area.count; index++)
            slots.push({
                id: slots.length,
                kind: area.kind,
                area,
                ...pointIn(area),
                generation: 0,
                alive: true,
                boss: false,
            });
        if (area.boss)
            slots.push({
                id: slots.length,
                kind: area.boss,
                area,
                x: area.x,
                z: area.z,
                generation: 0,
                alive: false,
                boss: true,
            });
    }
    waits = slots.map((slot) => (slot.boss ? Infinity : 0));
    useSpawns.setState({ slots, kills: {}, lastArea: null, awoken: null });
}

/** Frees a slain monster's slot to respawn. A kill in an area with a boss
 *  counts toward it and, at the area's count, wakes it; the boss's own
 *  death starts the count again. */
export function markSlain(id: number) {
    const { slots, kills, awoken } = useSpawns.getState();
    const slain = slots[id];
    if (!slain) return;
    const area = slain.area;
    let nextKills = kills;
    let wake: SpawnSlot | undefined;
    if (slain.boss) {
        waits[id] = Infinity;
        nextKills = { ...kills, [area.name]: 0 };
    } else {
        waits[id] = respawnSeconds;
        const boss = slots.find((slot) => slot.boss && slot.area === area);
        //  Kills count while the boss sleeps, not while it is up.
        if (boss && !boss.alive) {
            const count = (kills[area.name] ?? 0) + 1;
            nextKills = { ...kills, [area.name]: count };
            if (count >= (area.bossAfter ?? Infinity)) wake = boss;
        }
    }
    useSpawns.setState({
        slots: slots.map((slot) =>
            slot.id === id
                ? { ...slot, alive: false }
                : slot === wake
                  ? { ...slot, generation: slot.generation + 1, alive: true }
                  : slot,
        ),
        kills: nextKills,
        lastArea: slain.boss ? null : area.name,
        awoken: wake
            ? {
                  name: wake.kind,
                  area: area.name,
                  count: (awoken?.count ?? 0) + 1,
              }
            : awoken,
    });
}

export function slotKind(id: number) {
    return useSpawns.getState().slots[id]?.kind;
}

export function countRespawns(deltaSeconds: number) {
    let returned: number[] | null = null;
    for (const slot of useSpawns.getState().slots) {
        if (slot.alive) continue;
        waits[slot.id] -= deltaSeconds;
        if (waits[slot.id] <= 0) (returned ??= []).push(slot.id);
    }
    if (!returned) return;
    const back = returned;
    useSpawns.setState(({ slots }) => ({
        slots: slots.map((slot) =>
            back.includes(slot.id)
                ? {
                      ...slot,
                      ...pointIn(slot.area),
                      generation: slot.generation + 1,
                      alive: true,
                  }
                : slot,
        ),
    }));
}
