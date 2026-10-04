import { enemyStats, EnemyKind } from "../rules/data";
import { EnemyPhase, type EnemyState } from "../rules/traits";

/** The colour an enemy's body shows now: pale in a hit's flash, hot as a
 *  tank charges, its kind's colour otherwise. */
export function readBodyColor(enemy: EnemyState) {
    if (enemy.hit > 0) return "#fff2d9";
    if (enemy.kind === EnemyKind.Tank && enemy.phase === EnemyPhase.Charge)
        return "#ffb783";
    return enemyStats[enemy.kind].color;
}
