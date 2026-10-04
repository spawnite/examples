import { useTraitEffect, useWorld } from "koota/react";
import { useRef } from "react";
import { Vector3 } from "three";
import {
    NetworkEntitiesTrait,
    ShotResultsTrait,
    TransformTrait,
    useHeadless,
    useRoom,
    WeaponsTrait,
} from "@spawnite/engine";
import { measureHearing, playSound } from "../audio/sounds";
import { readGun } from "../siege/guns";
import { MonsterTrait, WardenTrait } from "../siege/traits";
import { monsterSettings } from "../siege/waves";
import { readShotLook } from "../weapons/looks";
import { Beam, useBeams, type DrawnBeam } from "./Beam";
import { showDamage } from "./DamageNumbers";
import { drawElementHit } from "./effects/elementHits";
import { noteKnock } from "./monsters/knockback";
import { readWardenColor } from "./palette";
import { findMuzzle, markShot } from "./warden/muzzles";

//  Written in place for each hit.
const overHead = new Vector3();
const chest = new Vector3();
const listener = new Vector3();

/** Every warden's pellets as the room says they went. Another warden's
 *  pellet is a bolt in her colour from her barrel, where her gun is drawn
 *  while it shows, or else from where the room says it left her, to where
 *  it ended, with a spark where it hit and her gun's flash; her own page
 *  drew hers as she fired. Another's shot sounds at her gun's tier, under
 *  this page's own gun, and quieter the farther she stands from this page's
 *  warden. Every hit, hers too, floats its damage up off the monster, the
 *  killing blow included, gold on a weak spot, and shows the shooter's
 *  elements on it. Headless, as the room mounts the scene, it draws nothing:
 *  no frame runs there to take a bolt down again. */
export function TracerView() {
    return useHeadless() ? null : <Tracers />;
}

function Tracers() {
    const world = useWorld();
    const idRef = useRef(0);
    const { beams: tracers, showBeams } = useBeams();

    useTraitEffect(world, ShotResultsTrait, (shots) => {
        const { heroId } = useRoom.getState();
        const entities = world.get(NetworkEntitiesTrait);
        const own = heroId === null ? undefined : entities?.get(heroId);
        const hearing = own?.get(TransformTrait);
        if (hearing) listener.copy(hearing);
        const drawn: DrawnBeam[] = [];
        for (const { shooter, weapon, origin, end, hits } of shots?.results ??
            []) {
            const shotBy = entities?.get(shooter);
            const look = readShotLook(weapon);
            for (const { target, damage, zone } of hits) {
                //  A monster the blow killed has left the stream already:
                //  its number starts where the pellet ended.
                const monster = entities?.get(target);
                const feet = monster?.get(TransformTrait);
                const kind = monster?.get(MonsterTrait)?.kind;
                if (monster && kind) noteKnock(monster, look.knock);
                if (feet && kind) {
                    const { height } = monsterSettings[kind];
                    overHead.copy(feet).setY(feet.y + height);
                    chest.copy(feet).setY(feet.y + height * 0.6);
                } else {
                    overHead.fromArray(end);
                    chest.fromArray(end);
                }
                showDamage({
                    position: overHead,
                    amount: damage,
                    critical: zone !== undefined,
                });
                if (shotBy)
                    drawElementHit({
                        position: chest,
                        shooter: shotBy,
                        own: shooter === heroId,
                    });
            }
            if (shooter === heroId) continue;
            //  A shooter this page holds no warden for yet has no barrel of
            //  hers drawn: another hue's barrel would carry her bolt.
            const hue = shotBy?.get(WardenTrait)?.hue;
            const from = new Vector3();
            //  The hue whose drawn barrel the bolt starts at, if any.
            const barrel =
                hue !== undefined && findMuzzle(hue, from) ? hue : null;
            if (barrel === null) from.fromArray(origin);
            if (hue !== undefined) markShot(hue);
            const held = shotBy ? readGun(shotBy) : undefined;
            const tier =
                held && (held.gun as string) === weapon ? held.tier : 0;
            playSound(look.sound, {
                ally: true,
                tier,
                volume: hearing ? measureHearing(listener.distanceTo(from)) : 1,
            });
            drawn.push({
                id: idRef.current++,
                from,
                to: new Vector3().fromArray(end),
                color: readWardenColor(hue ?? 0),
                hit: hits.length > 0,
                kind: look.beam,
                range: world.get(WeaponsTrait)?.get(weapon)?.range ?? Infinity,
                tier,
                shooter: barrel,
            });
        }
        if (drawn.length > 0) showBeams(drawn);
    });

    return tracers.map((tracer) => (
        <Beam
            key={tracer.id}
            from={tracer.from}
            to={tracer.to}
            color={tracer.color}
            hit={tracer.hit}
            kind={tracer.kind}
            range={tracer.range}
            tier={tracer.tier}
            shooter={tracer.shooter}
        />
    ));
}
