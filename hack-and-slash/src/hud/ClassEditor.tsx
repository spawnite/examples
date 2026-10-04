import { useState, type ReactNode } from "react";
import {
    Button,
    Icon,
    Image,
    NumberField,
    Select,
    Slot,
    Text,
    TextField,
    Toggle,
    Window,
} from "@spawnite/engine";
import { previewSkill } from "../combat/aim";
import {
    discardEdit,
    editClass,
    jobClasses,
    readClasses,
    useCatalog,
} from "../classes/catalog";
import { describeSkill } from "../classes/describe";
import {
    canSave,
    classJson,
    deleteClassFile,
    saveClass,
} from "../classes/save";
import {
    actionKinds,
    areaShapes,
    classKinds,
    cueElements,
    cueMoves,
    defaultActive,
    defaultCue,
    idPattern,
    modifierStatNames,
    modifierStats,
    readClass,
    skillSigns,
    unlockNames,
    type ActiveDef,
    type ClassDef,
    type CueDef,
    type SkillDef,
    type SkillWeapon,
} from "../classes/schema";
import { useProgress } from "../hero/progress";
import { weaponKinds } from "../items/items";
import { field } from "./GmWindow";
import { signUrl } from "./pictures";
import { Tree } from "./SkillWindow";
import { closeWindow, useWindows } from "./windows";

//  The class editor, from the GM tools: every class and skill the class
//  files hold, edited in place while the game runs, so a number, a move or
//  an effect shows as it changes; then saved back to its file through the
//  dev server. A new class or skill starts here too. Only a new kind of
//  modifier, unlock, action, move or sign needs code: the lists in
//  `src/classes/schema.ts`, which this editor offers as they stand.

export function ClassEditor() {
    const open = useWindows((state) => state.classes);
    const files = useCatalog((state) => state.files);
    const edits = useCatalog((state) => state.edits);
    useCatalog((state) => state.version);
    const progress = useProgress();
    const [classId, setClassId] = useState<string | null>(null);
    const [skillId, setSkillId] = useState<string | null>(null);
    const [news, setNews] = useState<string | null>(null);
    if (!open) return null;
    const close = () => closeWindow("classes");
    const { list, errors } = readClasses();
    const chosen = list.find((each) => each.id === classId) ?? list[0];
    const skill =
        chosen?.skills.find((each) => each.id === skillId) ?? chosen?.skills[0];
    const saved = (id: string) => id in files;

    const addClass = (kind: ClassDef["kind"]) => {
        const jobs = jobClasses();
        const id = freeId(kind === "job" ? "newJob" : "newHybrid", (each) =>
            list.some((one) => one.id === each),
        );
        editClass({
            id,
            name: kind === "job" ? "New job" : "New hybrid",
            kind,
            weapon: "sword",
            pair:
                kind === "hybrid" ? jobs.slice(0, 2).map((job) => job.id) : [],
            description: "",
            color: "#9fd8ff",
            skills: [],
        });
        setClassId(id);
        setSkillId(null);
        setNews(`Made ${id}; save to write src/classes/${id}.json.`);
    };

    const body = (
        <Text as="div" className="flex w-full flex-col gap-2">
            <Text size="xs" className="opacity-70">
                Changes play at once; Save writes src/classes/&lt;id&gt;.json
            </Text>
            {errors.length > 0 && (
                <Text
                    as="div"
                    className="flex flex-col gap-0.5 rounded-xl bg-red-950/70 p-2"
                >
                    {errors.map((error) => (
                        <Text key={error} size="xs" className="text-red-200">
                            {error}
                        </Text>
                    ))}
                </Text>
            )}
            <Text as="div" className="flex flex-wrap items-center gap-1.5">
                {list.map((each) => (
                    <Button
                        key={each.id}
                        pressed={each.id === chosen?.id}
                        onPress={() => {
                            setClassId(each.id);
                            setSkillId(null);
                            setNews(null);
                        }}
                        className="h-8 rounded-xl px-2.5 text-xs"
                    >
                        {each.name}
                        {each.kind === "hybrid" ? " ◆" : ""}
                        {each.id in edits ? " •" : ""}
                    </Button>
                ))}
                <Button
                    onPress={() => addClass("job")}
                    className="h-8 rounded-xl px-2.5 text-xs"
                >
                    + Job
                </Button>
                <Button
                    onPress={() => addClass("hybrid")}
                    className="h-8 rounded-xl px-2.5 text-xs"
                >
                    + Hybrid
                </Button>
            </Text>
            {news && (
                <Text size="xs" className="rounded-lg bg-black/40 px-2 py-1">
                    {news}
                </Text>
            )}
            {chosen && (
                <>
                    <ClassForm
                        def={chosen}
                        saved={saved(chosen.id)}
                        onRenamed={(id) => setClassId(id)}
                        onNews={setNews}
                    />
                    <Text as="div" className="flex flex-wrap items-start gap-2">
                        <Tree
                            tree={chosen}
                            progress={progress}
                            preview
                            chosen={skill?.id ?? null}
                            onChoose={(id) => setSkillId(id)}
                        />
                        <Button
                            onPress={() => {
                                const added = newSkill(chosen);
                                editClass({
                                    ...chosen,
                                    skills: [...chosen.skills, added],
                                });
                                setSkillId(added.id);
                            }}
                            className="h-9 rounded-xl px-3 text-sm"
                        >
                            + Skill
                        </Button>
                    </Text>
                    {skill && (
                        <SkillForm
                            def={chosen}
                            skill={skill}
                            savedIds={savedSkillIds(
                                files[chosen.id],
                                chosen.id,
                            )}
                            onChoose={setSkillId}
                        />
                    )}
                    <Text
                        as="div"
                        className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-2"
                    >
                        <Button
                            pressed={chosen.id in edits}
                            onPress={async () => {
                                const why = await saveClass(chosen);
                                setNews(
                                    why ??
                                        `Saved src/classes/${chosen.id}.json.`,
                                );
                            }}
                            className="h-9 rounded-xl px-3 text-sm"
                        >
                            {canSave ? "Save" : "Save (dev server only)"}
                        </Button>
                        {chosen.id in edits && saved(chosen.id) && (
                            <Button
                                onPress={() => {
                                    discardEdit(chosen.id);
                                    setNews(
                                        `Back to src/classes/${chosen.id}.json as saved.`,
                                    );
                                }}
                                className="h-9 rounded-xl px-3 text-sm"
                            >
                                Discard changes
                            </Button>
                        )}
                        <Button
                            onPress={() => {
                                navigator.clipboard
                                    ?.writeText(classJson(chosen))
                                    .then(() =>
                                        setNews(`Copied ${chosen.id}.json.`),
                                    )
                                    .catch(() =>
                                        setNews("The page may not copy here."),
                                    );
                            }}
                            className="h-9 rounded-xl px-3 text-sm"
                        >
                            Copy JSON
                        </Button>
                        <Button
                            onPress={async () => {
                                const why = saved(chosen.id)
                                    ? await deleteClassFile(chosen.id)
                                    : null;
                                if (why) return setNews(why);
                                discardEdit(chosen.id);
                                setClassId(null);
                                setNews(`Removed ${chosen.id}.`);
                            }}
                            className="h-9 rounded-xl px-3 text-sm text-red-200"
                        >
                            Delete class
                        </Button>
                    </Text>
                </>
            )}
        </Text>
    );
    //  Down the right of the screen, the world left in view, so a cast is
    //  seen as its cue changes.
    return (
        <Window
            id="classes"
            title="Class editor"
            open
            onClose={close}
            slot={Slot.Right}
            className="max-h-[calc(100dvh-1.5rem)] w-[min(40rem,100%)]"
        >
            {body}
        </Window>
    );
}

/** The first of `base`, `base2`, `base3`… that `taken` does not hold. */
function freeId(base: string, taken: (id: string) => boolean) {
    let id = base;
    for (let count = 2; taken(id); count++) id = `${base}${count}`;
    return id;
}

/** The ids of the skills a class's file holds, which the editor keeps
 *  fixed: a player's save keeps her ranks by them. */
function savedSkillIds(raw: unknown, id: string) {
    const def = raw === undefined ? null : readClass(id, raw).def;
    return new Set(def?.skills.map((skill) => skill.id) ?? []);
}

/** A new skill for `tree`: a passive under its last row. */
function newSkill(tree: ClassDef): SkillDef {
    const { skills } = readClasses();
    const id = freeId(`${tree.id}Skill`, (each) => skills.has(each));
    return {
        id,
        name: "New skill",
        description: "",
        sign: "star",
        color: tree.color,
        row: tree.skills.reduce(
            (most, skill) => Math.max(most, skill.row + 1),
            0,
        ),
        column: 0,
        ranks: 1,
        needsPoints: 0,
        needsSkill: "",
        needsRank: 1,
        weapon: tree.weapon,
        modifiers: [{ stat: "damage", perRank: 5 }],
        unlocks: [],
        active: null,
        cue: null,
    };
}

/** A labelled field. */
function Labelled({
    label,
    children,
    wide = false,
}: {
    label: string;
    children: ReactNode;
    wide?: boolean;
}) {
    return (
        <Text
            as="label"
            className={`flex min-w-0 flex-col gap-0.5 ${wide ? "col-span-full" : ""}`}
        >
            <Text className="text-[0.7rem] text-white/70">{label}</Text>
            {children}
        </Text>
    );
}

/** A number field, named for a screen reader by the label over it. */
function NumberInput({
    label,
    value,
    onChange,
    step = 1,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    step?: number;
}) {
    return (
        <NumberField
            label={label}
            value={value}
            step={step}
            onChange={onChange}
        />
    );
}

function Choice<Option extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: Option;
    options: readonly Option[];
    onChange: (value: Option) => void;
}) {
    return (
        <Select
            label={label}
            value={value}
            options={options}
            onChange={(picked) => onChange(picked as Option)}
            className={field}
        />
    );
}

/** The class's own fields: its id while unsaved, name, kind, weapon, a
 *  hybrid's pair, colour and description. */
function ClassForm({
    def,
    saved,
    onRenamed,
    onNews,
}: {
    def: ClassDef;
    saved: boolean;
    onRenamed: (id: string) => void;
    onNews: (news: string) => void;
}) {
    const update = (change: Partial<ClassDef>) =>
        editClass({ ...def, ...change });
    const jobs = jobClasses().filter((job) => job.id !== def.id);
    const jobIds = jobs.map((job) => job.id);
    return (
        <Text
            as="div"
            className="grid grid-cols-2 gap-1.5 rounded-xl bg-black/30 p-2 sm:grid-cols-4"
        >
            <Labelled
                label={saved ? "Id (its file's name)" : "Id (fixed once saved)"}
            >
                <TextField
                    className={field}
                    label={
                        saved ? "Id (its file's name)" : "Id (fixed once saved)"
                    }
                    value={def.id}
                    readOnly={saved}
                    onChange={(text) => {
                        const id = text;
                        if (!idPattern.test(id) || readClasses().byId.has(id))
                            return onNews(
                                `"${id}" is taken or not an id: a lowercase letter, then letters and digits.`,
                            );
                        discardEdit(def.id);
                        editClass({ ...def, id });
                        onRenamed(id);
                    }}
                />
            </Labelled>
            <Labelled label="Name">
                <TextField
                    className={field}
                    label="Name"
                    value={def.name}
                    onChange={(text) => update({ name: text })}
                />
            </Labelled>
            <Labelled label="Kind">
                <Choice
                    label="Kind"
                    value={def.kind}
                    options={classKinds}
                    onChange={(kind) =>
                        update({
                            kind,
                            pair: kind === "hybrid" ? jobIds.slice(0, 2) : [],
                        })
                    }
                />
            </Labelled>
            <Labelled label="Weapon of its skills">
                <Choice
                    label="Weapon of its skills"
                    value={def.weapon}
                    options={weaponKinds}
                    onChange={(weapon) => update({ weapon })}
                />
            </Labelled>
            {def.kind === "hybrid" &&
                [0, 1].map((index) => (
                    <Labelled
                        key={index}
                        label={index === 0 ? "Made of" : "and"}
                    >
                        <Choice
                            label={index === 0 ? "Made of" : "and"}
                            value={def.pair[index] ?? jobIds[0]}
                            options={jobIds}
                            onChange={(job) => {
                                const pair = [...def.pair];
                                pair[index] = job;
                                update({ pair });
                            }}
                        />
                    </Labelled>
                ))}
            <Labelled label="Colour">
                {/* eslint-disable-next-line no-restricted-syntax -- a colour picker, which the engine has none of; a gap in the pull request */}
                <input
                    type="color"
                    className="h-8 w-12 rounded-lg border border-white/20 bg-black/40 p-0.5"
                    value={def.color}
                    onChange={(event) => update({ color: event.target.value })}
                />
            </Labelled>
            <Labelled label="Description" wide>
                <TextField
                    className={field}
                    label="Description"
                    value={def.description}
                    onChange={(text) => update({ description: text })}
                />
            </Labelled>
        </Text>
    );
}

/** One skill's fields: who it is, where it stands and what it needs; what
 *  it raises and unlocks; what casting it does; and its cue, which "Cast
 *  it now" plays on her. */
function SkillForm({
    def,
    skill,
    savedIds,
    onChoose,
}: {
    def: ClassDef;
    skill: SkillDef;
    savedIds: Set<string>;
    onChoose: (id: string) => void;
}) {
    const update = (change: Partial<SkillDef>) =>
        editClass({
            ...def,
            skills: def.skills.map((each) =>
                each.id === skill.id ? { ...each, ...change } : each,
            ),
        });
    const others = def.skills
        .filter((each) => each.id !== skill.id)
        .map((each) => each.id);
    const active: ActiveDef | null = skill.active;
    const cue: CueDef | null = skill.cue;
    const setActive = (change: Partial<ActiveDef>) =>
        active && update({ active: { ...active, ...change } });
    const setCue = (change: Partial<CueDef>) =>
        cue && update({ cue: { ...cue, ...change } });
    const box =
        "grid grid-cols-2 gap-1.5 rounded-xl bg-black/30 p-2 sm:grid-cols-4";

    return (
        <Text as="div" className="flex flex-col gap-1.5">
            <Text as="div" className="flex items-center gap-2">
                <Image
                    src={signUrl(skill.sign, skill.color)}
                    label=""
                    className="size-8"
                />
                <Text size="sm" className="font-bold">
                    {skill.name}
                </Text>
                <Text size="xs" className="opacity-70">
                    {describeSkill(skill, 1).join(" · ")}
                </Text>
            </Text>
            <Text as="div" className={box}>
                <Labelled
                    label={
                        savedIds.has(skill.id)
                            ? "Id (saves keep ranks by it)"
                            : "Id"
                    }
                >
                    <TextField
                        className={field}
                        label={
                            savedIds.has(skill.id)
                                ? "Id (saves keep ranks by it)"
                                : "Id"
                        }
                        value={skill.id}
                        readOnly={savedIds.has(skill.id)}
                        onChange={(text) => {
                            const id = text;
                            if (
                                !idPattern.test(id) ||
                                readClasses().skills.has(id)
                            )
                                return;
                            editClass({
                                ...def,
                                skills: def.skills.map((each) =>
                                    each.id === skill.id
                                        ? { ...each, id }
                                        : each.needsSkill === skill.id
                                          ? { ...each, needsSkill: id }
                                          : each,
                                ),
                            });
                            onChoose(id);
                        }}
                    />
                </Labelled>
                <Labelled label="Name">
                    <TextField
                        className={field}
                        label="Name"
                        value={skill.name}
                        onChange={(text) => update({ name: text })}
                    />
                </Labelled>
                <Labelled label="Sign">
                    <Choice
                        label="Sign"
                        value={skill.sign}
                        options={skillSigns}
                        onChange={(sign) => update({ sign })}
                    />
                </Labelled>
                <Labelled label="Colour">
                    {/* eslint-disable-next-line no-restricted-syntax -- a colour picker, which the engine has none of; a gap in the pull request */}
                    <input
                        type="color"
                        className="h-8 w-12 rounded-lg border border-white/20 bg-black/40 p-0.5"
                        value={skill.color}
                        onChange={(event) =>
                            update({ color: event.target.value })
                        }
                    />
                </Labelled>
                <Labelled label="Description" wide>
                    <TextField
                        className={field}
                        label="Description"
                        value={skill.description}
                        onChange={(text) => update({ description: text })}
                    />
                </Labelled>
                <Labelled label="Row">
                    <NumberInput
                        label="Row"
                        value={skill.row}
                        onChange={(row) =>
                            update({ row: Math.max(0, Math.round(row)) })
                        }
                    />
                </Labelled>
                <Labelled label="Column">
                    <NumberInput
                        label="Column"
                        value={skill.column}
                        onChange={(column) =>
                            update({ column: Math.max(0, Math.round(column)) })
                        }
                    />
                </Labelled>
                <Labelled label="Ranks">
                    <NumberInput
                        label="Ranks"
                        value={skill.ranks}
                        onChange={(ranks) =>
                            update({ ranks: Math.max(1, Math.round(ranks)) })
                        }
                    />
                </Labelled>
                <Labelled label="Works with">
                    <Choice<SkillWeapon>
                        label="Works with"
                        value={skill.weapon}
                        options={[...weaponKinds, "any"]}
                        onChange={(weapon) => update({ weapon })}
                    />
                </Labelled>
                <Labelled label="Needs points in tree">
                    <NumberInput
                        label="Needs points in tree"
                        value={skill.needsPoints}
                        onChange={(needsPoints) =>
                            update({
                                needsPoints: Math.max(
                                    0,
                                    Math.round(needsPoints),
                                ),
                            })
                        }
                    />
                </Labelled>
                <Labelled label="Needs skill">
                    <Choice
                        label="Needs skill"
                        value={skill.needsSkill}
                        options={["", ...others]}
                        onChange={(needsSkill) => update({ needsSkill })}
                    />
                </Labelled>
                <Labelled label="At rank">
                    <NumberInput
                        label="At rank"
                        value={skill.needsRank}
                        onChange={(needsRank) =>
                            update({
                                needsRank: Math.max(0, Math.round(needsRank)),
                            })
                        }
                    />
                </Labelled>
            </Text>

            <Text
                as="div"
                className="flex flex-col gap-1 rounded-xl bg-black/30 p-2"
            >
                <Text size="xs" className="font-bold">
                    Raises, each rank
                </Text>
                {skill.modifiers.map((modifier, index) => (
                    <Text
                        as="div"
                        key={index}
                        className="flex items-center gap-1.5"
                    >
                        <Choice
                            label="Modified stat"
                            value={modifier.stat}
                            options={modifierStatNames}
                            onChange={(stat) =>
                                update({
                                    modifiers: skill.modifiers.map(
                                        (each, at) =>
                                            at === index
                                                ? { ...each, stat }
                                                : each,
                                    ),
                                })
                            }
                        />
                        <NumberInput
                            label="Per rank"
                            value={modifier.perRank}
                            step={0.5}
                            onChange={(perRank) =>
                                update({
                                    modifiers: skill.modifiers.map(
                                        (each, at) =>
                                            at === index
                                                ? { ...each, perRank }
                                                : each,
                                    ),
                                })
                            }
                        />
                        <Text size="xs" className="opacity-60">
                            {modifierStats[modifier.stat].percent ? "%" : ""}
                        </Text>
                        <Button
                            label="Remove this modifier"
                            onPress={() =>
                                update({
                                    modifiers: skill.modifiers.filter(
                                        (_, at) => at !== index,
                                    ),
                                })
                            }
                            className="size-7 min-w-7 rounded-lg px-0 text-xs"
                        >
                            <Icon name="x" className="size-3.5" />
                        </Button>
                    </Text>
                ))}
                <Text as="div" className="flex flex-wrap items-center gap-1.5">
                    <Button
                        onPress={() =>
                            update({
                                modifiers: [
                                    ...skill.modifiers,
                                    { stat: "damage", perRank: 5 },
                                ],
                            })
                        }
                        className="h-8 rounded-xl px-2.5 text-xs"
                    >
                        + Modifier
                    </Button>
                    {unlockNames.map((unlock) => (
                        <Text
                            as="label"
                            key={unlock}
                            className="flex items-center gap-1 text-xs"
                        >
                            <Toggle
                                label={`Unlocks ${unlock}`}
                                value={skill.unlocks.includes(unlock)}
                                onChange={(on) =>
                                    update({
                                        unlocks: on
                                            ? [...skill.unlocks, unlock]
                                            : skill.unlocks.filter(
                                                  (each) => each !== unlock,
                                              ),
                                    })
                                }
                            />
                            Unlocks {unlock}
                        </Text>
                    ))}
                </Text>
            </Text>

            <Text
                as="div"
                className="flex flex-col gap-1 rounded-xl bg-black/30 p-2"
            >
                <Text
                    as="label"
                    className="flex items-center gap-1.5 text-xs font-bold"
                >
                    <Toggle
                        label="Active skill"
                        value={!!active}
                        onChange={(on) =>
                            update({
                                active: on ? { ...defaultActive } : null,
                                cue: on ? (cue ?? { ...defaultCue }) : cue,
                            })
                        }
                    />
                    Cast from the paw
                </Text>
                {active && (
                    <Text
                        as="div"
                        className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
                    >
                        <Labelled label="Action">
                            <Choice
                                label="Action"
                                value={active.action}
                                options={actionKinds}
                                onChange={(action) => setActive({ action })}
                            />
                        </Labelled>
                        <Labelled label="Cooldown (s)">
                            <NumberInput
                                label="Cooldown (s)"
                                value={active.cooldown}
                                step={0.5}
                                onChange={(cooldown) => setActive({ cooldown })}
                            />
                        </Labelled>
                        <Labelled label="Stamina">
                            <NumberInput
                                label="Stamina"
                                value={active.stamina}
                                onChange={(stamina) => setActive({ stamina })}
                            />
                        </Labelled>
                        <Labelled label="Damage (× attack)">
                            <NumberInput
                                label="Damage (× attack)"
                                value={active.damage}
                                step={0.05}
                                onChange={(damage) => setActive({ damage })}
                            />
                        </Labelled>
                        <Labelled label="More each rank">
                            <NumberInput
                                label="More each rank"
                                value={active.damagePerRank}
                                step={0.05}
                                onChange={(damagePerRank) =>
                                    setActive({ damagePerRank })
                                }
                            />
                        </Labelled>
                        {active.action === "area" ? (
                            <>
                                <Labelled label="Shape">
                                    <Choice
                                        label="Shape"
                                        value={active.shape}
                                        options={areaShapes}
                                        onChange={(shape) =>
                                            setActive({ shape })
                                        }
                                    />
                                </Labelled>
                                <Labelled label="Reach (m)">
                                    <NumberInput
                                        label="Reach (m)"
                                        value={active.reach}
                                        step={0.1}
                                        onChange={(reach) =>
                                            setActive({ reach })
                                        }
                                    />
                                </Labelled>
                                {active.shape === "cone" && (
                                    <Labelled label="Half-width (°)">
                                        <NumberInput
                                            label="Half-width (°)"
                                            value={active.spread}
                                            onChange={(spread) =>
                                                setActive({ spread })
                                            }
                                        />
                                    </Labelled>
                                )}
                            </>
                        ) : (
                            <>
                                <Labelled label="Bolts">
                                    <NumberInput
                                        label="Bolts"
                                        value={active.count}
                                        onChange={(count) =>
                                            setActive({
                                                count: Math.max(
                                                    1,
                                                    Math.round(count),
                                                ),
                                            })
                                        }
                                    />
                                </Labelled>
                                <Labelled label="Fan (° apart)">
                                    <NumberInput
                                        label="Fan (° apart)"
                                        value={active.fan}
                                        onChange={(fan) => setActive({ fan })}
                                    />
                                </Labelled>
                            </>
                        )}
                    </Text>
                )}
            </Text>

            <Text
                as="div"
                className="flex flex-col gap-1 rounded-xl bg-black/30 p-2"
            >
                <Text
                    as="label"
                    className="flex items-center gap-1.5 text-xs font-bold"
                >
                    <Toggle
                        label="Cue: her move and its effects"
                        value={!!cue}
                        onChange={(on) =>
                            update({
                                cue: on ? { ...defaultCue } : null,
                            })
                        }
                    />
                    Cue: her move and its effects
                </Text>
                {cue && (
                    <Text
                        as="div"
                        className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
                    >
                        <Labelled label="Move">
                            <Choice
                                label="Move"
                                value={cue.move}
                                options={cueMoves}
                                onChange={(move) => setCue({ move })}
                            />
                        </Labelled>
                        <Labelled label="Motes">
                            <Choice
                                label="Motes"
                                value={cue.element}
                                options={cueElements}
                                onChange={(element) => setCue({ element })}
                            />
                        </Labelled>
                        <Labelled label="Sword arcs">
                            <NumberInput
                                label="Sword arcs"
                                value={cue.arcs}
                                onChange={(arcs) =>
                                    setCue({
                                        arcs: Math.max(0, Math.round(arcs)),
                                    })
                                }
                            />
                        </Labelled>
                        <Labelled label="Camera shake">
                            <NumberInput
                                label="Camera shake"
                                value={cue.shake}
                                step={0.02}
                                onChange={(shake) => setCue({ shake })}
                            />
                        </Labelled>
                    </Text>
                )}
            </Text>

            <Text as="div" className="flex flex-wrap gap-2">
                {active && (
                    <Button
                        onPress={() => previewSkill(skill.id)}
                        className="h-9 rounded-xl px-3 text-sm"
                    >
                        Cast it now
                    </Button>
                )}
                <Button
                    onPress={() => {
                        const copy = newSkill(def);
                        editClass({
                            ...def,
                            skills: [
                                ...def.skills,
                                {
                                    ...skill,
                                    id: copy.id,
                                    name: `${skill.name} copy`,
                                    row: copy.row,
                                },
                            ],
                        });
                        onChoose(copy.id);
                    }}
                    className="h-9 rounded-xl px-3 text-sm"
                >
                    Duplicate skill
                </Button>
                <Button
                    onPress={() => {
                        editClass({
                            ...def,
                            skills: def.skills
                                .filter((each) => each.id !== skill.id)
                                .map((each) =>
                                    each.needsSkill === skill.id
                                        ? { ...each, needsSkill: "" }
                                        : each,
                                ),
                        });
                        onChoose("");
                    }}
                    className="h-9 rounded-xl px-3 text-sm text-red-200"
                >
                    Delete skill
                </Button>
            </Text>
        </Text>
    );
}
