import { createQuery } from "koota";
import { useWorld } from "koota/react";
import { useEffect, useRef, useState } from "react";
import { readEach, TransformTrait } from "@spawnite/engine";
import { boundary, EnemyKind } from "../rules/data";
import { readHeroPosition } from "../rules/field";
import { HazardPhase, readBeam, readVent } from "../rules/hazards";
import { findStage, HazardKind, StageId } from "../rules/stages";
import { DropTrait, DropKind, EnemyTrait } from "../rules/traits";
import { findRun } from "../views/findRun";

//  The field's map, as the source drew it: the hero's cross in the middle,
//  each enemy a dot round it, the elites blue, the loot runner gold and the
//  boss red, and each drop a pin in its colour. Under them, the stage's
//  props, its vents as they erupt and its beam's line. Redrawn every frame.
//  A desktop's wide screen gets a larger map.

/** The map's size in CSS pixels. */
interface MapSize {
    width: number;
    height: number;
}

const phoneSize: MapSize = { width: 150, height: 112 };
const desktopSize: MapSize = { width: 240, height: 180 };
/** The width Tailwind's lg starts at, where the buttons under the map move
 *  down to clear it. */
const desktopQuery = "(min-width: 1024px)";

/** The map's size for this screen, following a resize past lg. */
function useMapSize() {
    const [desktop, setDesktop] = useState(
        () => window.matchMedia(desktopQuery).matches,
    );
    useEffect(() => {
        const query = window.matchMedia(desktopQuery);
        const change = () => setDesktop(query.matches);
        query.addEventListener("change", change);
        return () => query.removeEventListener("change", change);
    }, []);
    return desktop ? desktopSize : phoneSize;
}

const specialColors: Partial<Record<EnemyKind, string>> = {
    [EnemyKind.Boss]: "#ff4d3a",
    [EnemyKind.LootRunner]: "#ffe27a",
    [EnemyKind.Elite]: "#5eb6ff",
    [EnemyKind.CrimsonElite]: "#5eb6ff",
};

const dropColors: Record<DropKind, string> = {
    health: "#ff9cb8",
    magnet: "#83e5ff",
    doubleXp: "#b6ff6a",
    food: "#ffb15a",
};

const placedEnemies = createQuery(EnemyTrait, TransformTrait);
const placedDrops = createQuery(DropTrait, TransformTrait);

interface MinimapProps {
    className?: string;
}

export function Minimap({ className }: MinimapProps) {
    const world = useWorld();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { width, height } = useMapSize();
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const scale = (width - 18) / (boundary * 2);
        const centreX = width / 2;
        const centreY = 20 + (height - 24) / 2;
        let frame = 0;
        const dot = (x: number, y: number, radius: number, color: string) => {
            context.fillStyle = color;
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();
        };
        const draw = () => {
            frame = requestAnimationFrame(draw);
            const hero = readHeroPosition(world);
            const place = (x: number, z: number) => [
                Math.max(
                    6,
                    Math.min(width - 6, centreX + (x - hero.x) * scale),
                ),
                Math.max(
                    18,
                    Math.min(height - 6, centreY + (z - hero.z) * scale),
                ),
            ];
            const run = findRun(world);
            const stage = findStage(run?.stage ?? StageId.Grid);
            context.clearRect(0, 0, width, height);
            context.fillStyle = "#101820d0";
            context.fillRect(0, 0, width, height);
            context.fillStyle = "#8897a3";
            context.font = "10px Arial";
            context.textAlign = "left";
            context.fillText(stage.name.toUpperCase(), 8, 14);
            context.fillStyle = `${stage.palette.props.rim}80`;
            for (const prop of stage.props) {
                const [x, y] = place(prop.x, prop.z);
                const size = Math.max(2, prop.radius * 2 * scale);
                context.fillRect(x - size / 2, y - size / 2, size, size);
            }
            const hazard = stage.hazard;
            if (run && hazard.kind === HazardKind.Vents)
                for (const [index, vent] of hazard.vents.entries()) {
                    if (readVent(run, index).phase !== HazardPhase.Strike)
                        continue;
                    const [x, y] = place(vent.x, vent.z);
                    dot(x, y, 3, hazard.strikeColor);
                }
            if (run && hazard.kind === HazardKind.Beam) {
                const beam = readBeam(run);
                if (beam.phase !== HazardPhase.Idle) {
                    const [fromX, fromY] = beam.alongX
                        ? place(beam.at, -boundary)
                        : place(-boundary, beam.at);
                    const [toX, toY] = beam.alongX
                        ? place(beam.at, boundary)
                        : place(boundary, beam.at);
                    context.strokeStyle = hazard.tellColor;
                    context.beginPath();
                    context.moveTo(fromX, fromY);
                    context.lineTo(toX, toY);
                    context.stroke();
                }
            }
            context.strokeStyle = "#b4ee94";
            context.beginPath();
            context.moveTo(centreX - 4, centreY);
            context.lineTo(centreX + 4, centreY);
            context.moveTo(centreX, centreY - 3);
            context.lineTo(centreX, centreY + 3);
            context.stroke();
            //  The plain enemies first, so a special one draws over them.
            readEach(world, placedEnemies, ([enemy, position]) => {
                if (specialColors[enemy.kind]) return;
                const [x, y] = place(position.x, position.z);
                dot(x, y, 1.6, "#f4f7f8");
            });
            readEach(world, placedEnemies, ([enemy, position]) => {
                const color = specialColors[enemy.kind];
                if (!color) return;
                const [x, y] = place(position.x, position.z);
                dot(x, y, enemy.kind === EnemyKind.Boss ? 5 : 4, color);
            });
            readEach(world, placedDrops, ([drop, position]) => {
                const [x, y] = place(position.x, position.z);
                dot(x, y, 3, dropColors[drop.kind]);
            });
        };
        draw();
        return () => cancelAnimationFrame(frame);
    }, [world, width, height]);
    return (
        // eslint-disable-next-line no-restricted-syntax -- no primitive surface to draw on yet: the pull request's engine gaps
        <canvas
            ref={canvasRef}
            className={`df-minimap ${className ?? ""}`}
            style={{ width, height }}
            aria-label="Field map"
        />
    );
}
