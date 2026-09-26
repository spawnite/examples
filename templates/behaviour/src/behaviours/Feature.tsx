import { trait } from "koota";
import { RunContext, useBehaviour, type Behaviour } from "@spawnite/engine";

/** What Feature does to its entity, in one line. */
export const FeatureTrait = trait({ speed: 1 });

export const FeatureBehaviour: Behaviour<typeof FeatureTrait> = {
    trait: FeatureTrait,
    runsOn: RunContext.Client,
    wiki: "/behaviours/feature/",
    source: "src/behaviours/Feature.tsx",
};

export interface FeatureProps {
    /** What speed means, and its unit. */
    speed: number;
}

export function Feature(props: FeatureProps) {
    useBehaviour(FeatureBehaviour, props);

    return null;
}
