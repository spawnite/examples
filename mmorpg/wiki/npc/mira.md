Mira, a level 5 friendly herbalist, is the meadow's first NPC. `src/npcs/Mira.tsx` declares her, and the meadow scene places her a few steps from where the player starts.

Her day runs on `routines()`:

- `morning`: she walks the market round once, from the stall past the well to the herbs, and stands four seconds at the well, then waits three seconds and goes to `rest`.
- `rest`: she walks to the bench, waits twenty to forty seconds, says "_yawns_", and goes back to `morning`.
- `greet`: when a player comes within the Talk prompt's radius, she turns to the player and says "Hello!", then resumes the round where she left it.

## Her conversation

A press of Talk starts a conversation, which `dialog()` builds beside her routines and `<Dialog>` gives her. She stops, faces the player, and resumes her round at the step she was on once her last conversation ends. The meadow's HUD draws it in the `DialogPanel` along the bottom of the screen.

Its values are `gift`, the item she hands out (`potion`), and `spareBelow`, the count of it a player's bag must hold fewer of before she offers one (2).

- `hello`: "Morning, {player}! I'm {npc}. The meadow is kind to herb folk." The choices are "What do you gather?", which goes to `herbs`; "Could you spare a potion?", shown only while the player's bag holds fewer than `spareBelow` of `gift`, which goes to `gift`; and "Just passing by.", which goes to `bye`.
- `herbs`: where moonleaf and redcap grow. "Back to the start." goes to `hello`, and "Thanks, Mira." to `bye`.
- `gift`: puts one `gift` in the player's bag as the node begins, and says so. "Thank you!" goes to `bye`.
- `bye`: "Safe roads, {player}." The Interact key ends the conversation.
