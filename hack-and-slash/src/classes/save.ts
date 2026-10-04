import type { ActiveDef, ClassDef, SkillDef } from "./schema";

//  The class editor's way to disk: a class written back in its file's
//  shape, and the dev server's route that saves or removes the file. A
//  built game has no dev server, so there the editor copies the JSON.

/** The dev server's route, as `classFiles.mts` serves it. */
const route = "/__bladebound/classes/";

/** Whether this page can save: only a page the dev server serves. */
export const canSave = import.meta.env.DEV;

/** What casting a skill does as its file holds it: only the fields its
 *  action reads. */
function activeFile({
    action,
    cooldown,
    stamina,
    damage,
    damagePerRank,
    ...rest
}: ActiveDef) {
    const base = { action, cooldown, stamina, damage, damagePerRank };
    if (action === "volley")
        return { ...base, count: rest.count, fan: rest.fan };
    return {
        ...base,
        shape: rest.shape,
        reach: rest.reach,
        ...(rest.shape === "cone" ? { spread: rest.spread } : {}),
    };
}

/** A skill as its class's file holds it, in one order: every field a file
 *  may leave out left out where it holds its default, so saving a class
 *  changes only what was edited. */
function skillFile(skill: SkillDef, weapon: ClassDef["weapon"]) {
    return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        sign: skill.sign,
        color: skill.color,
        row: skill.row,
        column: skill.column,
        ranks: skill.ranks,
        ...(skill.weapon !== weapon ? { weapon: skill.weapon } : {}),
        ...(skill.needsPoints ? { needsPoints: skill.needsPoints } : {}),
        ...(skill.needsSkill
            ? { needsSkill: skill.needsSkill, needsRank: skill.needsRank }
            : {}),
        ...(skill.modifiers.length ? { modifiers: skill.modifiers } : {}),
        ...(skill.unlocks.length ? { unlocks: skill.unlocks } : {}),
        ...(skill.active ? { active: activeFile(skill.active) } : {}),
        ...(skill.cue ? { cue: skill.cue } : {}),
    };
}

/** A class as its file holds it, in one order: its id is the file's name,
 *  a job has no pair, and each skill leaves out its defaults. */
export function classFile(def: ClassDef) {
    return {
        name: def.name,
        kind: def.kind,
        weapon: def.weapon,
        ...(def.kind === "hybrid" ? { pair: def.pair } : {}),
        description: def.description,
        color: def.color,
        skills: def.skills.map((skill) => skillFile(skill, def.weapon)),
    };
}

/** The class's file as text, to copy. */
export const classJson = (def: ClassDef) =>
    `${JSON.stringify(classFile(def), null, 4)}\n`;

/** Saves the class to `src/classes/<id>.json`. Says why not, or null once
 *  saved. */
export async function saveClass(def: ClassDef) {
    if (!canSave)
        return "Saving works on the dev server; copy the JSON instead.";
    const response = await fetch(`${route}${def.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(classFile(def)),
    }).catch((error: Error) => error);
    if (response instanceof Error)
        return `The dev server did not answer: ${response.message}`;
    return response.ok ? null : await response.text();
}

/** Removes `src/classes/<id>.json`. Says why not, or null once gone. */
export async function deleteClassFile(id: string) {
    if (!canSave) return "Removing a file works on the dev server only.";
    const response = await fetch(`${route}${id}`, { method: "DELETE" }).catch(
        (error: Error) => error,
    );
    if (response instanceof Error)
        return `The dev server did not answer: ${response.message}`;
    return response.ok ? null : await response.text();
}
