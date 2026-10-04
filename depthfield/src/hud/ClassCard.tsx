import { Text } from "@spawnite/engine";
import { findClass } from "../rules/data";
import { useChoice } from "../store/choice";
import { StatMeter } from "./StatMeter";

//  The class the lobby rolled for the next run: its name in its colour,
//  and its shares of the base health, speed, fire rate and range.

export function ClassCard() {
    const runClass = findClass(useChoice((choice) => choice.classId));
    return (
        <Text as="section" className="df-classcard" aria-label="Class">
            <Text as="p" className="df-classcard-line">
                Rolled for this run
            </Text>
            <Text as="b" className={`df-classname df-${runClass.id}`}>
                {runClass.name}
            </Text>
            <Text as="div" className="df-classstats">
                <StatMeter label="Health" share={runClass.hp} />
                <StatMeter label="Move" share={runClass.move} />
                <StatMeter label="Fire rate" share={runClass.rate} />
                <StatMeter label="Range" share={runClass.range} />
            </Text>
        </Text>
    );
}
