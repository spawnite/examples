import { slotTexture } from "../items/icons";
import {
    items,
    type EquipSlot,
    type ItemId,
    type SkillId,
} from "../items/items";
import type { ActiveSkillId, QuickSlot } from "../hero/progress";
import { readClasses } from "../classes/catalog";
import { describeActive } from "../classes/describe";
import type { SkillSign } from "../classes/schema";

//  Each item's picture, each empty slot's outline and each skill's sign,
//  as a picture the page can show. An item's picture is a photograph of it
//  as the game draws it, taken by scripts/icon-bake.html into
//  public/icons; the rest are drawn once, then kept.

const pictureUrls = new Map<string, string>();
function pictureUrl(key: string, draw: () => string) {
    let url = pictureUrls.get(key);
    if (!url) {
        url = draw();
        pictureUrls.set(key, url);
    }
    return url;
}

const canvasUrl = (texture: { image: unknown }) =>
    (texture.image as HTMLCanvasElement).toDataURL();

export const iconUrl = (id: ItemId) =>
    `${import.meta.env.BASE_URL}icons/${id}.png`;

export const slotUrl = (slot: EquipSlot) =>
    pictureUrl(`slot-${slot}`, () => canvasUrl(slotTexture(slot)));

/** The skills her gear gives: the Cyclone, a whirl of blades. */
const gearSkills: Record<SkillId, { name: string; hint: string; svg: string }> =
    {
        cyclone: {
            name: "Cyclone",
            hint: "Spin, hitting everything around you, for as long as your stamina lasts. Uses all your stamina; 15 s cooldown.",
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke-linecap="round"><path d="M16 16 m-9 0 a9 9 0 1 1 9 9" stroke="#5ae0ff" stroke-width="3.2"/><path d="M16 16 m-4.5 0 a4.5 4.5 0 1 1 4.5 4.5" stroke="#e8fbff" stroke-width="2.6"/></g><path d="M16 25 l-4 -1.5 l2.5 -3z" fill="#5ae0ff"/><circle cx="16" cy="16" r="1.8" fill="#e8fbff"/></svg>`,
        },
    };

const isGearSkill = (id: string): id is SkillId => id in gearSkills;

/** Each sign a tree's skill can show, drawn in its colour (`C`) with a
 *  pale light (`L`), on a 32-unit square. */
const signShapes: Record<SkillSign, string> = {
    blade: `<g stroke-linecap="round" fill="none"><path d="M9 23 L25 7" stroke="C" stroke-width="3.6"/><path d="M6 20 L12 26" stroke="L" stroke-width="2.6"/></g><circle cx="6.5" cy="25.5" r="2" fill="L"/>`,
    twinBlades: `<g stroke-linecap="round" fill="none"><path d="M7 25 L25 7" stroke="C" stroke-width="3.2"/><path d="M25 25 L7 7" stroke="C" stroke-width="3.2"/><path d="M5 20 L10 25 M27 20 L22 25" stroke="L" stroke-width="2.4"/></g>`,
    whirl: `<g fill="none" stroke-linecap="round"><path d="M16 16 m-9 0 a9 9 0 1 1 9 9" stroke="C" stroke-width="3.2"/><path d="M16 16 m-4.5 0 a4.5 4.5 0 1 1 4.5 4.5" stroke="L" stroke-width="2.6"/></g><path d="M16 25 l-4 -1.5 l2.5 -3z" fill="C"/>`,
    bolt: `<g stroke-linecap="round" fill="none"><path d="M6 26 L24 8" stroke="C" stroke-width="3"/><path d="M6 26 l4 0 M6 26 l0 -4" stroke="L" stroke-width="2.4"/></g><path d="M27 5 l-7 2 l5 5z" fill="L"/>`,
    twinBolts: `<g stroke-linecap="round" fill="none"><path d="M4 22 L19 7 M12 28 L27 13" stroke="C" stroke-width="2.8"/></g><path d="M22 4 l-6 1.6 l4.4 4.4z M30 10 l-6 1.6 l4.4 4.4z" fill="L"/>`,
    volley: `<g stroke-linecap="round" fill="none" stroke="C" stroke-width="2.6"><path d="M16 28 L16 9"/><path d="M14 28 L6 11"/><path d="M18 28 L26 11"/></g><path d="M16 4 l-3 6 h6z M5 7 l-1 6.5 l5.4 -2.6z M27 7 l1 6.5 l-5.4 -2.6z" fill="L"/>`,
    haste: `<g stroke-linecap="round" fill="none"><path d="M4 10 h9 M2 16 h10 M4 22 h9" stroke="L" stroke-width="2.4"/><path d="M15 7 l9 9 l-9 9 M21 7 l9 9 l-9 9" stroke="C" stroke-width="3"/></g>`,
    aim: `<g fill="none" stroke-linecap="round"><circle cx="16" cy="16" r="9" stroke="C" stroke-width="3"/><path d="M16 3 v7 M16 22 v7 M3 16 h7 M22 16 h7" stroke="L" stroke-width="2.4"/></g><circle cx="16" cy="16" r="2.2" fill="C"/>`,
    flame: `<path d="M16 29 c-6 0 -9 -4 -9 -9 c0 -5 4 -7 5 -12 c3 3 4 5 4 8 c1 -2 2 -3 2 -6 c4 3 6 7 6 11 c0 5 -3 8 -8 8z" fill="C"/><path d="M16 27 c-3 0 -4 -2 -4 -4 c0 -3 3 -4 4 -7 c2 2 4 4 4 7 c0 2 -1 4 -4 4z" fill="L"/>`,
    shield: `<path d="M16 3 L27 7 V15 C27 22 22 26 16 29 C10 26 5 22 5 15 V7 Z" fill="C"/><path d="M16 7 L23 9.6 V15 C23 19.6 20 22.4 16 24.6 Z" fill="L" opacity="0.7"/>`,
    heart: `<path d="M16 28 C6 21 3 16 3 11 C3 7 6 4 10 4 C13 4 15 6 16 8 C17 6 19 4 22 4 C26 4 29 7 29 11 C29 16 26 21 16 28 Z" fill="C"/><path d="M9 9 C10 7.6 12 7.6 13 9" stroke="L" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    star: `<path d="M16 3 L19.8 11.6 L29 12.4 L22 18.6 L24.2 28 L16 23 L7.8 28 L10 18.6 L3 12.4 L12.2 11.6 Z" fill="C"/><circle cx="16" cy="16" r="3.4" fill="L"/>`,
};

/** A sign drawn in `color`, as an SVG document. */
export function signSvg(sign: SkillSign, color: string) {
    const shape = signShapes[sign]
        .replaceAll('"C"', `"${color}"`)
        .replaceAll('"L"', '"#f4fbff"');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${shape}</svg>`;
}

const svgUrl = (svg: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** A sign in `color` as a picture, for a tree's node or the editor. */
export const signUrl = (sign: SkillSign, color: string) =>
    pictureUrl(`sign-${sign}-${color}`, () => svgUrl(signSvg(sign, color)));

/** A skill's name: its gear's, or its class file's. */
export function skillName(id: ActiveSkillId) {
    if (isGearSkill(id)) return gearSkills[id].name;
    return readClasses().skills.get(id)?.skill.name ?? id;
}

/** What casting a skill does, in a line. */
export function skillHint(id: ActiveSkillId) {
    if (isGearSkill(id)) return gearSkills[id].hint;
    const skill = readClasses().skills.get(id)?.skill;
    if (!skill?.active) return skill?.description ?? "";
    return `${skill.description} ${describeActive(skill.active, 1)}`;
}

export function skillUrl(id: ActiveSkillId) {
    if (isGearSkill(id))
        return pictureUrl(`skill-${id}`, () => svgUrl(gearSkills[id].svg));
    const skill = readClasses().skills.get(id)?.skill;
    return skill
        ? signUrl(skill.sign, skill.color)
        : signUrl("star", "#9aa4ae");
}

/** Whether a pad holds an item rather than a skill. */
export const isItem = (slot: QuickSlot): slot is ItemId => slot in items;

/** Whether a drag carries what a paw's pad holds: an item's id or a
 *  skill's, both strings. */
export const isQuickSlot = (data: unknown): data is QuickSlot =>
    typeof data === "string";

/** What a pad or a dragged thing shows. */
export const quickUrl = (slot: QuickSlot) =>
    isItem(slot) ? iconUrl(slot) : skillUrl(slot);
