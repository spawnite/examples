import type { ActiveSkillId } from "../hero/progress";

//  The player's combat input, which the page writes and the step reads: the
//  point on the ground under the pointer, whether an attack is held or was
//  pressed since the last step, and a potion asked for. One player a page,
//  so one record.

export const aim = {
    /** The point under the pointer, level with the hero's middle, in world
     *  metres. */
    x: 0,
    z: -1,
    /** Whether the pointer has been over the game yet. */
    known: false,
    /** Whether the attack aims itself, as a tap on a phone does: at the
     *  nearest monster in reach, else the way she faces. */
    auto: false,
    /** An attack button or key is down: the step keeps attacking. */
    held: false,
    /** A press the step has not attacked for yet, so a quick click that
     *  lets go between two steps still swings once. */
    pressed: false,
    /** A potion asked for that the step has not given yet. */
    potion: false,
    /** A skill asked for that the step has not cast yet, and whether the
     *  class editor asked for it, to see it cast whether or not she knows
     *  it or it is ready. */
    skill: null as ActiveSkillId | null,
    skillPreview: false,
    /** A dodge asked for that the step has not made yet, and its way on
     *  the ground: none for the way she walks, else the way she faces. */
    dodge: false,
    dodgeX: 0,
    dodgeZ: 0,
    /** The height of the hero's feet, which the step writes, so the pointer
     *  is cast onto her level on a slope as on the flat. */
    heroY: 0,
};

/** Starts an attack, aimed by the pointer, or by itself for a touch. */
export function pressAttack(auto = false) {
    aim.auto = auto;
    aim.held = true;
    aim.pressed = true;
}

export function releaseAttack() {
    aim.held = false;
}

/** Asks for a skill her gear or a tree gives, cast on the next step if it
 *  is ready. */
export function askForSkill(skill: ActiveSkillId) {
    aim.skill = skill;
    aim.skillPreview = false;
}

/** Casts a tree's skill on the next step as the class editor shows it: at
 *  its first rank, ready or not, known or not, with no stamina spent. */
export function previewSkill(skill: string) {
    aim.skill = skill;
    aim.skillPreview = true;
}

export function askForPotion() {
    aim.potion = true;
}

/** Asks for a dodge the way (dirX, dirZ) on the ground, or with none the
 *  way she walks, else the way she faces. */
export function askForDodge(dirX = 0, dirZ = 0) {
    aim.dodge = true;
    aim.dodgeX = dirX;
    aim.dodgeZ = dirZ;
}
