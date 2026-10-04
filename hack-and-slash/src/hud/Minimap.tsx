import { useEffect, useRef } from "react";
import { useWorld } from "koota/react";
import {
    findPlayerHero,
    HealthTrait,
    Panel,
    Slot,
    TransformTrait,
    VelocityTrait,
} from "@spawnite/engine";
import { HeroCombatTrait, HazardTrait, HazardShape } from "../combat/traits";
import { LootTrait } from "../items/traits";
import { useSpawns } from "../monsters/spawns";
import {
    MonsterTrait,
    MonsterMode,
    MonsterStateTrait,
} from "../monsters/traits";
import { cameraFx } from "../view/cameraFx";
import { mapPicture } from "../view/MapBake";
import { usePortrait } from "../view/device";

//  The minimap: the wilds round her from above, turned so the way the
//  camera looks is up, as her walking is. The map as seen from straight
//  over it, its grass, paths, trees and rocks; every monster, loot and a
//  boss's attacks waiting on the ground; and her arrow in the middle.
//  North is marked on the rim. Drawn on its own canvas a few times a
//  second, so the HUD round it never re-renders.

/** Metres from her to the map's rim. */
const reach = 24;
/** Times a second it is drawn. */
const drawsPerSecond = 15;

const colors = {
    ground: "#1d3a1e",
    shade: "rgba(0,0,0,0.18)",
    rim: "rgba(255,255,255,0.25)",
    moss: "rgba(130,210,90,0.4)",
    ember: "rgba(245,120,50,0.45)",
    passive: "#e8f5e0",
    aggressive: "#ff5a4a",
    hunting: "#ff2a1a",
    boss: "#ffc93a",
    loot: "#ffe27a",
    hazard: "rgba(255,70,40,0.35)",
    hero: "#ffffff",
    north: "#ffd24a",
};

export function Minimap() {
    const world = useWorld();
    const canvas = useRef<HTMLCanvasElement>(null);
    const portrait = usePortrait();
    //  The way she last faced, for her arrow when she stands.
    const facing = useRef({ x: 0, z: -1 });

    useEffect(() => {
        let request = 0;
        let last = 0;
        const draw = (now: number) => {
            request = requestAnimationFrame(draw);
            if (now - last < 1000 / drawsPerSecond) return;
            last = now;
            const view = canvas.current;
            const paint = view?.getContext("2d");
            if (!view || !paint) return;
            //  Sharp at the screen's own pixels.
            const side = Math.round(view.clientWidth * window.devicePixelRatio);
            if (view.width !== side) {
                view.width = side;
                view.height = side;
            }
            const middle = side / 2;
            const scale = (middle - 2) / reach;
            const hero = findPlayerHero(world);
            const at = hero?.get(TransformTrait);
            const heroX = at?.x ?? 0;
            const heroZ = at?.z ?? 0;
            //  The camera's way ahead across the ground, and its right.
            const aheadX = Math.sin(cameraFx.heading);
            const aheadZ = Math.cos(cameraFx.heading);
            const place = (x: number, z: number): [number, number] => {
                const dx = x - heroX;
                const dz = z - heroZ;
                const across = -dx * aheadZ + dz * aheadX;
                const up = dx * aheadX + dz * aheadZ;
                return [middle + across * scale, middle - up * scale];
            };

            paint.clearRect(0, 0, side, side);
            paint.save();
            paint.beginPath();
            paint.arc(middle, middle, middle - 1, 0, Math.PI * 2);
            paint.fillStyle = colors.ground;
            paint.fill();
            paint.clip();

            //  The map from above, laid so each of its points stands where
            //  `place` puts it, a little darkened so the dots stand out;
            //  until it is taken, the meadows tinted by their monsters.
            const picture = mapPicture.image;
            if (picture) {
                const across = -scale * aheadZ;
                const acrossZ = scale * aheadX;
                const down = -scale * aheadX;
                const downZ = -scale * aheadZ;
                paint.setTransform(
                    across,
                    down,
                    acrossZ,
                    downZ,
                    middle - (across * heroX + acrossZ * heroZ),
                    middle - (down * heroX + downZ * heroZ),
                );
                const half = mapPicture.size / 2;
                paint.imageSmoothingEnabled = true;
                paint.drawImage(
                    picture,
                    -half,
                    -half,
                    mapPicture.size,
                    mapPicture.size,
                );
                paint.setTransform(1, 0, 0, 1, 0, 0);
                paint.fillStyle = colors.shade;
                paint.fillRect(0, 0, side, side);
            } else {
                const seen = new Set<string>();
                for (const slot of useSpawns.getState().slots) {
                    const area = slot.area;
                    if (seen.has(area.name)) continue;
                    seen.add(area.name);
                    const [x, y] = place(area.x, area.z);
                    paint.beginPath();
                    paint.arc(x, y, area.radius * scale, 0, Math.PI * 2);
                    paint.fillStyle =
                        area.kind === "emberSlime" ? colors.ember : colors.moss;
                    paint.fill();
                }
            }

            //  A boss's attacks waiting on the ground, by their reach.
            for (const entity of world.query(HazardTrait)) {
                const hazard = entity.get(HazardTrait)!;
                if (hazard.fired) continue;
                const [x, y] = place(hazard.x, hazard.z);
                paint.fillStyle = colors.hazard;
                paint.beginPath();
                if (hazard.shape === HazardShape.Bar) {
                    const [endX, endY] = place(
                        hazard.x + hazard.dirX * hazard.size,
                        hazard.z + hazard.dirZ * hazard.size,
                    );
                    paint.lineWidth = Math.max(2, hazard.inner * scale);
                    paint.strokeStyle = colors.hazard;
                    paint.moveTo(x, y);
                    paint.lineTo(endX, endY);
                    paint.stroke();
                    continue;
                }
                paint.arc(x, y, hazard.size * scale, 0, Math.PI * 2);
                paint.fill();
            }

            for (const entity of world.query(LootTrait)) {
                const loot = entity.get(LootTrait)!;
                const [x, y] = place(loot.x, loot.z);
                paint.fillStyle = colors.loot;
                paint.fillRect(
                    x - side * 0.012,
                    y - side * 0.012,
                    side * 0.024,
                    side * 0.024,
                );
            }

            for (const entity of world.query(MonsterTrait, TransformTrait)) {
                const health = entity.get(HealthTrait);
                if (health && health.current <= 0) continue;
                const monster = entity.get(MonsterTrait)!;
                const where = entity.get(TransformTrait)!;
                const [x, y] = place(where.x, where.z);
                const hunting =
                    entity.get(MonsterStateTrait)?.mode === MonsterMode.Hunt;
                paint.beginPath();
                paint.arc(
                    x,
                    y,
                    side * (monster.boss ? 0.045 : 0.022),
                    0,
                    Math.PI * 2,
                );
                paint.fillStyle = monster.boss
                    ? colors.boss
                    : hunting
                      ? colors.hunting
                      : monster.aggressive
                        ? colors.aggressive
                        : colors.passive;
                paint.fill();
                if (monster.boss) {
                    paint.lineWidth = side * 0.012;
                    paint.strokeStyle = "#5a3a00";
                    paint.stroke();
                }
            }

            //  Her arrow: the way she walks, else the way she last struck.
            const velocity = hero?.get(VelocityTrait);
            const combat = hero?.get(HeroCombatTrait);
            if (velocity && Math.hypot(velocity.x, velocity.z) > 0.3) {
                const speed = Math.hypot(velocity.x, velocity.z);
                facing.current = {
                    x: velocity.x / speed,
                    z: velocity.z / speed,
                };
            } else if (combat && combat.sinceAttack < 0.5)
                facing.current = { x: combat.dirX, z: combat.dirZ };
            const [tipX, tipY] = place(
                heroX + facing.current.x,
                heroZ + facing.current.z,
            );
            const angle = Math.atan2(tipY - middle, tipX - middle);
            const size = side * 0.06;
            paint.translate(middle, middle);
            paint.rotate(angle);
            paint.beginPath();
            paint.moveTo(size, 0);
            paint.lineTo(-size * 0.7, size * 0.65);
            paint.lineTo(-size * 0.35, 0);
            paint.lineTo(-size * 0.7, -size * 0.65);
            paint.closePath();
            paint.fillStyle = colors.hero;
            paint.fill();
            paint.lineWidth = side * 0.01;
            paint.strokeStyle = "#101014";
            paint.stroke();
            paint.restore();

            //  The rim, and north on it.
            paint.beginPath();
            paint.arc(middle, middle, middle - 1, 0, Math.PI * 2);
            paint.lineWidth = side * 0.015;
            paint.strokeStyle = colors.rim;
            paint.stroke();
            const northAcross = -aheadX;
            const northUp = -aheadZ;
            const northX = middle + northAcross * (middle - side * 0.08);
            const northY = middle - northUp * (middle - side * 0.08);
            paint.font = `bold ${Math.round(side * 0.1)}px system-ui, sans-serif`;
            paint.textAlign = "center";
            paint.textBaseline = "middle";
            paint.lineWidth = side * 0.025;
            paint.strokeStyle = "#101014";
            paint.strokeText("N", northX, northY);
            paint.fillStyle = colors.north;
            paint.fillText("N", northX, northY);
        };
        request = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(request);
    }, [world]);

    return (
        <Panel slot={Slot.TopRight} className="rounded-full p-1">
            {/* eslint-disable-next-line no-restricted-syntax -- a surface the map is drawn on each frame; no primitive draws on one: a gap in the pull request */}
            <canvas
                ref={canvas}
                aria-label="Minimap"
                className={`block rounded-full ${portrait ? "size-26" : "size-36"}`}
            />
        </Panel>
    );
}
