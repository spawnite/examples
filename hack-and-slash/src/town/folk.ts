import { createStore } from "@spawnite/engine";
import { firstPlate } from "../hero/paintFace";
import type { Look } from "../hero/look";
import type { ModelGear } from "../hero/modelRig";

//  The town's people: who each is, where they stand, how they look, and
//  what talking to them opens. Each is drawn from her own model in a look
//  and gear of their own.

export type FolkId = "smith" | "grocer" | "guard" | "trainer";

export type Folk = {
    id: FolkId;
    name: string;
    /** What they do, under their name. */
    title: string;
    at: [number, number];
    /** The way they face while no one is near, in radians from +z. */
    facing: number;
    look: Look;
    gear: ModelGear;
    /** What they say as she comes to talk. */
    greeting: string;
};

export const folk: Folk[] = [
    {
        id: "smith",
        name: "Brom",
        title: "Smith",
        at: [-7.4, -2.6],
        facing: Math.PI / 2,
        look: {
            hair: 1,
            face: firstPlate + 1,
            hairColor: 0.08,
            skin: 0.35,
            leftEye: 0.1,
            rightEye: 0.1,
            outfit: 0.1,
        },
        gear: {
            weapon: "ironSword",
            shield: null,
            head: null,
            body: "berserkerHarness",
            hands: "knightGauntlets",
            feet: "berserkerBoots",
        },
        greeting:
            "Bring me two of the same piece and I'll hammer them into one, stronger. It won't always take, mind, and the finer the piece, the more I ask.",
    },
    {
        id: "grocer",
        name: "Mira",
        title: "General store",
        at: [7.2, -2.4],
        facing: -Math.PI / 2,
        look: {
            hair: 5,
            face: firstPlate,
            hairColor: 0.62,
            skin: 0.1,
            leftEye: 0.45,
            rightEye: 0.45,
            outfit: 0.55,
        },
        gear: {
            weapon: "shortBow",
            shield: null,
            head: "featherHat",
            body: "arcaneRobes",
            hands: null,
            feet: "arcaneBoots",
        },
        greeting:
            "Potions, fresh today! And I'll buy whatever you drag back from the wilds.",
    },
    {
        id: "guard",
        name: "Captain Hale",
        title: "Gate guard",
        at: [2.6, -17.2],
        facing: 0,
        look: {
            hair: 2,
            face: firstPlate + 3,
            hairColor: 0.02,
            skin: 0.22,
            leftEye: 0.62,
            rightEye: 0.62,
            outfit: 0.28,
        },
        gear: {
            weapon: "ironSword",
            shield: "ironKite",
            head: "ironHelm",
            body: "knightPlate",
            hands: "knightGauntlets",
            feet: "knightGreaves",
        },
        greeting:
            "The wilds are past this gate. Slimes near the meadow; bats and spiders east, the barrow west, and the ashen flats north for the brave. Mind the bosses.",
    },
    {
        id: "trainer",
        name: "Instructor Vale",
        title: "Class trainer",
        //  Beside the road in from the south, where she first walks.
        at: [-5.6, 6.2],
        facing: Math.PI / 2,
        look: {
            hair: 3,
            face: firstPlate + 2,
            hairColor: 0.78,
            skin: 0.3,
            leftEye: 0.2,
            rightEye: 0.2,
            outfit: 0.7,
        },
        gear: {
            weapon: "mossSword",
            shield: "huntersBow",
            head: null,
            body: "battleMageCoat",
            hands: "battleMageGloves",
            feet: "battleMageBoots",
        },
        greeting:
            "Every adventurer finds a calling. From level 10 I teach a job, and from level 20 a second, and the two together make a class of their own.",
    },
];

/** Metres from a townsperson within which she can talk to them. */
export const talkReach = 3.2;

type Town = {
    /** The townsperson she stands near enough to talk to, if any. */
    near: FolkId | null;
    /** The one she is talking to, whose window is open. */
    talking: FolkId | null;
    /** She walked out through the gate, for the wilds. */
    leaving: boolean;
    /** The character creator is open to change her look. */
    editingLook: boolean;
};

export const useTown = createStore<Town>()(() => ({
    near: null,
    talking: null,
    leaving: false,
    editingLook: false,
}));

/** Opens the character creator to change her look, or closes it. */
export function editLook(editing: boolean) {
    useTown.setState({ editingLook: editing });
}

export function talkTo(id: FolkId | null) {
    useTown.setState({ talking: id });
}
