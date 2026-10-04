import { hybridOf, jobRules, readClasses } from "../classes/catalog";
import type { ClassDef, SkillDef, Unlock } from "../classes/schema";
import type { WeaponKind } from "../items/items";
import type { Progress } from "./progress";

//  What her jobs make of her, read from her save and the class files: her
//  classes and their trees, the skill points she has left, what she can
//  learn next, and what her skills do with the weapon in her hand.

export type JobProgress = Pick<Progress, "level" | "jobs" | "skillRanks">;

/** The name her class goes by before her first job. */
export const baseClassName = "Adventurer";

/** Her classes: her first job, her second, and the hybrid the two make,
 *  each that she has and that reads. */
export function heroClasses({ jobs }: JobProgress): ClassDef[] {
    const { byId } = readClasses();
    const held = jobs
        .map((id) => byId.get(id))
        .filter((each): each is ClassDef => each !== undefined);
    const hybrid =
        held.length === 2 ? hybridOf(held[0].id, held[1].id) : undefined;
    return hybrid ? [...held, hybrid] : held;
}

/** What she is called: Adventurer, her job, or her two jobs' hybrid, or
 *  both jobs' names where no hybrid is written for them. */
export function heroClassName(progress: JobProgress) {
    const classes = heroClasses(progress);
    const hybrid = classes.find((each) => each.kind === "hybrid");
    if (hybrid) return hybrid.name;
    if (classes.length === 0) return baseClassName;
    return classes.map((each) => each.name).join(" / ");
}

/** The level at which each job slot opens: her first job, then her
 *  second. */
export const jobLevels = [jobRules.firstJobLevel, jobRules.secondJobLevel];

/** Skill points she has earned: some each level past the first, saved up
 *  from the start, so her first job comes with them. */
export const skillPointsEarned = (level: number) =>
    Math.max(0, level - 1) * jobRules.skillPointsPerLevel;

/** The rank she knows a skill at. */
export const rankOf = ({ skillRanks }: JobProgress, id: string) =>
    skillRanks[id] ?? 0;

/** Points she has spent in one class's tree. */
export function pointsInTree(progress: JobProgress, tree: ClassDef) {
    return tree.skills.reduce(
        (total, skill) => total + rankOf(progress, skill.id),
        0,
    );
}

/** Skill points she has earned and not spent in a tree she has. */
export function skillPointsLeft(progress: JobProgress) {
    const spent = heroClasses(progress).reduce(
        (total, tree) => total + pointsInTree(progress, tree),
        0,
    );
    return skillPointsEarned(progress.level) - spent;
}

/** Why she cannot learn a rank of the skill now, in a line she can act
 *  on; null when she can. */
export function whyNotLearn(progress: JobProgress, id: string): string | null {
    const found = readClasses().skills.get(id);
    if (!found) return "No such skill.";
    const { skill, owner } = found;
    if (!heroClasses(progress).includes(owner))
        return owner.kind === "hybrid"
            ? `Become a ${owner.name} to learn it.`
            : `Take the ${owner.name} job at the trainer to learn it.`;
    if (rankOf(progress, id) >= skill.ranks) return "Learned to its last rank.";
    if (skill.needsPoints > pointsInTree(progress, owner))
        return `Spend ${skill.needsPoints} points in ${owner.name} first.`;
    if (
        skill.needsSkill &&
        rankOf(progress, skill.needsSkill) < skill.needsRank
    ) {
        const needed = owner.skills.find(
            (each) => each.id === skill.needsSkill,
        );
        return `Learn ${needed?.name ?? skill.needsSkill}${skill.needsRank > 1 ? ` to rank ${skill.needsRank}` : ""} first.`;
    }
    if (skillPointsLeft(progress) <= 0)
        return "No skill points left. Each level gives one.";
    return null;
}

/** Whether a skill works with a weapon of `kind` in her main hand. */
export const worksWith = (skill: SkillDef, kind: WeaponKind) =>
    skill.weapon === "any" || skill.weapon === kind;

/** A skill she knows, at the rank she knows it. */
export type LearnedSkill = { skill: SkillDef; rank: number };

/** Each skill she knows, at its rank, that works with a weapon of
 *  `kind`. */
export function workingSkills(
    progress: JobProgress,
    kind: WeaponKind,
): LearnedSkill[] {
    return heroClasses(progress).flatMap((tree) =>
        tree.skills
            .filter(
                (skill) =>
                    rankOf(progress, skill.id) > 0 && worksWith(skill, kind),
            )
            .map((skill) => ({ skill, rank: rankOf(progress, skill.id) })),
    );
}

/** Whether a skill she knows unlocks `unlock` for a weapon of `kind`. */
export const unlocked = (
    progress: JobProgress,
    unlock: Unlock,
    kind: WeaponKind,
) =>
    workingSkills(progress, kind).some(({ skill }) =>
        skill.unlocks.includes(unlock),
    );
