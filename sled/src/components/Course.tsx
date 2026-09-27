import { useBehaviour } from "@spawnite/engine";
import { CourseBehaviour, type CourseKind } from "../ride/course";

/** Says what its entity's trigger is: what the step does when the rider
 *  enters it. */
export function Course({ kind }: { kind: CourseKind }) {
    useBehaviour(CourseBehaviour, { kind });
    return null;
}
