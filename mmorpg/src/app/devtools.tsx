import { Devtools } from "@spawnite/devtools";

//  Loaded through the lazy import in App.tsx, only when its gate shows the
//  tools, so a page that hides them never fetches this module.

export default function MmorpgDevtools() {
    return <Devtools />;
}
