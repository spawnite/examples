import { Devtools } from "@spawnite/devtools";

//  Loaded only in development, through the lazy import in app.tsx, so a
//  production build never reaches this module or the devtools behind it.
//  The store it puts on the page is what `spawnite play` reads and steps.

export default function HoldfastDevtools() {
    return <Devtools />;
}
