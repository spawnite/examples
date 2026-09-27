import { baseSystems, nameSystem, type System } from "@spawnite/engine/core";
import { flyBolts, spitBolts, windUpSlams } from "./attacks";
import { takeFallenMonsters } from "./blaster";
import { gatherCoins } from "./coins";
import { tendWardens } from "./downs";
import { expireEntities } from "./effects";
import { faceMonsters, strikeWardens } from "./monsters";
import { advanceSiege } from "./siege";
import { readSignals } from "./signals";
import { adoptWardens, gatherStandingWardens } from "./wardens";

/** The step the room runs: the engine's, with the siege's own at the places
 *  they read and write. The wardens are taken in, the signals read and the
 *  fallen monsters taken out before the behaviours: the engine then never
 *  reaps a warden, and never reaps a monster before the siege drops its
 *  coins. The engine's chase walks
 *  the monsters, and the siege then turns each to face its warden. */
export const systems: System[] = [
    ...baseSystems.input,
    ...baseSystems.move,
    nameSystem("siege.adoptWardens", adoptWardens),
    nameSystem("siege.gatherStandingWardens", gatherStandingWardens),
    nameSystem("siege.readSignals", readSignals),
    nameSystem("siege.takeFallenMonsters", takeFallenMonsters),
    ...baseSystems.behaviours,
    nameSystem("siege.advanceSiege", advanceSiege),
    nameSystem("siege.faceMonsters", faceMonsters),
    nameSystem("siege.strikeWardens", strikeWardens),
    nameSystem("siege.windUpSlams", windUpSlams),
    nameSystem("siege.spitBolts", spitBolts),
    nameSystem("siege.flyBolts", flyBolts),
    nameSystem("siege.tendWardens", tendWardens),
    nameSystem("siege.gatherCoins", gatherCoins),
    nameSystem("siege.expireEntities", expireEntities),
    ...baseSystems.resolve,
];
