// @vitest-environment node
import { realpathSync } from "node:fs";
import * as path from "node:path";
import { checkGameBuild } from "@spawnite/engine/vite";
import { normalizePath } from "vite";
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

let moduleIds: string[] = [];
let html = "";

//  The engine's check holds the standalone build under this repository's ceiling
//  and keeps zod's classic API out.
beforeAll(async () => {
    //  The deploy names the rooms domain, as the repository's variable.
    const bundle = await checkGameBuild(arenaFolder, {
        env: { ROOMS_DOMAIN: "rooms.test" },
    });
    moduleIds = Object.values(bundle).flatMap((output) =>
        output.type === "chunk" ? output.moduleIds : [],
    );
    const page = bundle["index.html"];
    html = page.type === "asset" ? String(page.source) : "";
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
