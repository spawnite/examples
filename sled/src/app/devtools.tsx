import { Devtools } from "@spawnite/devtools";

//  Loaded only in development, through the lazy import in app.tsx, so a
//  production build never reaches this module or the devtools behind it.

export default function SledDevtools() {
    return <Devtools />;
}
