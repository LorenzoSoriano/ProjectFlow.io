# ProjectFlow.io

ProjectFlow.io is a **conceptual visual flow editor** for designing software and videogame systems before writing production code.

It is intentionally not a compiler, UML validator, or programming language. Blocks are flexible thinking tools: you can describe objects, classes, functions, variables, conditions, UI elements, notes, and pseudocode using whatever terminology best matches the project.

## What the MVP can do

- Create Object, Class, Function, Variable, Condition, UI, and Note blocks.
- Add freely named rows inside every block.
- Treat rows as variables, properties, functions, inputs, outputs, conditions, or plain text.
- Connect a whole block or any individual row to another input/output port.
- Drag blocks around an infinite-style canvas.
- Pan with **Alt + drag** and zoom with the mouse wheel.
- Edit title, description, rows, type, and pseudocode in the Inspector.
- Duplicate or delete blocks.
- Double-click a connection to remove it.
- Save automatically to browser local storage.
- Export and import a complete flow as JSON.
- Reset to an example containing a Door/Key flow and a GameManager/Score UI flow.
- Use a responsive layout for desktop and smaller screens.

## Example concepts

### Door / Key

A Door object can contain:

- `doorId`
- `requiredKeyId`
- `open`
- `TryOpen()`

A Key exposes `keyId`. Both values can be connected to a conceptual condition such as:

```text
doorId == keyId
→ open = true
```

### UI Score

A `GameManager` can expose `score` and `multiplier`, connect those values to `Calculate Score`, and send the result to a `Score Text` UI block.

The point is not to produce executable code. The point is to make dependencies, responsibilities, state, and data flow understandable before implementation.

## Run locally

No build step or dependencies are required.

Open `index.html` directly in a browser, or serve the repository with any static web server.

## GitHub Pages

This project is fully static and can be published directly from the repository root using GitHub Pages.

## Planned direction

Good next steps for the tool include nested/sub-flow views, groups or frames, comments, richer connection labels, reusable templates, undo/redo history, shareable cloud projects, collaboration, and optional presets for gameplay architecture, UI flow, state machines, and narrative logic.
