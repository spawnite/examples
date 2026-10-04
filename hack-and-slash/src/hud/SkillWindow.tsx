import { useState } from "react";
import { Button, Draggable, Image, Text, Window } from "@spawnite/engine";
import { jobClasses, readClasses, useCatalog } from "../classes/catalog";
import { describeSkill, describeWeapon } from "../classes/describe";
import type { ClassDef, SkillDef } from "../classes/schema";
import {
    heroClasses,
    heroClassName,
    jobLevels,
    pointsInTree,
    rankOf,
    skillPointsLeft,
    whyNotLearn,
    worksWith,
} from "../hero/jobs";
import {
    learnSkill,
    useProgress,
    weaponKind,
    type Progress,
} from "../hero/progress";
import { usePortrait } from "../view/device";
import { signUrl } from "./pictures";
import { QuickSlotPicture } from "./QuickSlotPicture";
import { closeWindow, useWindows } from "./windows";

//  Her skills: each tree her classes give, side by side, a node for each
//  skill at its place, and what the chosen one does now and at its next
//  rank, with a button to learn it. Before her first job, the jobs'
//  trees stand as a preview of what the trainer teaches.

/** Rem across each place in a tree, and across a node. */
const cell = 4.5;
const node = 3.1;

export function SkillWindow() {
    const open = useWindows((state) => state.skills);
    const progress = useProgress();
    //  The classes change under the class editor while the window stands.
    useCatalog((state) => state.version);
    const portrait = usePortrait();
    const [chosen, setChosen] = useState<string | null>(null);
    const [news, setNews] = useState<string | null>(null);
    if (!open) return null;
    const close = () => closeWindow("skills");
    const held = heroClasses(progress);
    const preview = held.length === 0;
    const trees = preview ? jobClasses() : held;
    const left = skillPointsLeft(progress);
    const picked =
        (chosen ? readClasses().skills.get(chosen) : undefined) ??
        (trees[0]?.skills[0]
            ? { skill: trees[0].skills[0], owner: trees[0] }
            : undefined);

    return (
        <Window
            id="skills"
            title="Skills"
            open
            onClose={close}
            className={portrait ? "w-[min(24rem,100%)]" : "w-[44rem]"}
        >
            <Text as="div" className="flex items-center justify-between gap-3">
                <Text size="xs" className="opacity-70">
                    {heroClassName(progress)}
                </Text>
                <Text
                    size="sm"
                    className={
                        left > 0 ? "font-bold text-amber-300" : "opacity-70"
                    }
                >
                    {left} skill point{left === 1 ? "" : "s"}
                    {preview ? " saved" : ""}
                </Text>
            </Text>
            {preview && (
                <Text size="sm" className="rounded-xl bg-black/30 px-2.5 py-2">
                    {progress.level < jobLevels[0]
                        ? `At level ${jobLevels[0]}, Instructor Vale in town teaches your first job. Your skill points save up until then.`
                        : "Talk to Instructor Vale in town to take your first job and spend your points."}{" "}
                    The jobs she teaches:
                </Text>
            )}
            <Text
                as="div"
                className={`flex gap-2 ${portrait ? "flex-col" : "flex-row flex-wrap justify-center"}`}
            >
                {trees.map((tree) => (
                    <Tree
                        key={tree.id}
                        tree={tree}
                        progress={progress}
                        preview={preview}
                        chosen={picked?.skill.id ?? null}
                        onChoose={(id) => {
                            setChosen(id);
                            setNews(null);
                        }}
                    />
                ))}
            </Text>
            {picked && (
                <SkillDetail
                    skill={picked.skill}
                    owner={picked.owner}
                    progress={progress}
                    preview={preview}
                    news={news}
                    onLearn={() => setNews(learnSkill(picked.skill.id))}
                />
            )}
        </Window>
    );
}

/** One class's tree: its name and the points spent in it over a grid of
 *  its skills, each where its row and column put it, with a line from
 *  each to the skill it needs. */
export function Tree({
    tree,
    progress,
    preview,
    chosen,
    onChoose,
}: {
    tree: ClassDef;
    progress: Progress;
    preview: boolean;
    chosen: string | null;
    onChoose: (id: string) => void;
}) {
    const rows = Math.max(1, ...tree.skills.map((skill) => skill.row + 1));
    const columns = Math.max(
        1,
        ...tree.skills.map((skill) => skill.column + 1),
    );
    const byId = new Map(tree.skills.map((skill) => [skill.id, skill]));
    return (
        <Text
            as="div"
            className="flex flex-col items-center gap-1.5 rounded-xl bg-black/30 p-2.5"
            style={{ borderTop: `3px solid ${tree.color}` }}
        >
            <Text
                as="div"
                className="flex w-full items-baseline justify-between gap-3"
            >
                <Text size="sm" className="font-bold">
                    <Text style={{ color: tree.color }}>
                        {tree.name}
                        {tree.kind === "hybrid" ? " · hybrid" : ""}
                    </Text>
                </Text>
                <Text size="xs" className="opacity-60">
                    {preview
                        ? `with a ${tree.weapon}`
                        : `${pointsInTree(progress, tree)} spent`}
                </Text>
            </Text>
            <Text
                as="div"
                className="relative"
                style={{
                    width: `${columns * cell}rem`,
                    height: `${rows * cell}rem`,
                }}
            >
                <svg
                    className="pointer-events-none absolute inset-0 size-full"
                    viewBox={`0 0 ${columns} ${rows}`}
                    preserveAspectRatio="none"
                >
                    {tree.skills.map((skill) => {
                        const needed = byId.get(skill.needsSkill);
                        if (!needed) return null;
                        const met =
                            rankOf(progress, needed.id) >= skill.needsRank;
                        return (
                            <line
                                key={skill.id}
                                x1={needed.column + 0.5}
                                y1={needed.row + 0.5}
                                x2={skill.column + 0.5}
                                y2={skill.row + 0.5}
                                stroke={
                                    met ? tree.color : "rgb(255 255 255 / 0.25)"
                                }
                                strokeWidth={3}
                                vectorEffect="non-scaling-stroke"
                            />
                        );
                    })}
                </svg>
                {tree.skills.map((skill) => (
                    <NodeTile
                        key={skill.id}
                        skill={skill}
                        tree={tree}
                        progress={progress}
                        preview={preview}
                        chosen={chosen === skill.id}
                        onChoose={() => onChoose(skill.id)}
                    />
                ))}
            </Text>
        </Text>
    );
}

/** A skill's node: its sign, ringed in its tree's colour once learned and
 *  in amber while it can be, dim while it cannot, with its rank. One she
 *  casts, once learned, drags onto the paw. */
function NodeTile({
    skill,
    tree,
    progress,
    preview,
    chosen,
    onChoose,
}: {
    skill: SkillDef;
    tree: ClassDef;
    progress: Progress;
    preview: boolean;
    chosen: boolean;
    onChoose: () => void;
}) {
    const rank = rankOf(progress, skill.id);
    const learnable = !preview && !whyNotLearn(progress, skill.id);
    const ring =
        rank > 0
            ? tree.color
            : learnable
              ? "#fbbf24"
              : "rgb(255 255 255 / 0.3)";
    const offset = (cell - node) / 2;
    const draggable = rank > 0 && skill.active;
    return (
        <Draggable
            data={skill.id}
            disabled={!draggable}
            preview={<QuickSlotPicture what={skill.id} />}
            className="absolute"
            style={{
                left: `${skill.column * cell + offset}rem`,
                top: `${skill.row * cell + offset}rem`,
                width: `${node}rem`,
                height: `${node}rem`,
            }}
        >
            <Button
                label={`${skill.name}, rank ${rank} of ${skill.ranks}`}
                onPress={onChoose}
                className={`size-full min-w-0 rounded-2xl bg-black/45 bg-none px-0 shadow-none inset-shadow-none backdrop-blur-none backdrop-saturate-100 outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95 ${chosen ? "ring-2 ring-white" : ""} ${draggable ? "cursor-grab" : ""}`}
                style={{ border: `2px solid ${ring}` }}
            >
                <Image
                    src={signUrl(skill.sign, skill.color)}
                    label=""
                    className={`size-9 ${rank > 0 || learnable ? "" : "opacity-40 grayscale"}`}
                />
                <Text className="absolute -right-1.5 -bottom-1.5 rounded-full bg-black/80 px-1.5 text-[0.65rem] leading-4 font-bold tabular-nums">
                    {rank}/{skill.ranks}
                </Text>
                {skill.active && (
                    <Text className="absolute -top-1.5 -left-1.5 rounded-full bg-sky-500/90 px-1 text-[0.55rem] leading-4 font-bold">
                        CAST
                    </Text>
                )}
            </Button>
        </Draggable>
    );
}

/** What the chosen skill does now and at its next rank, what it needs,
 *  and the button that learns it. */
function SkillDetail({
    skill,
    owner,
    progress,
    preview,
    news,
    onLearn,
}: {
    skill: SkillDef;
    owner: ClassDef;
    progress: Progress;
    preview: boolean;
    news: string | null;
    onLearn: () => void;
}) {
    const rank = rankOf(progress, skill.id);
    const why = whyNotLearn(progress, skill.id);
    const kind = weaponKind(progress);
    const idle = rank > 0 && !worksWith(skill, kind);
    return (
        <Text
            as="div"
            className="flex flex-col gap-1 rounded-xl bg-black/30 p-2.5"
        >
            <Text as="div" className="flex items-center gap-2">
                <Image
                    src={signUrl(skill.sign, skill.color)}
                    label=""
                    className="size-8"
                />
                <Text as="div" className="flex min-w-0 flex-1 flex-col">
                    <Text size="sm" className="font-bold">
                        {skill.name}{" "}
                        <Text className="font-normal opacity-60">
                            {rank}/{skill.ranks} · {owner.name}
                        </Text>
                    </Text>
                    <Text size="xs" className="opacity-70">
                        {describeWeapon(skill)}
                        {skill.active ? " · cast from the paw" : " · always on"}
                    </Text>
                </Text>
            </Text>
            {skill.description && <Text size="sm">{skill.description}</Text>}
            {rank > 0 && (
                <Text size="xs" className="text-lime-300">
                    Now: {describeSkill(skill, rank).join(" · ")}
                </Text>
            )}
            {rank < skill.ranks && (
                <Text size="xs" className="text-sky-200">
                    {rank > 0 ? "Next" : "Rank 1"}:{" "}
                    {describeSkill(skill, rank + 1).join(" · ")}
                </Text>
            )}
            {idle && (
                <Text size="xs" className="text-amber-300">
                    It works {describeWeapon(skill).toLowerCase()}; you hold a{" "}
                    {kind}.
                </Text>
            )}
            {rank > 0 && skill.active && (
                <Text size="xs" className="opacity-70">
                    Drag its node onto a pad of the paw to cast it.
                </Text>
            )}
            {!preview && (
                <Text as="div" className="flex flex-wrap items-center gap-2">
                    {rank < skill.ranks && (
                        <Button
                            pressed={!why}
                            onPress={onLearn}
                            className="h-9 rounded-xl px-3 text-sm"
                        >
                            {rank > 0 ? "Learn the next rank" : "Learn"} · 1
                            point
                        </Button>
                    )}
                    {(news ?? why) && (
                        <Text size="xs" className="opacity-80">
                            {news ?? why}
                        </Text>
                    )}
                </Text>
            )}
        </Text>
    );
}
