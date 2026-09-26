---
title: "Feature"
description: What Feature does to its entity, in one line.
---

Feature is a behaviour: a child of an Entity that adds its trait.

| Prop  | Type   | Default  | What it means |
| ----- | ------ | -------- | ------------- |
| speed | number | required |               |

## Where it runs

Client.

```tsx
import { Entity } from "@spawnite/engine";
import { Feature } from "../behaviours/Feature";

<Entity>
    <Feature speed={1} />
</Entity>;
```
