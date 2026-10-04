import { createStore } from "@spawnite/engine";
import { readClass, type ClassDef, type SkillDef } from "./schema";

//  Every class the game has: each file beside this one, read and checked,
//  with the class editor's unsaved changes laid over them. Saving a class
//  rewrites its file, which the dev server swaps in without a reload.

/** The rules of jobs a creator tunes: the level of each job change, the
 *  skill points each level gives, and the share of each weapon's stats she
 *  gets with one in each hand. */
export const jobRules = {
    firstJobLevel: 10,
    secondJobLevel: 20,
    skillPointsPerLevel: 1,
    dualShare: 0.6,
};

/** Each class file's contents, by its name without `.json`. */
function readFiles() {
    const modules = import.meta.glob<unknown>("./*.json", {
        eager: true,
        import: "default",
    });
    return Object.fromEntries(
        Object.entries(modules).map(([path, raw]) => [
            path.slice(2, -".json".length),
            raw,
        ]),
    );
}

type Catalog = {
    /** Each class file as it reads from disk, by id. */
    files: Record<string, unknown>;
    /** The editor's changes not yet saved, by class id: a class as edited,
     *  or null for one it removed. */
    edits: Record<string, ClassDef | null>;
    /** Counts every change, so what is worked out from the classes knows
     *  to work it out again. */
    version: number;
};

type CatalogStore = ReturnType<typeof makeCatalog>;

const makeCatalog = () =>
    createStore<Catalog>()(() => ({
        files: readFiles(),
        edits: {},
        version: 0,
    }));

//  Kept across a hot reload of this module, so whatever holds the store
//  sees the new files: the reload hands the old store the files it read.
//  A test runner's `hot` may carry no data, and keeps nothing.
const hot = import.meta.hot?.data ? import.meta.hot : undefined;
const kept: CatalogStore | undefined = hot?.data.catalog;
export const useCatalog: CatalogStore = kept ?? makeCatalog();
if (hot) {
    hot.data.catalog = useCatalog;
    if (kept) {
        const files = readFiles();
        useCatalog.setState(({ edits, version }) => ({
            files,
            //  An edit the file now holds is saved.
            edits: Object.fromEntries(
                Object.entries(edits).filter(([id, edit]) =>
                    edit === null
                        ? id in files
                        : JSON.stringify(readClass(id, files[id]).def) !==
                          JSON.stringify(edit),
                ),
            ),
            version: version + 1,
        }));
    }
    hot.accept();
}

export type Classes = {
    /** Every class that reads, jobs first, each by name. */
    list: ClassDef[];
    byId: Map<string, ClassDef>;
    /** Every skill by its id, and the class whose tree holds it. */
    skills: Map<string, { skill: SkillDef; owner: ClassDef }>;
    /** What is wrong with each file that did not read, or with how the
     *  classes fit together. */
    errors: string[];
};

let readFor = -1;
let read: Classes | null = null;

/** The classes as they stand, worked out again only after a change. */
export function readClasses(): Classes {
    const { files, edits, version } = useCatalog.getState();
    if (read && readFor === version) return read;
    const errors: string[] = [];
    const list: ClassDef[] = [];
    const ids = new Set([...Object.keys(files), ...Object.keys(edits)]);
    for (const id of ids) {
        const edit = edits[id];
        if (edit === null) continue;
        if (edit) {
            list.push(edit);
            continue;
        }
        const result = readClass(id, files[id]);
        if (result.def) list.push(result.def);
        else errors.push(...result.errors);
    }
    list.sort((a, b) =>
        a.kind === b.kind
            ? a.name.localeCompare(b.name)
            : a.kind === "job"
              ? -1
              : 1,
    );
    const byId = new Map(list.map((each) => [each.id, each]));
    const skills = new Map<string, { skill: SkillDef; owner: ClassDef }>();
    for (const owner of list)
        for (const skill of owner.skills) {
            const other = skills.get(skill.id);
            if (other)
                errors.push(
                    `The skill id "${skill.id}" is in both ${other.owner.id}.json and ${owner.id}.json; a skill's id must be unique across every class.`,
                );
            else skills.set(skill.id, { skill, owner });
        }
    const pairs = new Map<string, string>();
    for (const hybrid of list.filter((each) => each.kind === "hybrid")) {
        for (const job of hybrid.pair)
            if (byId.get(job)?.kind !== "job")
                errors.push(
                    `${hybrid.id}.json: its pair names "${job}", which is not a job's file.`,
                );
        const key = pairKey(hybrid.pair[0], hybrid.pair[1]);
        const twin = pairs.get(key);
        if (twin)
            errors.push(
                `${twin}.json and ${hybrid.id}.json are both the hybrid of ${hybrid.pair.join(" and ")}; keep one.`,
            );
        pairs.set(key, hybrid.id);
    }
    for (const error of errors) console.error(`Bladebound classes: ${error}`);
    read = { list, byId, skills, errors };
    readFor = version;
    return read;
}

/** One key for two jobs, whichever was taken first. */
const pairKey = (a: string, b: string) => [a, b].sort().join("+");

/** The hybrid the two jobs make, if a class file names that pair. */
export function hybridOf(first: string, second: string): ClassDef | undefined {
    const key = pairKey(first, second);
    return readClasses().list.find(
        (each) =>
            each.kind === "hybrid" &&
            pairKey(each.pair[0], each.pair[1]) === key,
    );
}

/** The classes she can take as a job at the trainer. */
export const jobClasses = () =>
    readClasses().list.filter((each) => each.kind === "job");

/** Lays the editor's version of a class over its file, until it is saved
 *  or discarded. */
export function editClass(def: ClassDef) {
    useCatalog.setState(({ edits, version }) => ({
        edits: { ...edits, [def.id]: def },
        version: version + 1,
    }));
}

/** Removes a class until the editor saves or discards it. */
export function removeClass(id: string) {
    useCatalog.setState(({ edits, version }) => ({
        edits: { ...edits, [id]: null },
        version: version + 1,
    }));
}

/** Drops the editor's unsaved change to a class: its file stands again. */
export function discardEdit(id: string) {
    useCatalog.setState(({ edits, version }) => {
        const rest = { ...edits };
        delete rest[id];
        return { edits: rest, version: version + 1 };
    });
}
