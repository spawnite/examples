import type { World } from "koota";
import { boundary, u } from "../rules/data";
import { HazardPhase, readBeam, readVent } from "../rules/hazards";
import {
    findStage,
    HazardKind,
    type BeamHazard,
    type VentHazard,
} from "../rules/stages";
import type { RunState } from "../rules/traits";
import { findRun } from "./findRun";
import type { Painter } from "./painter";

//  The stage's floor hazard, drawn from where its beat stands: each vent's
//  grate, its glow before it erupts and the eruption, and the beam's line
//  before it sweeps and the beam sweeping. The telegraphs are the elites':
//  a filling circle for a vent, as for a rift, and a lane brightening as
//  it fills, as before a dash.

/** The opacity of a vent's grate between its eruptions. */
const grateOpacity = 0.3;
/** An eruption's fill: its opacity, and how far it flickers about it. */
const eruptionOpacity = 0.5;
const eruptionFlicker = 0.15;
/** How fast the eruption flickers, in radians a second. */
const flickerRate = 30;
/** The beam's line before it sweeps: the wash under it, and the line's
 *  opacity at first and what it gains as the sweep nears. */
const tellWashOpacity = 0.2;
const tellLineOpacity = 0.45;
const tellLineGain = 0.4;
/** The sweeping beam's wash and its white core, as shares of its width. */
const beamWashShare = 2.5;
const beamCoreShare = 1 / 3;
/** The opacity of the wash round the sweeping beam. */
const beamWashOpacity = 0.27;

//  Written in place each frame.
const from = { x: 0, z: 0 };
const to = { x: 0, z: 0 };

function paintVents(painter: Painter, run: RunState, hazard: VentHazard) {
    for (const [index, vent] of hazard.vents.entries()) {
        const { phase, seconds } = readVent(run, index);
        painter.ring({
            at: vent,
            radius: hazard.radius,
            width: u(2),
            color: hazard.tellColor,
            opacity: grateOpacity,
        });
        if (phase === HazardPhase.Tell)
            painter.tellCircle({
                at: vent,
                radius: hazard.radius,
                charge: seconds / hazard.tellSeconds,
                color: hazard.tellColor,
            });
        if (phase !== HazardPhase.Strike) continue;
        painter.disc({
            at: vent,
            radius: hazard.radius,
            color: hazard.strikeColor,
            opacity:
                eruptionOpacity +
                eruptionFlicker * Math.sin(seconds * flickerRate),
        });
        painter.ring({
            at: vent,
            radius: hazard.radius,
            width: u(4),
            color: hazard.strikeColor,
        });
    }
}

/** Sets the scratch line wall to wall through `at` on the beam's axis. */
function placeLine(alongX: boolean, at: number) {
    from.x = alongX ? at : -boundary;
    from.z = alongX ? -boundary : at;
    to.x = alongX ? at : boundary;
    to.z = alongX ? boundary : at;
}

function paintBeam(painter: Painter, run: RunState, hazard: BeamHazard) {
    const { phase, seconds, alongX, at } = readBeam(run);
    if (phase === HazardPhase.Idle || Math.abs(at) > boundary) return;
    placeLine(alongX, at);
    if (phase === HazardPhase.Tell) {
        const charge = seconds / hazard.tellSeconds;
        painter.lane({
            from,
            to,
            width: hazard.width,
            color: hazard.tellColor,
            opacity: tellWashOpacity,
        });
        painter.lane({
            from,
            to,
            width: u(2 + charge * 10),
            color: hazard.tellColor,
            opacity: tellLineOpacity + charge * tellLineGain,
        });
        return;
    }
    //  As the laser's beam: a wide wash, a bright band and a white core.
    painter.lane({
        from,
        to,
        width: hazard.width * beamWashShare,
        color: hazard.tellColor,
        opacity: beamWashOpacity,
    });
    painter.lane({ from, to, width: hazard.width, color: hazard.tellColor });
    painter.lane({
        from,
        to,
        width: hazard.width * beamCoreShare,
        color: hazard.strikeColor,
    });
}

/** Paints the hazard of the run's stage, if it has one. */
export function paintHazards(painter: Painter, world: World) {
    const run = findRun(world);
    if (!run) return;
    const hazard = findStage(run.stage).hazard;
    if (hazard.kind === HazardKind.Vents) paintVents(painter, run, hazard);
    if (hazard.kind === HazardKind.Beam) paintBeam(painter, run, hazard);
}
