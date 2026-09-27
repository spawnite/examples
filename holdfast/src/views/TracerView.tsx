import { useTraitEffect, useWorld } from "koota/react";
import { useRef, useState } from "react";
import { Vector3 } from "three";
import {
    NetworkEntities,
    ShotResults,
    Transform,
    useRoom,
} from "@spawnite/engine";
import { MonsterTrait, WardenTrait } from "../siege/traits";
import { monsterSettings } from "../siege/waves";
import { lanceWeapon } from "../siege/lance";
import { Beam, heavyBeamSeconds, type DrawnBeam } from "./Beam";
import { showDamage } from "./DamageNumbers";
import { readWardenColor } from "./palette";
import { findMuzzle, markShot } from "./warden/muzzles";

//  Written in place for each hit.
const overHead = new Vector3();

/** Every warden's pellets as the room says they went. Another warden's
 *  pellet is a bolt in her colour from her barrel, where her gun is drawn,
 *  or else from where the room says it left her, to where it ended, with a
 *  spark where it hit and her gun's flash; her own page drew hers as she
 *  fired. Every hit, hers too, floats its damage up off the monster, the
 *  killing blow included. */
export function TracerView() {
    const world = useWorld();
    const idRef = useRef(0);
    const [tracers, setTracers] = useState<DrawnBeam[]>([]);

    useTraitEffect(world, ShotResults, (shots) => {
        const { heroId } = useRoom.getState();
        const entities = world.get(NetworkEntities);
        const drawn: DrawnBeam[] = [];
        for (const { shooter, weapon, origin, end, hits } of shots?.results ??
            []) {
            for (const { target, damage } of hits) {
                //  A monster the blow killed has left the stream already:
                //  its number starts where the pellet ended.
                const monster = entities?.get(target);
                const feet = monster?.get(Transform);
                const kind = monster?.get(MonsterTrait)?.kind;
                if (feet && kind)
                    overHead
                        .copy(feet)
                        .setY(feet.y + monsterSettings[kind].height);
                else overHead.fromArray(end);
                showDamage({ position: overHead, amount: damage });
            }
            if (shooter === heroId) continue;
            const hue = entities?.get(shooter)?.get(WardenTrait)?.hue ?? 0;
            const from = new Vector3();
            if (!findMuzzle(hue, from)) from.fromArray(origin);
            markShot(hue);
            drawn.push({
                id: idRef.current++,
                from,
                to: new Vector3().fromArray(end),
                color: readWardenColor(hue),
                hit: hits.length > 0,
                heavy: weapon === lanceWeapon,
            });
        }
        if (drawn.length === 0) return;
        setTracers((shown) => [...shown, ...drawn]);
        setTimeout(
            () =>
                setTracers((shown) =>
                    shown.filter((tracer) => !drawn.includes(tracer)),
                ),
            heavyBeamSeconds * 1000,
        );
    });

    return tracers.map((tracer) => (
        <Beam
            key={tracer.id}
            from={tracer.from}
            to={tracer.to}
            color={tracer.color}
            hit={tracer.hit}
            heavy={tracer.heavy}
        />
    ));
}
