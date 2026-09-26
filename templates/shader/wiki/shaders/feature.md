---
title: "Feature"
description: What Feature draws, in one line.
---

FeatureMaterial is a shader: the material of the mesh it sits in, drawn by a fragment on the world's clock, as [Shader](/engine/graphics/shader/) describes.

| Prop  | Type   | Default | What it means                                           |
| ----- | ------ | ------- | ------------------------------------------------------- |
| speed | number | 0.5     | How fast the pattern changes, per second of world time. |
| scale | number | 4       | How many cells of the pattern cross the mesh.           |

Put it in the mesh of an entity component, such as one `add_entity` writes, so the devtools tree shows the row by that component's name.

## Where it runs

Client.

```tsx
import { Entity } from "@spawnite/engine";
import { FeatureMaterial } from "../shaders/Feature";

export function FeaturePlane() {
    return (
        <Entity>
            <mesh>
                <planeGeometry args={[2, 2]} />
                <FeatureMaterial />
            </mesh>
        </Entity>
    );
}
```
