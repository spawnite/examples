import type {
    ConfigurableTrait,
    Entity,
    ExtractSchema,
    TraitValue,
    World,
} from "koota";
import { Vector3, type Object3D } from "three";
import type { Save } from "@spawnite/schema";
import { yawToQuaternion } from "@spawnite/engine";
import { HealthTrait, Hero, Path, Pose, Steer } from "@spawnite/engine";
import { Facing, Ref, Transform, Velocity } from "@spawnite/engine";

//  The hero `spawnHero` builds, with every field defaulted, so a case names the
//  one it turns on and a field the hero grows later lands here rather than in
//  every case that spawns one. HealthTrait carries no default of its own, so the
//  trait's stays the only copy of it.
//  The world only matters to a spawn, so a case that needs just the save
//  record builds one without it.
export function heroBuilder(world?: World) {
    //  The action takes its height from the ground the hero stands on, so the
    //  origin is what is left to default to; a case that reads a position says
    //  where it stands.
    let position = new Vector3();
    let velocity = new Vector3();
    let yaw = 0;
    let health: TraitValue<ExtractSchema<typeof HealthTrait>> = {};
    let object: Object3D | null = null;

    const builder = {
        at(next: Vector3) {
            position = next;
            return builder;
        },
        //  Radians about y. A case that starts her mid-run says which way she
        //  is already pointing, so the steer does not turn her on the spot.
        withFacing(next: number) {
            yaw = next;
            return builder;
        },
        withHealth(current: number, maximum?: number) {
            health = maximum === undefined ? { current } : { current, maximum };
            return builder;
        },
        withVelocity(next: Vector3) {
            velocity = next;
            return builder;
        },
        //  The renderer gives the hero its ref when it mounts, so only a case
        //  that needs one before that asks for it.
        withRef(next: Object3D) {
            object = next;
            return builder;
        },
        spawn(): Entity {
            //  Cloned, because both traits store the instance they are handed:
            //  without this a second spawn shares the first hero's vectors, and
            //  a case that kept the vector it named would watch it move.
            const traits: ConfigurableTrait[] = [
                Hero,
                HealthTrait(health),
                Pose,
                Path,
                Steer,
                Transform(position.clone()),
                Velocity(velocity.clone()),
                Facing({ rotation: yawToQuaternion(yaw) }),
            ];
            if (object) traits.push(Ref({ object }));
            if (!world) throw new Error("A hero needs a world to spawn into.");
            return world.spawn(...traits);
        },
        toSave(): NonNullable<Save["hero"]> {
            return {
                position: position.clone(),
                facing: yaw,
                health: { ...HealthTrait.schema, ...health },
            };
        },
    };

    return builder;
}
