import { createQuery, type Entity, type TraitRecord, type World } from "koota";
import { Vector3 } from "three";
import {
    ChaseTrait,
    dealDamage,
    requireAuthority,
    HealthTrait,
    readEach,
    readField,
    TransformTrait,
    updateEach,
    type StepOptions,
} from "@spawnite/engine/core";
import {
    blazingSeconds,
    burnFade,
    burnNumberSeconds,
    burnTickSeconds,
    chillFade,
    chillSlow,
    Element,
    elementResistances,
    emberLevels,
    frostLevels,
    Mark,
    markSettleSeconds,
    meltdown,
    readElementLevel,
    readElementPower,
    shatter,
    steamCloud,
    topLevel,
} from "./elements";
import { addStrike, pushPoint, readHue } from "./strikes";
import {
    AfflictionsTrait,
    type AfflictionState,
    ElementLookTrait,
    FrozenTrait,
    lookSteps,
    MonsterTrait,
    SteamClockTrait,
    SteamTrait,
    StrikeKind,
} from "./traits";
import { monsterSettings } from "./waves";

//  What the elements leave on a monster: Ember's burn, which ticks harder
//  as it stacks, Frost's chill, which slows it and at full freezes it, and
//  the mark each builds at full, which glows until a different element
//  spends it or it wears off. And each step of them: the burn's ticks, the
//  fades, the freeze and the thaw, the steam clouds, the speed they leave
//  a monster, and what each page is shown.

/** A monster's afflictions, given it on the first element to touch it. */
export function readAfflictions(monster: Entity): AfflictionState {
    if (!monster.has(AfflictionsTrait)) monster.add(AfflictionsTrait);
    //  A factory trait: `get` hands back the record the step writes.
    const held = monster.get(AfflictionsTrait);
    if (!held) throw new Error("A monster lost the afflictions just added.");
    return held;
}

/** Whether `monster` stands with health left, and may wear a mark. */
function isStanding(monster: Entity) {
    return (monster.get(HealthTrait)?.current ?? 0) > 0;
}

/** A mark to put on a monster: which, who built it, and for how long. */
interface MarkPut {
    mark: Mark;
    by: Entity;
    seconds: number;
}

/** Puts the mark on the monster, unless a reaction left it resting or it
 *  is out of health. */
function putMark(
    monster: Entity,
    state: AfflictionState,
    { mark, by, seconds }: MarkPut,
) {
    if (state.restSeconds > 0 || !isStanding(monster)) return;
    if (state.mark !== mark) state.markAge = 0;
    state.mark = mark;
    state.markBy = by;
    state.markSeconds = seconds;
}

/** Spends the monster's mark: it glows no more, and neither wears a mark
 *  nor reacts again until its rest is over. Its burn and freeze go on. */
export function spendMark(state: AfflictionState, rest: number) {
    state.mark = Mark.None;
    state.markBy = null;
    state.markSeconds = 0;
    state.restSeconds = rest;
}

/** One element's dose landing on a monster: which monster, whose hit,
 *  how much, and at what level. */
export interface Dose {
    monster: Entity;
    warden: Entity;
    dose: number;
    level: number;
}

//  Written in place for each eruption and burst.
const center = new Vector3();

/** Meltdown: the monster erupts for a share of its greatest health, and
 *  each monster near it takes a share of that. */
function eruptMonster(
    world: World,
    { monster, warden }: Pick<Dose, "monster" | "warden">,
) {
    const feet = monster.get(TransformTrait);
    const maximum = monster.get(HealthTrait)?.maximum ?? 0;
    if (!feet) return;
    const amount = maximum * meltdown.share;
    center.copy(feet);
    dealDamage(requireAuthority(world), monster, { amount, source: warden });
    for (const other of findMonstersNear(world, center, meltdown.metres))
        if (other !== monster)
            dealDamage(requireAuthority(world), other, {
                amount: amount * meltdown.splash,
                source: warden,
            });
    const points: number[] = [];
    pushPoint(points, center);
    addStrike(world, { kind: StrikeKind.Meltdown, by: warden, points });
}

/** Ember's dose: burn builds toward full, and at full the monster wears
 *  the blazing mark; at Ember's capstone it erupts and its burn starts
 *  again from nothing. */
export function addBurn(world: World, { monster, warden, dose, level }: Dose) {
    const state = readAfflictions(monster);
    const { build } = emberLevels[level - 1];
    const kind = monster.get(MonsterTrait)?.kind;
    const resistance = kind ? elementResistances[kind].burn : 1;
    state.burn = Math.min(1, state.burn + (dose * build) / resistance);
    state.burnBy = warden;
    state.burnIdle = 0;
    if (state.burn < 1) return;
    if (state.mark !== Mark.Frozen)
        putMark(monster, state, {
            mark: Mark.Blazing,
            by: warden,
            seconds: blazingSeconds,
        });
    if (level < topLevel) return;
    state.burn = 0;
    eruptMonster(world, { monster, warden });
}

/** Freezes `monster` for `seconds`: it stops where it stands, its chill
 *  spent, and wears the frozen mark for as long. */
export function freezeMonster(
    monster: Entity,
    { by, seconds }: Pick<MarkPut, "by" | "seconds">,
) {
    const state = readAfflictions(monster);
    state.frozenSeconds = Math.max(state.frozenSeconds, seconds);
    state.frozenBy = by;
    state.chill = 0;
    if (!monster.has(FrozenTrait)) monster.add(FrozenTrait);
    if (state.mark !== Mark.Blazing)
        putMark(monster, state, {
            mark: Mark.Frozen,
            by,
            seconds: state.frozenSeconds,
        });
}

/** Seconds a monster of `monster`'s kind stays frozen at Frost `level`. */
function measureFreeze(monster: Entity, level: number) {
    const kind = monster.get(MonsterTrait)?.kind;
    const resistance = kind ? elementResistances[kind] : undefined;
    return frostLevels[level - 1].freezeSeconds * (resistance?.freeze ?? 1);
}

/** Frost's dose: chill builds toward full, harder monsters needing more,
 *  and at full the monster freezes. A frozen monster takes no chill. */
export function addChill(
    _world: World,
    { monster, warden, dose, level }: Dose,
) {
    const state = readAfflictions(monster);
    if (state.frozenSeconds > 0) return;
    const kind = monster.get(MonsterTrait)?.kind;
    const resistance = kind ? elementResistances[kind].chill : 1;
    state.chill = Math.min(
        1,
        state.chill + (dose * frostLevels[level - 1].build) / resistance,
    );
    state.chillBy = warden;
    state.chillIdle = 0;
    if (state.chill >= 1)
        freezeMonster(monster, {
            by: warden,
            seconds: measureFreeze(monster, level),
        });
}

/** Shatter: a frozen monster that dies, frozen by a warden at Frost's
 *  capstone, bursts, and freezes each monster near it and hurts it. */
export function shatterMonster(world: World, monster: Entity) {
    const state = monster.get(AfflictionsTrait);
    const by = state?.frozenBy;
    const feet = monster.get(TransformTrait);
    if (!state || state.frozenSeconds <= 0 || !by?.isAlive() || !feet) return;
    if (readElementLevel(by, Element.Frost) < topLevel) return;
    center.copy(feet);
    const power = readElementPower(by);
    for (const other of findMonstersNear(world, center, shatter.metres)) {
        if (other === monster) continue;
        dealDamage(requireAuthority(world), other, {
            amount: shatter.damage * power,
            source: by,
        });
        freezeMonster(other, { by, seconds: measureFreeze(other, topLevel) });
    }
    const points: number[] = [];
    pushPoint(points, center);
    addStrike(world, { kind: StrikeKind.Shatter, by, points });
}

const placedMonsters = createQuery(MonsterTrait, HealthTrait, TransformTrait);
//  The monsters one search found, refilled for each.
const near: Entity[] = [];

/** Each monster with health left whose feet stand within `metres` of
 *  `point`, level with the ground. A list refilled by the next call: read
 *  it at once. */
export function findMonstersNear(world: World, point: Vector3, metres: number) {
    near.length = 0;
    readEach(world, placedMonsters, ([, health, feet], monster) => {
        if (health.current <= 0) return;
        if (Math.hypot(feet.x - point.x, feet.z - point.z) <= metres)
            near.push(monster);
    });
    return near;
}

/** How hard a burn ticks at `burn`, from 0 to 1: harder the more it holds,
 *  full at full. */
function measureBurnCurve(burn: number) {
    return burn * (0.4 + 0.6 * burn);
}

/** Health a second the monster's burn takes now. */
function measureBurnPerSecond(monster: Entity, state: AfflictionState) {
    const by = state.burnBy?.isAlive() ? state.burnBy : null;
    const level = by ? Math.max(1, readElementLevel(by, Element.Ember)) : 1;
    const { flat, share } = emberLevels[level - 1];
    const maximum = monster.get(HealthTrait)?.maximum ?? 0;
    const power = by ? readElementPower(by) : 1;
    return (flat + share * maximum) * measureBurnCurve(state.burn) * power;
}

/** One step of a monster's burn: its tick, and its fade once no Ember hit
 *  has fed it for a while. */
function tendBurn(
    world: World,
    monster: Entity,
    state: AfflictionState,
    seconds: number,
) {
    if (state.burn <= 0) return;
    state.burnIdle += seconds;
    state.burnTick -= seconds;
    state.burnShowSeconds -= seconds;
    const by = state.burnBy?.isAlive() ? state.burnBy : null;
    let lethal = false;
    if (state.burnTick <= 0) {
        state.burnTick += burnTickSeconds;
        const amount = measureBurnPerSecond(monster, state) * burnTickSeconds;
        const left = monster.get(HealthTrait)?.current ?? 0;
        dealDamage(requireAuthority(world), monster, { amount, source: by });
        //  The first tick of a burn starts its second.
        if (state.burnTaken === 0) state.burnShowSeconds = burnNumberSeconds;
        //  A tick that brings it down shows at once, for what it took,
        //  before the monster is taken away.
        lethal = amount >= left;
        state.burnTaken += Math.min(amount, left);
    }
    if (state.burnIdle > burnFade.afterSeconds)
        state.burn = Math.max(0, state.burn - burnFade.perSecond * seconds);
    if (state.burn === 0) state.burnTick = 0;
    if (
        state.burnTaken > 0 &&
        (lethal || state.burnShowSeconds <= 0 || state.burn === 0)
    )
        emitBurnNumber(world, monster, state, by);
}

/** Emits the health a burn's ticks took since its last number, as one
 *  number over the monster, and starts its count again. */
function emitBurnNumber(
    world: World,
    monster: Entity,
    state: AfflictionState,
    by: Entity | null,
) {
    const feet = monster.get(TransformTrait);
    if (feet) {
        const points: number[] = [];
        pushPoint(points, feet);
        addStrike(world, {
            kind: StrikeKind.Burn,
            by,
            amount: state.burnTaken,
            points,
        });
    }
    state.burnTaken = 0;
    state.burnShowSeconds = burnNumberSeconds;
}

/** One step of a monster's chill, freeze, mark and rest. */
function tendChill(monster: Entity, state: AfflictionState, seconds: number) {
    state.chillIdle += seconds;
    if (state.chill > 0 && state.chillIdle > chillFade.afterSeconds)
        state.chill = Math.max(0, state.chill - chillFade.perSecond * seconds);
    if (state.frozenSeconds > 0) {
        state.frozenSeconds = Math.max(0, state.frozenSeconds - seconds);
        if (state.frozenSeconds === 0) {
            monster.remove(FrozenTrait);
            if (state.mark === Mark.Frozen) state.mark = Mark.None;
        }
    }
    if (state.mark !== Mark.None) {
        state.markAge += seconds;
        state.markSeconds -= seconds;
        if (state.markSeconds <= 0) {
            state.mark = Mark.None;
            state.markBy = null;
        }
    }
    state.restSeconds = Math.max(0, state.restSeconds - seconds);
}

/** The share of its speed a monster keeps: none frozen, less the more it
 *  is chilled and in steam. */
function measurePace(state: AfflictionState) {
    if (state.frozenSeconds > 0) return 0;
    return (1 - chillSlow * state.chill) * (1 - state.steamSlow);
}

//  What pages are shown of one monster, written in place for each.
const look: TraitRecord<typeof ElementLookTrait> = {
    burn: 0,
    chill: 0,
    frozen: false,
    mark: "",
    resting: false,
    burnHue: -1,
    chillHue: -1,
    markHue: -1,
};

/** Whether `look` shows nothing: a monster Storm alone has struck. */
function isLookEmpty() {
    return (
        look.burn === 0 &&
        look.chill === 0 &&
        !look.frozen &&
        look.mark === "" &&
        !look.resting
    );
}

/** Whether the monster's shown look is `look`, read field by field, so the
 *  step builds no record. */
function isShown(monster: Entity) {
    return (
        readField(monster, ElementLookTrait, "burn") === look.burn &&
        readField(monster, ElementLookTrait, "chill") === look.chill &&
        readField(monster, ElementLookTrait, "frozen") === look.frozen &&
        readField(monster, ElementLookTrait, "mark") === look.mark &&
        readField(monster, ElementLookTrait, "resting") === look.resting &&
        readField(monster, ElementLookTrait, "burnHue") === look.burnHue &&
        readField(monster, ElementLookTrait, "chillHue") === look.chillHue &&
        readField(monster, ElementLookTrait, "markHue") === look.markHue
    );
}

/** Sets what pages draw of the monster's elements, where it changed; a
 *  monster that shows nothing yet is given no look. */
function showAfflictions(monster: Entity, state: AfflictionState) {
    look.burn = Math.ceil(state.burn * lookSteps);
    look.chill = Math.ceil(state.chill * lookSteps);
    look.frozen = state.frozenSeconds > 0;
    //  A mark glows once it has settled, when a different element can set
    //  it off.
    const settled = state.markAge >= markSettleSeconds;
    look.mark = settled ? state.mark : Mark.None;
    look.resting = state.restSeconds > 0;
    look.burnHue = state.burn > 0 ? readHue(state.burnBy) : -1;
    look.chillHue = state.chill > 0 ? readHue(state.chillBy) : -1;
    look.markHue = look.mark === Mark.None ? -1 : readHue(state.markBy);
    if (!monster.has(ElementLookTrait)) {
        if (!isLookEmpty()) monster.add(ElementLookTrait(look));
        return;
    }
    if (!isShown(monster)) monster.set(ElementLookTrait, look);
}

const afflicted = createQuery(MonsterTrait, AfflictionsTrait, ChaseTrait);
const clouds = createQuery(SteamTrait, SteamClockTrait, TransformTrait);
//  Written in place for each cloud.
const cloudAt = new Vector3();

/** Each steam cloud slows the monsters inside it this step, and burns them
 *  each time its tick comes round, to the warden who set it off. */
function tendClouds(world: World, seconds: number) {
    readEach(world, clouds, ([cloud, clock, at]) => {
        cloudAt.copy(at);
        clock.tickSeconds -= seconds;
        const tick = clock.tickSeconds <= 0;
        if (tick) clock.tickSeconds += burnTickSeconds;
        const by = clock.by?.isAlive() ? clock.by : null;
        const amount =
            steamCloud.perSecond *
            burnTickSeconds *
            (by ? readElementPower(by) : 1);
        for (const monster of findMonstersNear(world, cloudAt, cloud.radius)) {
            readAfflictions(monster).steamSlow = steamCloud.slow;
            if (tick)
                dealDamage(requireAuthority(world), monster, {
                    amount,
                    source: by,
                });
        }
    });
}

/** One step of every monster's elements: the steam clouds' slow and burn,
 *  each burn's tick and fade, each chill's fade, each freeze's thaw, each
 *  mark's and rest's clock, the speed they leave it, and what pages draw
 *  of them. */
export function tendAfflictions(world: World, { deltaSeconds }: StepOptions) {
    tendClouds(world, deltaSeconds);
    updateEach(world, afflicted, ([settings, state, chase], monster) => {
        tendBurn(world, monster, state, deltaSeconds);
        tendChill(monster, state, deltaSeconds);
        const speed = settings.speed * measurePace(state);
        state.steamSlow = 0;
        if (Math.abs(chase.speed - speed) > 0.01) chase.speed = speed;
        showAfflictions(monster, state);
    });
}

/** Metres above its feet an effect on `monster` reads at: its chest. */
export function measureChest(monster: Entity) {
    const settings = monster.get(MonsterTrait);
    if (!settings) return 1;
    return monsterSettings[settings.kind].height * settings.size * 0.6;
}
