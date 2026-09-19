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
- Select and drag connection curve points, including multi-selection and marquee selection.
- Double-click a connection to add a curve point; press Delete to remove selected points.
- Group selected blocks inside auto-sizing Shader Graph-style frames with **Ctrl/Cmd + G**.
- Rename groups from the whole top title band and drag the entire group from any frame edge.
- Undo / Redo history for project edits with **Ctrl/Cmd + Z**, **Ctrl/Cmd + Shift + Z**, or **Ctrl/Cmd + Y**.
- Rename a group directly on the canvas and drag its header to move all contained blocks.
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


## Project Library e Google Cloud Sync

ProjectFlow apre ora una **Project Library** prima dell'editor. I progetti vengono salvati in locale nel browser e possono essere creati, duplicati, esportati, importati ed eliminati separatamente.

Il progetto corrente viene migrato automaticamente dal vecchio salvataggio singolo alla nuova libreria.

### Attivare Google login + salvataggio cloud

Il frontend è predisposto per **Firebase Authentication + Cloud Firestore**.

1. Crea un progetto su Firebase e aggiungi una Web App.
2. In **Authentication > Sign-in method**, abilita **Google**.
3. Crea un database **Cloud Firestore**.
4. Copia l'oggetto `firebaseConfig` della Web App dentro `firebase-config.js`, sostituendo `null`.
5. Applica le regole contenute in `firestore.rules` al database Firestore.
6. Aggiungi `lorenzosoriano.github.io` tra i domini autorizzati di Firebase Authentication, se non presente.

Esempio:

```js
window.PROJECTFLOW_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

Con Firebase non configurato l'app continua a funzionare normalmente in modalità **Local**. Quando un utente effettua il login Google, i progetti vengono sincronizzati sotto:

```text
users/{uid}/projects/{projectId}
```

Le regole incluse limitano lettura e scrittura al proprietario autenticato.
