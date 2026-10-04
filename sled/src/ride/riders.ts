import bathtub from "@spawnite/assets/models/sled/bathtub.glb?url";
import bear from "@spawnite/assets/models/sled/bear.glb?url";
import cat from "@spawnite/assets/models/sled/cat.glb?url";
import donut from "@spawnite/assets/models/sled/donut.glb?url";
import fox from "@spawnite/assets/models/sled/fox.glb?url";
import penguin from "@spawnite/assets/models/sled/penguin.glb?url";
import rabbit from "@spawnite/assets/models/sled/rabbit.glb?url";
import tin from "@spawnite/assets/models/sled/tin.glb?url";
import toboggan from "@spawnite/assets/models/sled/toboggan.glb?url";
import { palette } from "../palette";

//  Who rides and what on: each rider a skinned animal, each ride a model
//  under it. The lobby picks one of each by id.

export enum RiderId {
    Penguin = "penguin",
    Bear = "bear",
    Fox = "fox",
    Cat = "cat",
    Rabbit = "rabbit",
}

export enum RideId {
    Toboggan = "toboggan",
    Donut = "donut",
    Tin = "tin",
    Bathtub = "bathtub",
}

/** How the rider holds itself on a ride. */
export enum RidePose {
    Stand = "stand",
    /** The legs fold onto the ride. */
    Sit = "sit",
    /** A sit leant back, the arms laid along the rim. */
    Lounge = "lounge",
}

/** A model fitted to the rider's metre-wide footprint: scaled by `scale`,
 *  to `width` metres across or to `length` metres along, then turned `turn`
 *  radians and stood on its lowest point. */
export interface ModelFit {
    url: string;
    scale?: number;
    width?: number;
    length?: number;
    turn?: number;
}

/** The finish a ride's model is painted with in place of its own. */
export interface RideFinish {
    color: number;
    metalness: number;
    roughness: number;
}

export interface RideLook extends ModelFit {
    /** The fraction of the fitted model's height the rider rests at:
     *  its top, unless a curl or a rim rises above the deck or the floor. */
    deck?: number;
    pose: RidePose;
    /** Metres from the seat up to the rim a lounger's arms rest on. */
    rim?: number;
    /** Metres the seat sits ahead of the model's middle, and to its
     *  right. */
    forward?: number;
    right?: number;
    finish?: RideFinish;
}

/** The rider is drawn larger than its place on the track. */
export const riderScale = 1.4;

/** The models face +x, so a quarter turn faces them forward. */
const riderTurn = -Math.PI / 2;

/** Each rider's model and scale, about a metre tall. */
export const riders: Record<RiderId, ModelFit> = {
    [RiderId.Penguin]: { url: penguin, scale: 1.05, turn: riderTurn },
    [RiderId.Bear]: { url: bear, scale: 1.12, turn: riderTurn },
    [RiderId.Fox]: { url: fox, scale: 1, turn: riderTurn },
    [RiderId.Cat]: { url: cat, scale: 1, turn: riderTurn },
    //  The ears eat the export's height, so the bear's scale brings its
    //  head level with the fox's.
    [RiderId.Rabbit]: { url: rabbit, scale: 1.12, turn: riderTurn },
};

/** Metres the toboggan is drawn long, curl to tail. */
const tobogganLength = 1.6;

/** Each ride's model, fitted to its width or length, and where and how the
 *  rider sits it. */
export const rides: Record<RideId, RideLook> = {
    //  The rider sits tucked on the slats, which lie at 0.83 of the model's
    //  height: the curl at the front rises above them.
    [RideId.Toboggan]: {
        url: toboggan,
        length: tobogganLength / riderScale,
        deck: 0.83,
        pose: RidePose.Sit,
    },
    //  The hole is too small for a body, so the rider sits on the glaze.
    [RideId.Donut]: { url: donut, width: 1, pose: RidePose.Sit },
    //  Turned about, so the rolled lid is a backrest. The lid takes a
    //  third, which puts the seat ahead of the middle and a little right.
    //  Half-metal, because a chrome tin mirrors the snow it sits in and
    //  vanishes into it.
    [RideId.Tin]: {
        url: tin,
        width: 1,
        turn: Math.PI,
        //  The floor, just over the base: the walls and the lid rise above
        //  it.
        deck: 0.05,
        pose: RidePose.Lounge,
        rim: 0.32,
        forward: 0.24,
        right: 0.08,
        finish: { color: palette.rideShade, metalness: 0.5, roughness: 0.5 },
    },
    //  Authored along x with its back at -x: a quarter turn puts the back
    //  behind the rider.
    [RideId.Bathtub]: {
        url: bathtub,
        width: 0.95,
        turn: -Math.PI / 2,
        //  The floor inside, under the rim.
        deck: 0.3,
        pose: RidePose.Lounge,
        rim: 0.47,
    },
};

/** A look the lobby sells: an animal or a ride. */
export type Look = RiderId | RideId;

/** Coins each look costs in the lobby, in the old game's order: the
 *  penguin and the toboggan are free. Looks change nothing but how the
 *  rider is drawn. */
export const lookPrices: Record<Look, number> = {
    [RiderId.Penguin]: 0,
    [RiderId.Bear]: 50,
    [RiderId.Fox]: 100,
    [RiderId.Cat]: 200,
    [RiderId.Rabbit]: 300,
    [RideId.Toboggan]: 0,
    [RideId.Donut]: 75,
    [RideId.Tin]: 150,
    [RideId.Bathtub]: 250,
};
