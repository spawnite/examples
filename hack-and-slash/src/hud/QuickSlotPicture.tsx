import { Image } from "@spawnite/engine";
import type { QuickSlot } from "../hero/progress";
import { quickUrl } from "./pictures";

interface QuickSlotPictureProps {
    what: QuickSlot;
}

/** What a potion or a skill shows under the pointer while it is dragged
 *  toward the paw. */
export function QuickSlotPicture({ what }: QuickSlotPictureProps) {
    return (
        <Image
            src={quickUrl(what)}
            label=""
            className="size-12 opacity-90 drop-shadow-[0_2px_4px_rgb(0_0_0/0.7)]"
        />
    );
}
