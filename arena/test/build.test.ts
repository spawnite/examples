// @vitest-environment node
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { build, normalizePath, type Plugin } from "vite";
import { beforeAll, expect, it } from "vitest";

const arenaFolder = path.resolve(import.meta.dirname, "..");
/** Where an installed package's files are, as the build names its modules:
 *  the link resolved, so the same in this repository and in a project that
 *  installed the package, and forward slashes on every platform. */
function findPackageFolder(name: string) {
    const link = path.join(arenaFolder, "node_modules", name);
    return `${normalizePath(realpathSync(link))}/`;
}
const engineFolder = findPackageFolder("@spawnite/engine");
const devtoolsFolder = findPackageFolder("@spawnite/devtools");

//  Every module the production build put into a chunk, read off the bundle
//  itself, so a devtools module that survives in any form is caught, however
//  the minifier renamed it.
function recordModules(moduleIds: string[]): Plugin {
    return {
        name: "record-modules",
        generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
                if (output.type === "chunk")
                    moduleIds.push(...output.moduleIds);
            }
        },
    };
}

const moduleIds: string[] = [];
let html = "";

beforeAll(async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "arena-build-"));
    //  Vitest runs under NODE_ENV=test, and Vite reads NODE_ENV rather than
    //  the mode to decide import.meta.env.DEV. The build a deploy runs sees
    //  production, so this one must too.
    const testEnvironment = process.env.NODE_ENV;
    const roomsDomain = process.env.ROOMS_DOMAIN;
    process.env.NODE_ENV = "production";
    //  The deploy names the rooms domain, as the repository's variable.
    process.env.ROOMS_DOMAIN = "rooms.test";
    try {
        await build({
            root: arenaFolder,
            logLevel: "silent",
            build: { outDir, emptyOutDir: true },
            plugins: [recordModules(moduleIds)],
        });
        html = await readFile(path.join(outDir, "index.html"), "utf8");
    } finally {
        process.env.NODE_ENV = testEnvironment;
        if (roomsDomain === undefined) delete process.env.ROOMS_DOMAIN;
        else process.env.ROOMS_DOMAIN = roomsDomain;
        await rm(outDir, { recursive: true, force: true });
    }
}, 120_000);

it("leaves the devtools out of a production build", () => {
    //  A build that recorded nothing would pass the check below for the
    //  wrong reason.
    expect(moduleIds.some((id) => id.startsWith(engineFolder))).toBe(true);
    expect(moduleIds.filter((id) => id.startsWith(devtoolsFolder))).toEqual([]);
});

//  The deploy workflow copies this dist under /arena/play/game/ on the games site,
//  alongside every other game's dist. A root-relative src, or a base tag
//  such as href="/", points the script at the site root instead, so the
//  page fails to load.
it("loads its script relative to the page, not the site root", () => {
    expect(html).toMatch(/<script [^>]*src="\.\//);
    expect(html).not.toContain("<base");
});

//  A page served over https opens only wss://, and its policy lets it open
//  a socket to a room on any machine under the rooms domain, and to no
//  other host.
it("lets the page reach its own origin and the rooms domain's machines alone", () => {
    expect(html).toContain(
        `<meta http-equiv="Content-Security-Policy" content="connect-src &#39;self&#39; blob: wss://*.rooms.test">`,
    );
});
