(() => {
  "use strict";

  const STORAGE_KEY = "projectflow.project.v1";
  const VIEW_KEY = "projectflow.view.v1";
  const PANELS_KEY = "projectflow.panels.v1";
  const NODE_WIDTH = 360;

  const $ = (id) => document.getElementById(id);
  const nodeLayer = $("nodeLayer");
  const edgeLayer = $("edgeLayer");
  const viewport = $("canvasViewport");
  const world = $("world");

  const TYPE_META = {
    object: { label: "Oggetto", icon: "◇", color: "#9b8cff" },
    class: { label: "Classe", icon: "C", color: "#42d4df" },
    function: { label: "Funzione", icon: "ƒ", color: "#55d69e" },
    variable: { label: "Variabile", icon: "x", color: "#f3bd59" },
    condition: { label: "Condizione", icon: "?", color: "#ff966d" },
    ui: { label: "Interfaccia", icon: "▣", color: "#e979c6" },
    note: { label: "Nota", icon: "≡", color: "#98a6c2" }
  };

  const ROW_META = {
    variable: { icon: "x", label: "Variabile" },
    function: { icon: "ƒ", label: "Metodo" },
    unityEvent: { icon: "⚡", label: "UnityEvent" },
    property: { icon: "•", label: "Proprietà" },
    condition: { icon: "?", label: "Condizione" },
    input: { icon: "→", label: "Input" },
    output: { icon: "←", label: "Output" },
    text: { icon: "T", label: "Testo" }
  };

  const DATA_TYPES = [
    "bool", "int", "float", "double", "string",
    "Vector2", "Vector3", "Quaternion", "Color",
    "GameObject", "Transform", "Rigidbody", "Collider",
    "Animator", "AudioSource", "Camera", "SpriteRenderer",
    "Texture2D", "Material", "AnimationClip"
  ];

  const UNITY_LIFECYCLE = [
    { name: "Awake", parameters: "", returnType: "void" },
    { name: "OnEnable", parameters: "", returnType: "void" },
    { name: "Start", parameters: "", returnType: "void" },
    { name: "Update", parameters: "", returnType: "void" },
    { name: "FixedUpdate", parameters: "", returnType: "void" },
    { name: "LateUpdate", parameters: "", returnType: "void" },
    { name: "OnDisable", parameters: "", returnType: "void" },
    { name: "OnDestroy", parameters: "", returnType: "void" },
    { name: "OnValidate", parameters: "", returnType: "void" },
    { name: "OnTriggerEnter", parameters: "Collider other", returnType: "void" },
    { name: "OnTriggerExit", parameters: "Collider other", returnType: "void" },
    { name: "OnCollisionEnter", parameters: "Collision collision", returnType: "void" },
    { name: "OnCollisionExit", parameters: "Collision collision", returnType: "void" }
  ];

  const METHOD_KIND_LABELS = {
    custom: "Custom",
    lifecycle: "Unity lifecycle",
    eventHandler: "Event handler",
    unityEventListener: "UnityEvent listener",
    coroutine: "Coroutine"
  };

  const REFERENCE_MODE_LABELS = {
    value: "Valore",
    inspector: "Inspector reference",
    getComponent: "GetComponent",
    instance: "Instance / Singleton",
    findFirst: "FindFirstObjectByType",
    scriptableObject: "ScriptableObject asset"
  };

  const uid = (prefix) => prefix + "_" + Math.random().toString(36).slice(2, 9);

  function snapScale(value) {
    if (value > 0.97 && value < 1.03) return 1;
    return Math.round(value * 1000) / 1000;
  }

  function portKey(nodeId, rowId, side) {
    return nodeId + "|" + rowId + "|" + side;
  }

  function buildConnectedPortSet() {
    const connected = new Set();
    project.connections.forEach((edge) => {
      connected.add(portKey(edge.from.nodeId, edge.from.rowId, "out"));
      connected.add(portKey(edge.to.nodeId, edge.to.rowId, "in"));
    });
    return connected;
  }

  function row(label, value, kind, extra) {
    const item = {
      id: uid("row"),
      label: label || "value",
      value: value || "",
      kind: kind || "variable"
    };
    return Object.assign(item, extra || {});
  }

  function variableRow(label, dataType, access) {
    return row(label || "value", "", "variable", {
      dataType: dataType || "int",
      access: access || "private",
      serialized: false,
      referenceMode: "value",
      defaultValue: ""
    });
  }

  function methodRow(label, returnType, methodKind) {
    return row(label || "Method", "", "function", {
      access: "private",
      methodKind: methodKind || "custom",
      returnType: returnType || "void",
      parameters: ""
    });
  }

  function eventRow(label, payloadType) {
    return row(label || "OnEvent", "", "unityEvent", {
      access: "public",
      payloadType: payloadType || "void",
      serialized: true
    });
  }

  function publicClassNodes() {
    return project.nodes.filter((node) => node.type === "class" && node.classVisibility === "public");
  }

  function allClassNodes() {
    return project.nodes.filter((node) => node.type === "class");
  }

  function availableDataTypes() {
    return DATA_TYPES.concat(publicClassNodes().map((node) => node.title)).filter((value, index, array) => array.indexOf(value) === index);
  }

  function normalizeMember(item) {
    if (!item.id) item.id = uid("row");
    if (!ROW_META[item.kind]) item.kind = "variable";
    if (typeof item.label !== "string") item.label = "value";
    if (typeof item.value !== "string") item.value = "";

    if (item.kind === "variable" || item.kind === "property") {
      if (typeof item.access !== "string") item.access = item.kind === "property" ? "public" : "private";
      if (typeof item.dataType !== "string" || !item.dataType) {
        const guess = item.value.split("=")[0].trim();
        item.dataType = guess && guess.length < 32 ? guess : "int";
      }
      if (typeof item.serialized !== "boolean") item.serialized = item.access === "public";
      if (typeof item.referenceMode !== "string") item.referenceMode = "value";
      if (typeof item.defaultValue !== "string") item.defaultValue = "";
    }

    if (item.kind === "function") {
      if (typeof item.access !== "string") item.access = "private";
      if (typeof item.methodKind !== "string") item.methodKind = "custom";
      if (typeof item.returnType !== "string" || !item.returnType) {
        const match = item.value.match(/returns?\s+([^\s]+)/i);
        item.returnType = match ? match[1] : "void";
      }
      if (typeof item.parameters !== "string") item.parameters = "";
    }

    if (item.kind === "unityEvent") {
      if (typeof item.access !== "string") item.access = "public";
      if (typeof item.payloadType !== "string") item.payloadType = "void";
      if (typeof item.serialized !== "boolean") item.serialized = true;
    }
    return item;
  }

  function ensureNodeMeta(node) {
    if (!Array.isArray(node.rows)) node.rows = [];
    node.rows.forEach(normalizeMember);
    if (!node.uiSections || typeof node.uiSections !== "object") node.uiSections = {};

    if (node.type === "class") {
      if (typeof node.classVisibility !== "string") node.classVisibility = "public";
      if (typeof node.baseType !== "string") node.baseType = "MonoBehaviour";
      if (typeof node.instanceAccess !== "string") node.instanceAccess = "inspector";
      if (typeof node.executionOrder !== "number") node.executionOrder = 0;
    }

    if (node.type === "function") {
      if (typeof node.ownerClassId !== "string") node.ownerClassId = "";
      if (typeof node.methodAccess !== "string") node.methodAccess = "public";
      if (typeof node.methodKind !== "string") node.methodKind = "custom";
      if (typeof node.returnType !== "string") node.returnType = "void";
      if (typeof node.parameters !== "string") node.parameters = "";
    }
  }

  function sampleProject() {
    const doorId = row("doorId", "int", "variable");
    const requiredKey = row("requiredKeyId", "int", "variable");
    const open = row("open", "bool = false", "property");
    const tryOpen = row("TryOpen()", "returns bool", "function");

    const keyId = row("keyId", "int", "variable");
    const compareA = row("doorId", "input", "input");
    const compareB = row("keyId", "input", "input");
    const compareResult = row("sameId", "bool", "output");

    const score = row("score", "int", "variable");
    const multiplier = row("multiplier", "float", "variable");
    const calc = row("CalculateScore()", "returns int", "function");

    const calcInput = row("baseScore", "int", "input");
    const calcMultiplier = row("multiplier", "float", "input");
    const calcOutput = row("result", "int", "output");

    const uiText = row("text", "string", "property");

    const nodes = [
      {
        id: "door",
        type: "object",
        title: "Door",
        description: "Porta interattiva. Si apre solo quando la chiave possiede lo stesso ID.",
        pseudo: "if key.id == door.id\n  open = true\nelse\n  open = false",
        x: 180, y: 170,
        rows: [doorId, requiredKey, open, tryOpen]
      },
      {
        id: "key",
        type: "object",
        title: "Key",
        description: "Oggetto raccoglibile che espone l'identificativo della chiave.",
        pseudo: "keyId = 3",
        x: 180, y: 500,
        rows: [keyId]
      },
      {
        id: "compare",
        type: "condition",
        title: "ID Match?",
        description: "Confronto concettuale tra porta e chiave.",
        pseudo: "doorId == keyId",
        x: 590, y: 310,
        rows: [compareA, compareB, compareResult]
      },
      {
        id: "game_manager",
        type: "class",
        title: "GameManager",
        description: "Mantiene lo stato della partita e calcola il punteggio corrente.",
        pseudo: "score = collected * multiplier",
        x: 1030, y: 150,
        rows: [score, multiplier, calc]
      },
      {
        id: "calculate_score",
        type: "function",
        title: "Calculate Score",
        description: "Esempio di funzione separata dal GameManager per rendere esplicito il flow.",
        pseudo: "result = baseScore * multiplier\nreturn result",
        x: 1030, y: 475,
        rows: [calcInput, calcMultiplier, calcOutput]
      },
      {
        id: "score_text",
        type: "ui",
        title: "Score Text",
        description: "Elemento UI che visualizza il valore finale calcolato.",
        pseudo: "Text = \"Score: \" + result",
        x: 1450, y: 430,
        rows: [uiText]
      },
      {
        id: "note_intro",
        type: "note",
        title: "Concept first, code later",
        description: "I collegamenti descrivono dipendenze e passaggi di dati. Non devono essere validi per un linguaggio specifico.",
        pseudo: "",
        x: 1030, y: 760,
        rows: []
      }
    ];

    return {
      version: 1,
      name: "Game Systems — Concept",
      nodes: nodes,
      connections: [
        { id: uid("edge"), from: { nodeId: "door", rowId: doorId.id, side: "out" }, to: { nodeId: "compare", rowId: compareA.id, side: "in" } },
        { id: uid("edge"), from: { nodeId: "key", rowId: keyId.id, side: "out" }, to: { nodeId: "compare", rowId: compareB.id, side: "in" } },
        { id: uid("edge"), from: { nodeId: "compare", rowId: compareResult.id, side: "out" }, to: { nodeId: "door", rowId: open.id, side: "in" } },
        { id: uid("edge"), from: { nodeId: "game_manager", rowId: score.id, side: "out" }, to: { nodeId: "calculate_score", rowId: calcInput.id, side: "in" } },
        { id: uid("edge"), from: { nodeId: "game_manager", rowId: multiplier.id, side: "out" }, to: { nodeId: "calculate_score", rowId: calcMultiplier.id, side: "in" } },
        { id: uid("edge"), from: { nodeId: "calculate_score", rowId: calcOutput.id, side: "out" }, to: { nodeId: "score_text", rowId: uiText.id, side: "in" } }
      ]
    };
  }

  function normalizeProject(raw) {
    const base = raw && typeof raw === "object" ? raw : sampleProject();
    if (!Array.isArray(base.nodes)) base.nodes = [];
    if (!Array.isArray(base.connections)) base.connections = [];
    base.connections.forEach((edge) => {
      if (!edge.id) edge.id = uid("edge");
      if (!Array.isArray(edge.points)) edge.points = [];
      edge.points = edge.points.filter((point) =>
        point && typeof point.x === "number" && typeof point.y === "number"
      ).map((point) => ({
        id: point.id || uid("junction"),
        x: point.x,
        y: point.y
      }));
    });
    base.nodes.forEach((node) => {
      if (!node.id) node.id = uid("node");
      if (!TYPE_META[node.type]) node.type = "object";
      if (!Array.isArray(node.rows)) node.rows = [];
      if (typeof node.x !== "number") node.x = 200;
      if (typeof node.y !== "number") node.y = 200;
      if (typeof node.title !== "string") node.title = TYPE_META[node.type].label;
      if (typeof node.description !== "string") node.description = "";
      if (typeof node.pseudo !== "string") node.pseudo = "";
      node.rows.forEach(normalizeMember);
      ensureNodeMeta(node);
    });
    if (typeof base.name !== "string") base.name = "Untitled Flow";
    return base;
  }

  function loadProject() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeProject(JSON.parse(saved)) : sampleProject();
    } catch (error) {
      console.warn("ProjectFlow: impossibile leggere il progetto salvato.", error);
      return sampleProject();
    }
  }

  function loadView() {
    try {
      const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || "null");
      if (saved && typeof saved.x === "number" && typeof saved.y === "number" && typeof saved.scale === "number") {
        return saved;
      }
    } catch (error) {}
    return { x: 70, y: 60, scale: 1 };
  }

  let project = loadProject();
  let view = loadView();
  let selectedNodeId = null;
  let selectedNodeIds = new Set();
  let selectedEdgeId = null;
  let pendingPort = null;
  let dragState = null;
  let junctionDrag = null;
  let marqueeState = null;
  let panelResizeState = null;
  let inspectorVisible = false;
  let panState = null;
  let saveTimer = null;
  let toastTimer = null;
  let connectMode = false;

  $("projectName").value = project.name;

  function nodeById(id) {
    return project.nodes.find((node) => node.id === id) || null;
  }

  function selectedNode() {
    if (selectedNodeIds.size !== 1) return null;
    const id = selectedNodeIds.values().next().value;
    return nodeById(id);
  }

  function isNodeSelected(id) {
    return selectedNodeIds.has(id);
  }

  function syncPrimarySelection() {
    selectedNodeId = selectedNodeIds.size ? Array.from(selectedNodeIds).pop() : null;
  }

  function selectedNodes() {
    return project.nodes.filter((node) => selectedNodeIds.has(node.id));
  }

  function loadPanelWidths() {
    let widths = { library: 245, inspector: 305 };
    try {
      const saved = JSON.parse(localStorage.getItem(PANELS_KEY) || "null");
      if (saved && typeof saved.library === "number") widths.library = saved.library;
      if (saved && typeof saved.inspector === "number") widths.inspector = saved.inspector;
    } catch (error) {}
    widths.library = Math.max(180, Math.min(420, widths.library));
    widths.inspector = Math.max(240, Math.min(520, widths.inspector));
    document.documentElement.style.setProperty("--library-width", widths.library + "px");
    document.documentElement.style.setProperty("--inspector-width", widths.inspector + "px");
    return widths;
  }

  let panelWidths = loadPanelWidths();

  function setPanelWidths() {
    document.documentElement.style.setProperty("--library-width", panelWidths.library + "px");
    document.documentElement.style.setProperty("--inspector-width", panelWidths.inspector + "px");
    localStorage.setItem(PANELS_KEY, JSON.stringify(panelWidths));
    requestAnimationFrame(() => {
      renderEdges();
      renderMinimap();
    });
  }

  function setInspectorVisible(visible) {
    inspectorVisible = !!visible;
    const workspace = document.querySelector(".workspace");
    if (workspace) workspace.classList.toggle("inspector-collapsed", !inspectorVisible);
    $("inspectorPanel").classList.toggle("manual-hidden", !inspectorVisible);
    if (window.innerWidth <= 850) {
      $("inspectorPanel").classList.toggle("open", inspectorVisible && selectedNodeIds.size > 0);
    }
    requestAnimationFrame(() => {
      renderEdges();
      renderMinimap();
    });
  }

  function setWorldTransform() {
    const scale = snapScale(view.scale);
    const tx = Math.round(view.x);
    const ty = Math.round(view.y);
    view.scale = scale;
    view.x = tx;
    view.y = ty;
    world.style.transform = "translate3d(" + tx + "px," + ty + "px,0) scale(" + scale + ")";
    $("zoomReadout").textContent = Math.round(scale * 100) + "%";
    localStorage.setItem(VIEW_KEY, JSON.stringify(view));
    renderMinimap();
  }

  function markDirty() {
    $("saveStatus").textContent = "Modifiche non salvate";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProject, 350);
  }

  function saveProject(showMessage) {
    project.name = $("projectName").value.trim() || "Untitled Flow";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    $("saveStatus").textContent = "Salvato localmente";
    if (showMessage) showToast("Progetto salvato nel browser");
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function typeMeta(type) {
    return TYPE_META[type] || TYPE_META.object;
  }

  function ownerClassName(node) {
    const owner = node && node.ownerClassId ? nodeById(node.ownerClassId) : null;
    return owner ? owner.title : "";
  }

  function memberSummary(item) {
    if (item.kind === "function") {
      const kind = METHOD_KIND_LABELS[item.methodKind] || "Custom";
      return item.access + " " + (item.returnType || "void") + " (" + (item.parameters || "") + ") · " + kind;
    }
    if (item.kind === "unityEvent") {
      return item.access + " UnityEvent" + (item.payloadType && item.payloadType !== "void" ? "<" + item.payloadType + ">" : "");
    }
    if (item.kind === "variable" || item.kind === "property") {
      const reference = item.referenceMode && item.referenceMode !== "value" ? " · " + (REFERENCE_MODE_LABELS[item.referenceMode] || item.referenceMode) : "";
      const inspector = item.serialized ? " · Inspector" : "";
      return item.access + " " + (item.dataType || "value") + inspector + reference;
    }
    return item.value || "";
  }

  function nodeSubtitle(node) {
    if (node.type === "class") {
      return node.classVisibility + " " + node.baseType + (node.instanceAccess === "instance" ? " · Instance" : "");
    }
    if (node.type === "function") {
      const owner = ownerClassName(node);
      return (owner ? owner + " · " : "") + node.methodAccess + " " + node.returnType;
    }
    return typeMeta(node.type).label;
  }

  function memberByRef(ref) {
    if (!ref || ref.rowId === "__node__") return null;
    const node = nodeById(ref.nodeId);
    return node ? node.rows.find((item) => item.id === ref.rowId) || null : null;
  }

  function firstParameterType(parameters) {
    const first = String(parameters || "").split(",")[0].trim();
    if (!first) return "any";
    return first.split(/\s+/)[0] || "any";
  }

  function normalizedType(value) {
    const type = String(value || "any").trim();
    return type || "any";
  }

  function memberInputType(item) {
    if (!item) return "any";
    if (item.kind === "variable" || item.kind === "property") return normalizedType(item.dataType);
    if (item.kind === "function") return firstParameterType(item.parameters);
    if (item.kind === "unityEvent") return normalizedType(item.payloadType);
    if (item.kind === "input") return normalizedType(item.value);
    if (item.kind === "condition") return "any";
    return "any";
  }

  function memberOutputType(item) {
    if (!item) return "any";
    if (item.kind === "variable" || item.kind === "property") return normalizedType(item.dataType);
    if (item.kind === "function") return normalizedType(item.returnType);
    if (item.kind === "unityEvent") return normalizedType(item.payloadType);
    if (item.kind === "output") return normalizedType(item.value);
    if (item.kind === "condition") return normalizedType(item.value || "bool");
    return "any";
  }

  function sameType(a, b) {
    a = normalizedType(a);
    b = normalizedType(b);
    if (a === "any" || b === "any" || a === "value" || b === "value") return true;
    return a === b;
  }

  function normalizeConnectionRefs(a, b) {
    let from = a;
    let to = b;
    if (from.side === "in") {
      const temp = from;
      from = to;
      to = temp;
    }
    return { from, to };
  }

  function connectionCheck(a, b) {
    if (!a || !b || a.side === b.side) return { ok: false, reason: "Servono un output e un input." };
    const pair = normalizeConnectionRefs(a, b);
    const fromItem = memberByRef(pair.from);
    const toItem = memberByRef(pair.to);

    if (fromItem && fromItem.kind === "function" && normalizedType(fromItem.returnType) === "void") {
      return { ok: false, reason: "Un metodo void non restituisce un dato." };
    }

    if (pair.from.nodeId !== pair.to.nodeId) {
      if (fromItem && fromItem.access === "private") {
        return { ok: false, reason: "Un membro private può uscire solo all’interno della propria classe." };
      }
      if (toItem && toItem.access === "private") {
        return { ok: false, reason: "Un membro private può ricevere dati solo all’interno della propria classe." };
      }
    }

    const outputType = memberOutputType(fromItem);
    const inputType = memberInputType(toItem);
    if (!sameType(outputType, inputType)) {
      return { ok: false, reason: "Tipo incompatibile: " + outputType + " → " + inputType + "." };
    }

    return { ok: true, from: pair.from, to: pair.to, outputType, inputType };
  }

  function dataTypeColor(type) {
    const value = normalizedType(type);
    if (value === "bool") return "#ff966d";
    if (["int", "float", "double"].includes(value)) return "#f3bd59";
    if (value === "string") return "#e979c6";
    if (["Vector2", "Vector3", "Quaternion", "Color"].includes(value)) return "#42d4df";
    if (["GameObject", "Transform", "Rigidbody", "Collider", "Animator", "AudioSource", "Camera", "SpriteRenderer"].includes(value)) return "#55d69e";
    if (value === "void") return "#68748a";
    if (publicClassNodes().some((node) => node.title === value)) return "#9b8cff";
    return "#7d8aa3";
  }

  function decoratePort(port, type) {
    const color = dataTypeColor(type);
    port.style.setProperty("--port-color", color);
    port.dataset.dataType = normalizedType(type);
    return port;
  }

  function makePort(nodeId, rowId, side, connectedPorts) {
    const port = document.createElement("button");
    port.className = "port " + side;
    port.type = "button";
    port.dataset.node = nodeId;
    port.dataset.row = rowId;
    port.dataset.side = side;
    if (connectedPorts && connectedPorts.has(portKey(nodeId, rowId, side))) {
      port.classList.add("connected");
    }
    port.setAttribute("aria-label", (side === "in" ? "Input" : "Output") + " " + rowId);
    if (pendingPort && pendingPort.nodeId === nodeId && pendingPort.rowId === rowId && pendingPort.side === side) {
      port.classList.add("pending");
    } else if (pendingPort && pendingPort.side !== side) {
      const check = connectionCheck(pendingPort, { nodeId: nodeId, rowId: rowId, side: side });
      port.classList.add(check.ok ? "compatible" : "incompatible");
      if (!check.ok) port.title = check.reason;
    }
    port.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlePortClick({ nodeId: nodeId, rowId: rowId, side: side });
    });
    return port;
  }

  function createNodeElement(node, connectedPorts) {
    ensureNodeMeta(node);
    const meta = typeMeta(node.type);
    const element = document.createElement("article");
    element.className = "flow-node type-" + node.type;
    if (isNodeSelected(node.id)) element.classList.add("selected");
    if (pendingPort && pendingPort.nodeId === node.id) element.classList.add("connection-source");
    element.dataset.nodeId = node.id;
    element.style.left = node.x + "px";
    element.style.top = node.y + "px";

    const header = document.createElement("div");
    header.className = "node-header";
    header.appendChild(makePort(node.id, "__node__", "in", connectedPorts));

    const typeDot = document.createElement("span");
    typeDot.className = "node-type-dot";
    typeDot.textContent = meta.icon;

    const heading = document.createElement("div");
    heading.className = "node-heading inline-heading";

    const titleInput = document.createElement("input");
    titleInput.className = "node-title-inline";
    titleInput.value = node.title;
    titleInput.setAttribute("aria-label", "Nome blocco");
    titleInput.addEventListener("pointerdown", (event) => event.stopPropagation());
    titleInput.addEventListener("input", () => {
      node.title = titleInput.value;
      markDirty();
    });
    titleInput.addEventListener("change", () => {
      renderInspector();
      renderNodes();
      renderEdges();
    });

    const label = document.createElement("small");
    label.textContent = nodeSubtitle(node);
    heading.append(titleInput, label);

    const more = document.createElement("button");
    more.className = "node-more";
    more.type = "button";
    more.textContent = "•••";
    more.title = "Apri Inspector";
    more.addEventListener("pointerdown", (event) => event.stopPropagation());
    more.addEventListener("click", (event) => {
      event.stopPropagation();
      selectNode(node.id, null, true);
      setInspectorVisible(true);
    });

    const removeNodeButton = document.createElement("button");
    removeNodeButton.className = "node-delete-inline";
    removeNodeButton.type = "button";
    removeNodeButton.textContent = "×";
    removeNodeButton.title = "Elimina blocco";
    removeNodeButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    removeNodeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      project.nodes = project.nodes.filter((item) => item.id !== node.id);
      project.connections = project.connections.filter((edge) => edge.from.nodeId !== node.id && edge.to.nodeId !== node.id);
      selectedNodeIds.delete(node.id);
      syncPrimarySelection();
      render();
      markDirty();
      showToast("Blocco eliminato");
    });

    header.append(typeDot, heading, more, removeNodeButton, makePort(node.id, "__node__", "out", connectedPorts));

    header.addEventListener("pointerdown", (event) => {
      if (
        event.button !== 0 ||
        event.target.closest(".port") ||
        event.target.closest("button") ||
        event.target.closest("input") ||
        event.target.closest("select") ||
        event.target.closest("textarea")
      ) return;
      event.preventDefault();
      event.stopPropagation();

      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      if (!isNodeSelected(node.id) || additive || selectedNodeIds.size <= 1) {
        selectNode(node.id, event);
      }

      if (isNodeSelected(node.id)) startNodeDrag(event, node);
    });

    const body = document.createElement("div");
    body.className = "node-body";

    const rerenderNode = () => {
      renderNodes();
      renderEdges();
      renderMinimap();
      renderInspector();
      markDirty();
    };

    const compactSelect = (value, options, onChange, className) => {
      const select = document.createElement("select");
      select.className = className || "inline-member-select";
      options.forEach((optionValue) => {
        const pair = Array.isArray(optionValue) ? optionValue : [optionValue, optionValue];
        const option = document.createElement("option");
        option.value = pair[0];
        option.textContent = pair[1];
        select.appendChild(option);
      });
      if (value && !Array.from(select.options).some((option) => option.value === value)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
      select.value = value || select.options[0]?.value || "";
      select.addEventListener("pointerdown", (event) => event.stopPropagation());
      select.addEventListener("change", () => onChange(select.value));
      return select;
    };

    const inlineInput = (value, placeholder, onInput, className) => {
      const input = document.createElement("input");
      input.className = className || "inline-member-input";
      input.value = value || "";
      input.placeholder = placeholder || "";
      input.addEventListener("pointerdown", (event) => event.stopPropagation());
      input.addEventListener("input", () => {
        onInput(input.value);
        markDirty();
      });
      return input;
    };

    if (node.type === "note") {
      const noteEditor = document.createElement("textarea");
      noteEditor.className = "node-note-editor";
      noteEditor.value = node.description || "";
      noteEditor.placeholder = "Scrivi la nota direttamente qui…";
      noteEditor.spellcheck = true;
      noteEditor.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        if (!isNodeSelected(node.id)) {
          selectedNodeIds = new Set([node.id]);
          syncPrimarySelection();
          selectedEdgeId = null;
          element.classList.add("selected");
          renderInspector();
          renderMinimap();
        }
      });
      noteEditor.addEventListener("input", () => {
        node.description = noteEditor.value;
        noteEditor.style.height = "auto";
        noteEditor.style.height = Math.max(92, noteEditor.scrollHeight) + "px";
        markDirty();
      });
      body.appendChild(noteEditor);
      requestAnimationFrame(() => {
        noteEditor.style.height = "auto";
        noteEditor.style.height = Math.max(92, noteEditor.scrollHeight) + "px";
      });
    } else {
      if (node.description) {
        const desc = document.createElement("div");
        desc.className = "node-description";
        desc.textContent = node.description;
        body.appendChild(desc);
      }

      if (node.type === "class") {
        const classMeta = document.createElement("div");
        classMeta.className = "node-meta-inline";
        classMeta.append(
          compactSelect(node.classVisibility, [["public", "public"], ["internal", "internal"]], (value) => {
            node.classVisibility = value;
            rerenderNode();
          }, "node-meta-select"),
          compactSelect(node.baseType, [["MonoBehaviour", "MonoBehaviour"], ["ScriptableObject", "ScriptableObject"], ["Plain C#", "Plain C#"]], (value) => {
            node.baseType = value;
            if (value === "ScriptableObject") node.instanceAccess = "scriptableObject";
            rerenderNode();
          }, "node-meta-select"),
          compactSelect(node.instanceAccess, [
            ["inspector", "Inspector"],
            ["getComponent", "GetComponent"],
            ["instance", "Instance"],
            ["findFirst", "FindFirst"],
            ["scriptableObject", "SO Asset"],
            ["value", "Local"]
          ], (value) => {
            node.instanceAccess = value;
            rerenderNode();
          }, "node-meta-select")
        );
        body.appendChild(classMeta);
      }

      if (node.type === "function") {
        const functionMeta = document.createElement("div");
        functionMeta.className = "node-function-inline";
        functionMeta.append(
          compactSelect(node.methodAccess, ["public", "private", "protected", "internal"], (value) => {
            node.methodAccess = value;
            rerenderNode();
          }),
          compactSelect(node.returnType, ["void"].concat(availableDataTypes()), (value) => {
            node.returnType = value;
            rerenderNode();
          }),
          inlineInput(node.parameters, "parametri", (value) => {
            node.parameters = value;
          }, "inline-params-input")
        );
        body.appendChild(functionMeta);
      }

      const removeMember = (item) => {
        node.rows = node.rows.filter((rowItem) => rowItem.id !== item.id);
        project.connections = project.connections.filter((edge) => edge.from.rowId !== item.id && edge.to.rowId !== item.id);
        rerenderNode();
      };

      const moveMemberBefore = (sourceId, targetId) => {
        if (sourceId === targetId) return;
        const sourceIndex = node.rows.findIndex((item) => item.id === sourceId);
        const targetIndex = node.rows.findIndex((item) => item.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const sourceItem = node.rows[sourceIndex];
        const targetItem = node.rows[targetIndex];
        const sameGroup =
          (["variable", "property"].includes(sourceItem.kind) && ["variable", "property"].includes(targetItem.kind)) ||
          sourceItem.kind === targetItem.kind;
        if (!sameGroup) {
          showToast("Riordina variabili, metodi ed eventi dentro la propria sezione.");
          return;
        }
        node.rows.splice(sourceIndex, 1);
        const freshTargetIndex = node.rows.findIndex((item) => item.id === targetId);
        node.rows.splice(freshTargetIndex, 0, sourceItem);
        rerenderNode();
      };

      const makeRowElement = (item) => {
        normalizeMember(item);
        const itemMeta = ROW_META[item.kind] || ROW_META.variable;
        const rowElement = document.createElement("div");
        rowElement.className = "node-row member-" + item.kind + " inline-edit-row";
        rowElement.dataset.rowId = item.id;
        rowElement.draggable = false;

        rowElement.addEventListener("dragstart", (event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/projectflow-member", item.id);
          rowElement.classList.add("dragging");
        });
        rowElement.addEventListener("dragend", () => {
          rowElement.classList.remove("dragging");
          rowElement.draggable = false;
        });
        rowElement.addEventListener("dragover", (event) => {
          if (!event.dataTransfer.types.includes("text/projectflow-member")) return;
          event.preventDefault();
          rowElement.classList.add("drop-target");
        });
        rowElement.addEventListener("dragleave", () => rowElement.classList.remove("drop-target"));
        rowElement.addEventListener("drop", (event) => {
          event.preventDefault();
          event.stopPropagation();
          rowElement.classList.remove("drop-target");
          moveMemberBefore(event.dataTransfer.getData("text/projectflow-member"), item.id);
        });

        const inputType = memberInputType(item);
        const outputType = memberOutputType(item);
        const allowInput =
          item.kind === "variable" ||
          item.kind === "property" ||
          item.kind === "unityEvent" ||
          item.kind === "condition" ||
          item.kind === "input" ||
          (item.kind === "function" && firstParameterType(item.parameters) !== "any");
        const allowOutput =
          item.kind === "variable" ||
          item.kind === "property" ||
          item.kind === "unityEvent" ||
          item.kind === "condition" ||
          item.kind === "output" ||
          (item.kind === "function" && normalizedType(item.returnType) !== "void");

        if (allowInput) {
          rowElement.appendChild(decoratePort(makePort(node.id, item.id, "in", connectedPorts), inputType));
        }

        const dragHandle = document.createElement("span");
        dragHandle.className = "member-drag";
        dragHandle.textContent = "⋮⋮";
        dragHandle.title = "Trascina per riordinare";
        dragHandle.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
          rowElement.draggable = true;
        });
        dragHandle.addEventListener("pointerup", () => {
          setTimeout(() => { rowElement.draggable = false; }, 0);
        });

        const kind = document.createElement("span");
        kind.className = "row-kind";
        kind.textContent = itemMeta.icon;

        const editor = document.createElement("div");
        editor.className = "inline-member-editor";

        const topLine = document.createElement("div");
        topLine.className = "inline-member-top";

        if (item.kind === "variable" || item.kind === "property") {
          const access = compactSelect(item.access, ["public", "private", "protected", "internal"], (value) => {
            item.access = value;
            if (value === "public") item.serialized = true;
            rerenderNode();
          }, "inline-access-select");

          const type = compactSelect(item.dataType, availableDataTypes(), (value) => {
            item.dataType = value;
            if (publicClassNodes().some((classNode) => classNode.title === value) && item.referenceMode === "value") {
              item.referenceMode = "inspector";
            }
            rerenderNode();
          }, "inline-type-select");

          const name = inlineInput(item.label, "nome", (value) => {
            item.label = value;
          }, "inline-name-input");

          topLine.append(access, type, name);

          const second = document.createElement("div");
          second.className = "inline-member-bottom";
          const reference = compactSelect(item.referenceMode, [
            ["value", "Valore"],
            ["inspector", "Inspector"],
            ["getComponent", "GetComponent"],
            ["instance", "Instance"],
            ["findFirst", "FindFirst"],
            ["scriptableObject", "SO Asset"]
          ], (value) => {
            item.referenceMode = value;
            rerenderNode();
          }, "inline-reference-select");

          const defaultValue = inlineInput(item.defaultValue, "default", (value) => {
            item.defaultValue = value;
          }, "inline-default-input");

          const serialized = document.createElement("button");
          serialized.type = "button";
          serialized.className = "inline-flag" + (item.serialized ? " active" : "");
          serialized.textContent = "S";
          serialized.title = "SerializeField / Inspector";
          serialized.addEventListener("pointerdown", (event) => event.stopPropagation());
          serialized.addEventListener("click", (event) => {
            event.stopPropagation();
            item.serialized = !item.serialized;
            rerenderNode();
          });

          second.append(reference, defaultValue, serialized);
          editor.append(topLine, second);
        } else if (item.kind === "function") {
          const access = compactSelect(item.access, ["public", "private", "protected", "internal"], (value) => {
            item.access = value;
            rerenderNode();
          }, "inline-access-select");

          const returnType = compactSelect(item.returnType, ["void"].concat(availableDataTypes()), (value) => {
            item.returnType = value;
            rerenderNode();
          }, "inline-type-select");

          const name = inlineInput(item.label, "Metodo", (value) => {
            item.label = value;
          }, "inline-name-input");

          topLine.append(access, returnType, name);

          const second = document.createElement("div");
          second.className = "inline-member-bottom";

          const methodKind = compactSelect(item.methodKind, [
            ["custom", "Custom"],
            ["lifecycle", "Unity"],
            ["eventHandler", "Handler"],
            ["unityEventListener", "Listener"],
            ["coroutine", "Coroutine"]
          ], (value) => {
            item.methodKind = value;
            if (value === "lifecycle") {
              const preset = UNITY_LIFECYCLE[0];
              item.label = preset.name;
              item.returnType = preset.returnType;
              item.parameters = preset.parameters;
            }
            rerenderNode();
          }, "inline-method-kind");

          const params = inlineInput(item.parameters, "parametri: int score, Player player", (value) => {
            item.parameters = value;
          }, "inline-params-input");

          second.append(methodKind, params);
          editor.append(topLine, second);
        } else if (item.kind === "unityEvent") {
          const access = compactSelect(item.access, ["public", "private", "protected"], (value) => {
            item.access = value;
            rerenderNode();
          }, "inline-access-select");

          const payload = compactSelect(item.payloadType, ["void"].concat(availableDataTypes()), (value) => {
            item.payloadType = value;
            rerenderNode();
          }, "inline-type-select");

          const name = inlineInput(item.label, "OnEvent", (value) => {
            item.label = value;
          }, "inline-name-input");

          topLine.append(access, payload, name);
          editor.appendChild(topLine);
        } else {
          const name = inlineInput(item.label, "nome", (value) => {
            item.label = value;
          }, "inline-name-input");
          const value = inlineInput(item.value, "tipo / valore", (next) => {
            item.value = next;
          }, "inline-default-input");
          topLine.append(name, value);
          editor.appendChild(topLine);
        }

        const remove = document.createElement("button");
        remove.className = "inline-remove-member";
        remove.type = "button";
        remove.textContent = "×";
        remove.title = "Rimuovi membro";
        remove.addEventListener("pointerdown", (event) => event.stopPropagation());
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          removeMember(item);
        });

        rowElement.append(dragHandle, kind, editor, remove);

        if (allowOutput) {
          rowElement.appendChild(decoratePort(makePort(node.id, item.id, "out", connectedPorts), outputType));
        }

        return rowElement;
      };

      const addMemberFromAction = (action) => {
        if (action === "variable") node.rows.push(variableRow("newVariable", "int", "private"));
        if (action === "method") node.rows.push(methodRow("NewMethod", "void", "custom"));
        if (action === "lifecycle") node.rows.push(methodRow("Start", "void", "lifecycle"));
        if (action === "coroutine") {
          const method = methodRow("NewCoroutine", "IEnumerator", "coroutine");
          node.rows.push(method);
        }
        if (action === "event") node.rows.push(eventRow("OnEvent", "void"));
        if (action.startsWith("class:")) {
          const className = action.slice(6);
          const variable = variableRow(className.charAt(0).toLowerCase() + className.slice(1), className, "private");
          variable.referenceMode = "inspector";
          variable.serialized = true;
          node.rows.push(variable);
        }
        rerenderNode();
      };

      const appendSection = (titleText, items, actions) => {
        const sectionKey = titleText.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const collapsed = !!node.uiSections[sectionKey];
        const section = document.createElement("div");
        section.className = "node-member-section" + (collapsed ? " collapsed" : "");
        section.dataset.sectionKey = sectionKey;

        const sectionTitle = document.createElement("div");
        sectionTitle.className = "node-member-title section-title-row";

        const titleButton = document.createElement("button");
        titleButton.type = "button";
        titleButton.className = "section-collapse-button";
        titleButton.title = collapsed ? "Espandi sezione" : "Comprimi sezione";
        titleButton.addEventListener("pointerdown", (event) => event.stopPropagation());
        titleButton.addEventListener("click", (event) => {
          event.stopPropagation();
          node.uiSections[sectionKey] = !node.uiSections[sectionKey];
          rerenderNode();
        });

        const chevron = document.createElement("span");
        chevron.className = "section-chevron";
        chevron.textContent = collapsed ? "▸" : "▾";

        const titleSpan = document.createElement("span");
        titleSpan.className = "section-title-text";
        titleSpan.textContent = titleText;

        const count = document.createElement("span");
        count.className = "section-count";
        count.textContent = String(items.length);
        count.title = items.length + " elementi";

        titleButton.append(chevron, titleSpan, count);
        sectionTitle.appendChild(titleButton);
        section.appendChild(sectionTitle);

        const content = document.createElement("div");
        content.className = "section-content";

        let memberList = null;
        if (items.length) {
          if (items.length >= 6) {
            const tools = document.createElement("div");
            tools.className = "section-tools";

            const search = document.createElement("input");
            search.className = "section-search";
            search.type = "search";
            search.placeholder = "Cerca in " + titleText.toLowerCase() + "…";
            search.setAttribute("aria-label", "Cerca in " + titleText);
            search.addEventListener("pointerdown", (event) => event.stopPropagation());
            search.addEventListener("input", () => {
              const query = search.value.toLowerCase().trim();
              memberList.querySelectorAll(".inline-edit-row").forEach((row) => {
                row.style.display = !query || (row.dataset.search || "").includes(query) ? "" : "none";
              });
              renderEdges();
            });

            const density = document.createElement("span");
            density.className = "section-density-label";
            density.textContent = items.length + " elementi";

            tools.append(search, density);
            content.appendChild(tools);
          }

          memberList = document.createElement("div");
          memberList.className = "section-member-list" + (items.length >= 6 ? " scrollable" : "");
          memberList.addEventListener("scroll", () => renderEdges(), { passive: true });
          memberList.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });

          items.forEach((item) => {
            const rowElement = makeRowElement(item);
            rowElement.dataset.search = [
              item.label,
              item.dataType,
              item.returnType,
              item.parameters,
              item.access,
              item.methodKind,
              item.payloadType
            ].filter(Boolean).join(" ").toLowerCase();
            memberList.appendChild(rowElement);
          });
          content.appendChild(memberList);
        } else {
          const emptyState = document.createElement("div");
          emptyState.className = "section-empty";
          emptyState.textContent = "Nessun elemento";
          content.appendChild(emptyState);
        }

        if (actions && actions.length) {
          const addWrap = document.createElement("div");
          addWrap.className = "section-add-wrap";

          const addButton = document.createElement("button");
          addButton.type = "button";
          addButton.className = "section-add-button";
          addButton.textContent = "＋";
          addButton.title = "Aggiungi a " + titleText.toLowerCase();
          addButton.addEventListener("pointerdown", (event) => event.stopPropagation());

          const popup = document.createElement("div");
          popup.className = "section-add-popup";

          actions.forEach((action) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "section-add-option";
            button.textContent = action.label;
            button.addEventListener("pointerdown", (event) => event.stopPropagation());
            button.addEventListener("click", (event) => {
              event.stopPropagation();
              addMemberFromAction(action.value);
            });
            popup.appendChild(button);
          });

          addButton.addEventListener("click", (event) => {
            event.stopPropagation();
            element.querySelectorAll(".section-add-popup.open").forEach((openPopup) => {
              if (openPopup !== popup) openPopup.classList.remove("open");
            });
            popup.classList.toggle("open");
          });

          addWrap.append(addButton, popup);
          content.appendChild(addWrap);
        }

        section.appendChild(content);
        body.appendChild(section);
      };

      if (node.type === "class") {
        const classReferences = publicClassNodes()
          .filter((classNode) => classNode.id !== node.id)
          .map((classNode) => ({ label: "Reference · " + classNode.title, value: "class:" + classNode.title }));

        appendSection(
          "VARIABLES",
          node.rows.filter((item) => item.kind === "variable" || item.kind === "property"),
          [{ label: "Variable", value: "variable" }].concat(classReferences)
        );
        appendSection(
          "METHODS",
          node.rows.filter((item) => item.kind === "function"),
          [
            { label: "Custom method", value: "method" },
            { label: "Unity callback", value: "lifecycle" },
            { label: "Coroutine", value: "coroutine" }
          ]
        );
        appendSection(
          "UNITY EVENTS",
          node.rows.filter((item) => item.kind === "unityEvent"),
          [{ label: "UnityEvent", value: "event" }]
        );
        const otherItems = node.rows.filter((item) => !["variable", "property", "function", "unityEvent"].includes(item.kind));
        if (otherItems.length) appendSection("OTHER", otherItems, []);
      } else {
        node.rows.forEach((item) => body.appendChild(makeRowElement(item)));
      }

      if (node.pseudo) {
        const pseudo = document.createElement("textarea");
        pseudo.className = "node-pseudo-inline";
        pseudo.value = node.pseudo;
        pseudo.spellcheck = false;
        pseudo.addEventListener("pointerdown", (event) => event.stopPropagation());
        pseudo.addEventListener("input", () => {
          node.pseudo = pseudo.value;
          markDirty();
        });
        body.appendChild(pseudo);
      }
    }

    element.append(header, body);

    element.addEventListener("pointerdown", (event) => {
      if (
        !event.target.closest(".port") &&
        !event.target.closest(".node-header") &&
        !event.target.closest(".node-note-editor") &&
        !event.target.closest("input") &&
        !event.target.closest("select") &&
        !event.target.closest("textarea") &&
        !event.target.closest("button")
      ) {
        event.stopPropagation();
        selectNode(node.id, event);
        selectedEdgeId = null;
      }
    });

    element.addEventListener("dblclick", (event) => {
      if (
        event.target.closest(".node-note-editor") ||
        event.target.closest("input") ||
        event.target.closest("select") ||
        event.target.closest("textarea")
      ) return;
      selectNode(node.id, null, true);
    });

    return element;
  }

  function renderNodes() {
    nodeLayer.innerHTML = "";
    const connectedPorts = buildConnectedPortSet();
    project.nodes.forEach((node) => nodeLayer.appendChild(createNodeElement(node, connectedPorts)));
  }

  function localCenter(element, ancestor) {
    let x = element.offsetLeft + element.offsetWidth / 2;
    let y = element.offsetTop + element.offsetHeight / 2;
    let current = element.offsetParent;
    while (current && current !== ancestor) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent;
    }
    return { x: x, y: y };
  }

  function getPortWorldPosition(portRef) {
    const nodeElement = nodeLayer.querySelector('[data-node-id="' + portRef.nodeId + '"]');
    if (!nodeElement) return null;
    const port = nodeElement.querySelector('.port[data-row="' + portRef.rowId + '"][data-side="' + portRef.side + '"]');
    if (!port) return null;

    const rect = port.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2 - viewportRect.left - view.x) / view.scale,
      y: (rect.top + rect.height / 2 - viewportRect.top - view.y) / view.scale
    };
  }

  function pushRoutePoint(points, point) {
    const last = points[points.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) points.push(point);
  }

  function routeLeg(a, b) {
    const points = [];
    const lead = 34;
    pushRoutePoint(points, { x: a.x, y: a.y });

    const startLead = { x: a.x + lead, y: a.y };
    const endLead = { x: b.x - lead, y: b.y };
    pushRoutePoint(points, startLead);

    if (endLead.x - startLead.x >= 54) {
      const midX = Math.round((startLead.x + endLead.x) / 2);
      pushRoutePoint(points, { x: midX, y: startLead.y });
      pushRoutePoint(points, { x: midX, y: endLead.y });
    } else {
      const detour = Math.max(startLead.x, b.x, endLead.x) + Math.max(78, Math.min(150, Math.abs(b.y - a.y) * 0.28 + 60));
      pushRoutePoint(points, { x: detour, y: startLead.y });
      pushRoutePoint(points, { x: detour, y: endLead.y });
    }

    pushRoutePoint(points, endLead);
    pushRoutePoint(points, { x: b.x, y: b.y });
    return points;
  }

  function simplifyRoute(points) {
    const cleaned = [];
    points.forEach((point) => {
      const last = cleaned[cleaned.length - 1];
      if (!last || last.x !== point.x || last.y !== point.y) cleaned.push(point);
    });

    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 1; i < cleaned.length - 1; i += 1) {
        const a = cleaned[i - 1];
        const b = cleaned[i];
        const c = cleaned[i + 1];
        if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
          cleaned.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    return cleaned;
  }

  function routePointsFor(rawPoints) {
    if (!rawPoints || rawPoints.length < 2) return [];
    const points = [];
    for (let i = 0; i < rawPoints.length - 1; i += 1) {
      const leg = routeLeg(rawPoints[i], rawPoints[i + 1]);
      leg.forEach((point, index) => {
        if (i > 0 && index === 0) return;
        pushRoutePoint(points, point);
      });
    }
    return simplifyRoute(points);
  }

  function roundedOrthogonalPath(points) {
    if (!points.length) return "";
    if (points.length === 1) return "M " + points[0].x + " " + points[0].y;

    let d = "M " + points[0].x + " " + points[0].y;
    const radiusLimit = 13;

    for (let i = 1; i < points.length - 1; i += 1) {
      const prev = points[i - 1];
      const cur = points[i];
      const next = points[i + 1];
      const lenA = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      const lenB = Math.abs(next.x - cur.x) + Math.abs(next.y - cur.y);
      const radius = Math.max(0, Math.min(radiusLimit, lenA / 2, lenB / 2));

      const before = {
        x: cur.x + (prev.x === cur.x ? 0 : (prev.x < cur.x ? -radius : radius)),
        y: cur.y + (prev.y === cur.y ? 0 : (prev.y < cur.y ? -radius : radius))
      };
      const after = {
        x: cur.x + (next.x === cur.x ? 0 : (next.x < cur.x ? -radius : radius)),
        y: cur.y + (next.y === cur.y ? 0 : (next.y < cur.y ? -radius : radius))
      };

      d += " L " + before.x + " " + before.y;
      if (radius > 0) d += " Q " + cur.x + " " + cur.y + " " + after.x + " " + after.y;
    }

    const last = points[points.length - 1];
    d += " L " + last.x + " " + last.y;
    return d;
  }

  function pathForRoute(points) {
    return roundedOrthogonalPath(routePointsFor(points));
  }

  function screenToWorld(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale
    };
  }

  function distanceToSegmentSquared(point, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = point.x - a.x;
    const wy = point.y - a.y;
    const lengthSquared = vx * vx + vy * vy;
    if (!lengthSquared) {
      const dx = point.x - a.x;
      const dy = point.y - a.y;
      return dx * dx + dy * dy;
    }
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSquared));
    const px = a.x + t * vx;
    const py = a.y + t * vy;
    const dx = point.x - px;
    const dy = point.y - py;
    return dx * dx + dy * dy;
  }

  function addJunction(edge, event, startPoint, endPoint) {
    const point = screenToWorld(event.clientX, event.clientY);
    if (!Array.isArray(edge.points)) edge.points = [];

    const route = [startPoint].concat(edge.points, [endPoint]);
    let bestSegment = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < route.length - 1; i += 1) {
      const distance = distanceToSegmentSquared(point, route[i], route[i + 1]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSegment = i;
      }
    }

    edge.points.splice(bestSegment, 0, {
      id: uid("junction"),
      x: Math.round(point.x),
      y: Math.round(point.y)
    });

    selectedEdgeId = edge.id;
    selectedNodeIds.clear();
    selectedNodeId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
    markDirty();
    showToast("Punto di snodo creato");
  }

  function startJunctionDrag(event, edgeId, pointId) {
    event.preventDefault();
    event.stopPropagation();
    junctionDrag = { edgeId: edgeId, pointId: pointId };
    selectedEdgeId = edgeId;
    selectedNodeIds.clear();
    selectedNodeId = null;
    window.addEventListener("pointermove", moveJunction);
    window.addEventListener("pointerup", endJunctionDrag, { once: true });
  }

  function moveJunction(event) {
    if (!junctionDrag) return;
    const edge = project.connections.find((item) => item.id === junctionDrag.edgeId);
    if (!edge || !Array.isArray(edge.points)) return;
    const point = edge.points.find((item) => item.id === junctionDrag.pointId);
    if (!point) return;

    const worldPoint = screenToWorld(event.clientX, event.clientY);
    point.x = Math.round(worldPoint.x / 10) * 10;
    point.y = Math.round(worldPoint.y / 10) * 10;
    renderEdges();
  }

  function endJunctionDrag() {
    window.removeEventListener("pointermove", moveJunction);
    if (junctionDrag) {
      junctionDrag = null;
      markDirty();
      renderMinimap();
    }
  }

  function removeJunction(edgeId, pointId) {
    const edge = project.connections.find((item) => item.id === edgeId);
    if (!edge || !Array.isArray(edge.points)) return;
    edge.points = edge.points.filter((point) => point.id !== pointId);
    renderEdges();
    markDirty();
    showToast("Punto di snodo rimosso");
  }

  function renderEdges() {
    edgeLayer.innerHTML = "";
    project.connections = project.connections.filter((edge) => nodeById(edge.from.nodeId) && nodeById(edge.to.nodeId));

    project.connections.forEach((edge) => {
      const a = getPortWorldPosition(edge.from);
      const b = getPortWorldPosition(edge.to);
      if (!a || !b) return;
      if (!Array.isArray(edge.points)) edge.points = [];

      const route = [a].concat(edge.points, [b]);
      const routePath = pathForRoute(route);
      const sourceNode = nodeById(edge.from.nodeId);
      const sourceMember = memberByRef(edge.from);
      const edgeType = edge.dataType || memberOutputType(sourceMember);
      const edgeColor = edgeType && edgeType !== "any"
        ? dataTypeColor(edgeType)
        : (sourceNode ? typeMeta(sourceNode.type).color : "#7c6cff");

      const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", routePath);
      glow.setAttribute("class", "edge-glow");
      edgeLayer.appendChild(glow);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", routePath);
      path.setAttribute("class", "edge" + (selectedEdgeId === edge.id ? " selected" : ""));
      path.style.stroke = edgeColor;
      path.style.opacity = selectedEdgeId === edge.id ? "1" : ".72";
      edgeLayer.appendChild(path);

      const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitPath.setAttribute("d", routePath);
      hitPath.setAttribute("class", "edge-hit");
      hitPath.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        addJunction(edge, event, a, b);
      });
      edgeLayer.appendChild(hitPath);

      edge.points.forEach((point) => {
        const junction = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        junction.setAttribute("cx", point.x);
        junction.setAttribute("cy", point.y);
        junction.setAttribute("r", selectedEdgeId === edge.id ? "6" : "5");
        junction.setAttribute("class", "edge-junction" + (selectedEdgeId === edge.id ? " selected" : ""));
        junction.style.setProperty("--junction-color", edgeColor);
        junction.addEventListener("pointerdown", (event) => startJunctionDrag(event, edge.id, point.id));
        junction.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
          removeJunction(edge.id, point.id);
        });
        edgeLayer.appendChild(junction);
      });
    });
  }

  function renderMinimap() {
    const svg = $("minimapSvg");
    svg.innerHTML = "";
    if (!project.nodes.length) return;

    const padding = 90;
    const minX = Math.min.apply(null, project.nodes.map((node) => node.x)) - padding;
    const minY = Math.min.apply(null, project.nodes.map((node) => node.y)) - padding;
    const maxX = Math.max.apply(null, project.nodes.map((node) => node.x + NODE_WIDTH)) + padding;
    const maxY = Math.max.apply(null, project.nodes.map((node) => node.y + 220)) + padding;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = Math.min(170 / width, 94 / height);
    const offsetX = (180 - width * scale) / 2;
    const offsetY = (100 - height * scale) / 2 + 2;

    project.nodes.forEach((node) => {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", offsetX + (node.x - minX) * scale);
      rect.setAttribute("y", offsetY + (node.y - minY) * scale);
      rect.setAttribute("width", Math.max(6, NODE_WIDTH * scale));
      rect.setAttribute("height", Math.max(4, 95 * scale));
      rect.setAttribute("rx", "2");
      rect.setAttribute("class", "minimap-node" + (isNodeSelected(node.id) ? " selected" : ""));
      svg.appendChild(rect);
    });

    const bounds = viewport.getBoundingClientRect();
    const worldLeft = -view.x / view.scale;
    const worldTop = -view.y / view.scale;
    const worldWidth = bounds.width / view.scale;
    const worldHeight = bounds.height / view.scale;
    const visible = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    visible.setAttribute("x", offsetX + (worldLeft - minX) * scale);
    visible.setAttribute("y", offsetY + (worldTop - minY) * scale);
    visible.setAttribute("width", worldWidth * scale);
    visible.setAttribute("height", worldHeight * scale);
    visible.setAttribute("class", "minimap-view");
    svg.appendChild(visible);
  }

  function inspectorField(labelText, control) {
    const label = document.createElement("label");
    label.className = "field-label inspector-dynamic-field";
    label.append(document.createTextNode(labelText));
    label.appendChild(control);
    return label;
  }

  function selectControl(value, options, onChange) {
    const select = document.createElement("select");
    options.forEach((optionValue) => {
      const option = document.createElement("option");
      const pair = Array.isArray(optionValue) ? optionValue : [optionValue, optionValue];
      option.value = pair[0];
      option.textContent = pair[1];
      select.appendChild(option);
    });
    if (value && !Array.from(select.options).some((option) => option.value === value)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    select.value = value || select.options[0]?.value || "";
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  function textControl(value, placeholder, onInput) {
    const input = document.createElement("input");
    input.value = value || "";
    input.placeholder = placeholder || "";
    input.addEventListener("input", () => onInput(input.value));
    return input;
  }

  function checkboxControl(checked, text, onChange) {
    const label = document.createElement("label");
    label.className = "inline-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!checked;
    checkbox.addEventListener("change", () => onChange(checkbox.checked));
    const copy = document.createElement("span");
    copy.textContent = text;
    label.append(checkbox, copy);
    return label;
  }

  function renderTypeSettings(node) {
    const container = $("nodeTypeSettings");
    container.innerHTML = "";
    ensureNodeMeta(node);

    if (node.type === "class") {
      const title = document.createElement("div");
      title.className = "dynamic-section-title";
      title.textContent = "CLASSE / UNITY";
      container.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "settings-grid";

      grid.appendChild(inspectorField("VISIBILITÀ", selectControl(node.classVisibility, [
        ["public", "public"],
        ["internal", "internal"]
      ], (value) => {
        node.classVisibility = value;
        renderNodes();
        markDirty();
      })));

      grid.appendChild(inspectorField("BASE", selectControl(node.baseType, [
        ["MonoBehaviour", "MonoBehaviour"],
        ["ScriptableObject", "ScriptableObject"],
        ["Plain C#", "Plain C# class"]
      ], (value) => {
        node.baseType = value;
        if (value === "ScriptableObject") node.instanceAccess = "scriptableObject";
        renderNodes();
        renderInspector();
        markDirty();
      })));

      grid.appendChild(inspectorField("ACCESSO / CONDIVISIONE", selectControl(node.instanceAccess, [
        ["value", "Locale / non condivisa"],
        ["inspector", "Inspector reference"],
        ["getComponent", "GetComponent"],
        ["instance", "Instance / Singleton"],
        ["findFirst", "FindFirstObjectByType"],
        ["scriptableObject", "ScriptableObject asset"]
      ], (value) => {
        node.instanceAccess = value;
        renderNodes();
        markDirty();
      })));

      const order = document.createElement("input");
      order.type = "number";
      order.value = node.executionOrder || 0;
      order.addEventListener("input", () => {
        node.executionOrder = Number(order.value) || 0;
        markDirty();
      });
      grid.appendChild(inspectorField("EXECUTION ORDER", order));

      container.appendChild(grid);

      const hint = document.createElement("div");
      hint.className = "unity-hint";
      hint.textContent = node.classVisibility === "public"
        ? "Questa classe è disponibile come tipo nelle variabili degli altri blocchi."
        : "Rendi la classe public per renderla disponibile come tipo nelle altre variabili.";
      container.appendChild(hint);
    }

    if (node.type === "function") {
      const title = document.createElement("div");
      title.className = "dynamic-section-title";
      title.textContent = "FIRMA METODO";
      container.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "settings-grid";

      const ownerOptions = [["", "— Nessuna classe —"]].concat(allClassNodes().map((item) => [item.id, item.title]));
      grid.appendChild(inspectorField("CLASSE", selectControl(node.ownerClassId, ownerOptions, (value) => {
        node.ownerClassId = value;
        renderNodes();
        markDirty();
      })));

      grid.appendChild(inspectorField("ACCESSO", selectControl(node.methodAccess, [
        ["public", "public"],
        ["private", "private"],
        ["protected", "protected"],
        ["internal", "internal"]
      ], (value) => {
        node.methodAccess = value;
        renderNodes();
        markDirty();
      })));

      grid.appendChild(inspectorField("TIPO METODO", selectControl(node.methodKind, [
        ["custom", "Custom"],
        ["lifecycle", "Unity lifecycle"],
        ["eventHandler", "Event handler"],
        ["unityEventListener", "UnityEvent listener"],
        ["coroutine", "Coroutine"]
      ], (value) => {
        node.methodKind = value;
        if (value === "lifecycle") {
          const preset = UNITY_LIFECYCLE[0];
          node.title = preset.name;
          node.returnType = preset.returnType;
          node.parameters = preset.parameters;
          $("nodeTitle").value = node.title;
        }
        renderNodes();
        renderInspector();
        markDirty();
      })));

      if (node.methodKind === "lifecycle") {
        grid.appendChild(inspectorField("UNITY CALLBACK", selectControl(node.title, UNITY_LIFECYCLE.map((item) => [item.name, item.name + "()"]), (value) => {
          const preset = UNITY_LIFECYCLE.find((item) => item.name === value);
          if (preset) {
            node.title = preset.name;
            node.returnType = preset.returnType;
            node.parameters = preset.parameters;
            $("nodeTitle").value = node.title;
            renderNodes();
            renderInspector();
            markDirty();
          }
        })));
      }

      grid.appendChild(inspectorField("RETURN TYPE", selectControl(node.returnType, ["void"].concat(availableDataTypes()), (value) => {
        node.returnType = value;
        renderNodes();
        markDirty();
      })));

      grid.appendChild(inspectorField("PARAMETRI", textControl(node.parameters, "es. int score, Player player", (value) => {
        node.parameters = value;
        renderNodes();
        markDirty();
      })));

      container.appendChild(grid);
    }
  }

  function renderMemberEditor(node, item) {
    normalizeMember(item);
    const wrapper = document.createElement("div");
    wrapper.className = "member-editor member-editor-" + item.kind;

    const head = document.createElement("div");
    head.className = "member-editor-head";
    const badge = document.createElement("span");
    badge.className = "member-kind-badge";
    badge.textContent = (ROW_META[item.kind] || ROW_META.variable).label;

    const remove = document.createElement("button");
    remove.className = "row-delete";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Rimuovi";
    remove.addEventListener("click", () => {
      node.rows = node.rows.filter((rowItem) => rowItem.id !== item.id);
      project.connections = project.connections.filter((edge) => edge.from.rowId !== item.id && edge.to.rowId !== item.id);
      render();
      renderInspector();
      markDirty();
    });
    head.append(badge, remove);
    wrapper.appendChild(head);

    if (node.type !== "class") {
      const kindSelect = selectControl(item.kind, Object.keys(ROW_META).map((key) => [key, ROW_META[key].label]), (value) => {
        item.kind = value;
        normalizeMember(item);
        renderNodes();
        renderInspector();
        markDirty();
      });
      wrapper.appendChild(inspectorField("TIPO", kindSelect));
    }

    wrapper.appendChild(inspectorField("NOME", textControl(item.label, "Nome", (value) => {
      item.label = value;
      renderNodes();
      markDirty();
    })));

    if (item.kind === "variable" || item.kind === "property") {
      const grid = document.createElement("div");
      grid.className = "settings-grid member-grid";
      grid.appendChild(inspectorField("ACCESSO", selectControl(item.access, ["public", "private", "protected", "internal"], (value) => {
        item.access = value;
        if (value === "public") item.serialized = true;
        renderNodes();
        markDirty();
      })));
      grid.appendChild(inspectorField("TIPO", selectControl(item.dataType, availableDataTypes(), (value) => {
        item.dataType = value;
        if (publicClassNodes().some((classNode) => classNode.title === value) && item.referenceMode === "value") {
          item.referenceMode = "inspector";
        }
        renderNodes();
        renderInspector();
        markDirty();
      })));
      grid.appendChild(inspectorField("RIFERIMENTO", selectControl(item.referenceMode, [
        ["value", "Valore"],
        ["inspector", "Inspector reference"],
        ["getComponent", "GetComponent"],
        ["instance", "Instance / Singleton"],
        ["findFirst", "FindFirstObjectByType"],
        ["scriptableObject", "ScriptableObject asset"]
      ], (value) => {
        item.referenceMode = value;
        renderNodes();
        markDirty();
      })));
      grid.appendChild(inspectorField("DEFAULT", textControl(item.defaultValue, "Valore iniziale", (value) => {
        item.defaultValue = value;
        markDirty();
      })));
      wrapper.appendChild(grid);
      wrapper.appendChild(checkboxControl(item.serialized, "Mostra / serializza nell'Inspector", (checked) => {
        item.serialized = checked;
        renderNodes();
        markDirty();
      }));
    } else if (item.kind === "function") {
      const grid = document.createElement("div");
      grid.className = "settings-grid member-grid";
      grid.appendChild(inspectorField("ACCESSO", selectControl(item.access, ["public", "private", "protected", "internal"], (value) => {
        item.access = value;
        renderNodes();
        markDirty();
      })));
      grid.appendChild(inspectorField("TIPO METODO", selectControl(item.methodKind, [
        ["custom", "Custom"],
        ["lifecycle", "Unity lifecycle"],
        ["eventHandler", "Event handler"],
        ["unityEventListener", "UnityEvent listener"],
        ["coroutine", "Coroutine"]
      ], (value) => {
        item.methodKind = value;
        if (value === "lifecycle") {
          const preset = UNITY_LIFECYCLE[0];
          item.label = preset.name;
          item.returnType = preset.returnType;
          item.parameters = preset.parameters;
        }
        renderNodes();
        renderInspector();
        markDirty();
      })));

      if (item.methodKind === "lifecycle") {
        grid.appendChild(inspectorField("UNITY CALLBACK", selectControl(item.label, UNITY_LIFECYCLE.map((preset) => [preset.name, preset.name + "()"]), (value) => {
          const preset = UNITY_LIFECYCLE.find((entry) => entry.name === value);
          if (preset) {
            item.label = preset.name;
            item.returnType = preset.returnType;
            item.parameters = preset.parameters;
            renderNodes();
            renderInspector();
            markDirty();
          }
        })));
      }

      grid.appendChild(inspectorField("RETURN TYPE", selectControl(item.returnType, ["void"].concat(availableDataTypes()), (value) => {
        item.returnType = value;
        renderNodes();
        markDirty();
      })));
      grid.appendChild(inspectorField("PARAMETRI", textControl(item.parameters, "es. Collider other", (value) => {
        item.parameters = value;
        renderNodes();
        markDirty();
      })));
      wrapper.appendChild(grid);
    } else if (item.kind === "unityEvent") {
      const grid = document.createElement("div");
      grid.className = "settings-grid member-grid";
      grid.appendChild(inspectorField("ACCESSO", selectControl(item.access, ["public", "private", "protected"], (value) => {
        item.access = value;
        renderNodes();
        markDirty();
      })));
      grid.appendChild(inspectorField("PAYLOAD", selectControl(item.payloadType, ["void"].concat(availableDataTypes()), (value) => {
        item.payloadType = value;
        renderNodes();
        markDirty();
      })));
      wrapper.appendChild(grid);
      wrapper.appendChild(checkboxControl(item.serialized, "Persistente / configurabile nell'Inspector", (checked) => {
        item.serialized = checked;
        renderNodes();
        markDirty();
      }));
    } else {
      wrapper.appendChild(inspectorField("VALORE / TIPO", textControl(item.value, "Tipo, valore o nota libera", (value) => {
        item.value = value;
        renderNodes();
        markDirty();
      })));
    }

    return wrapper;
  }

  function renderInspector() {
    const node = selectedNode();
    const count = selectedNodeIds.size;
    const empty = $("emptyInspector");
    const emptyTitle = empty.querySelector("h3");
    const emptyText = empty.querySelector("p");

    empty.style.display = node ? "none" : "block";
    $("inspectorContent").classList.toggle("hidden", !node);
    $("inspectorPanel").classList.toggle("open", inspectorVisible && count > 0 && window.innerWidth <= 850);

    if (!node) {
      if (count > 1) {
        emptyTitle.textContent = count + " blocchi selezionati";
        emptyText.textContent = "Trascina un blocco selezionato per muovere tutto il gruppo. Canc elimina il gruppo e Ctrl/Cmd + D lo duplica.";
      } else {
        emptyTitle.textContent = "Seleziona un blocco";
        emptyText.textContent = "Qui puoi modificarne contenuto, pseudocodice e campi senza imporre una sintassi.";
      }
      return;
    }

    ensureNodeMeta(node);
    $("inspectorTitle").textContent = node.title;
    $("nodeType").value = node.type;
    $("nodeTitle").value = node.title;
    $("nodeDescription").value = node.description;
    $("nodePseudo").value = node.pseudo;

    renderTypeSettings(node);

    const classLike = node.type === "class" || node.type === "object";
    $("addVariable").style.display = classLike ? "" : "none";
    $("addMethod").style.display = classLike ? "" : "none";
    $("addEvent").style.display = node.type === "class" ? "" : "none";
    $("addRow").style.display = classLike ? "none" : "";

    $("contentSectionLabel").textContent = node.type === "class" ? "MEMBRI DELLA CLASSE" : "CONTENUTO";
    $("contentSectionHint").textContent = node.type === "class"
      ? "Variabili, metodi e UnityEvent sono separati e collegabili."
      : node.type === "function"
        ? "Input, output o dati di supporto del metodo."
        : "Contenuto libero del blocco.";

    const list = $("rowEditorList");
    list.innerHTML = "";

    const appendGroup = (titleText, items) => {
      if (!items.length) return;
      const title = document.createElement("div");
      title.className = "member-list-title";
      title.textContent = titleText;
      list.appendChild(title);
      items.forEach((item) => list.appendChild(renderMemberEditor(node, item)));
    };

    if (node.type === "class") {
      appendGroup("VARIABLES", node.rows.filter((item) => item.kind === "variable" || item.kind === "property"));
      appendGroup("METHODS", node.rows.filter((item) => item.kind === "function"));
      appendGroup("UNITY EVENTS", node.rows.filter((item) => item.kind === "unityEvent"));
      appendGroup("OTHER", node.rows.filter((item) => !["variable", "property", "function", "unityEvent"].includes(item.kind)));
    } else {
      node.rows.forEach((item) => list.appendChild(renderMemberEditor(node, item)));
    }
  }

  function refreshCanvas() {
    renderNodes();
    renderEdges();
    renderMinimap();
    markDirty();
  }

  function render() {
    renderNodes();
    renderEdges();
    renderMinimap();
    renderInspector();
    setWorldTransform();
  }

  function selectNode(id, event, forceSingle) {
    const additive = !forceSingle && !!(event && (event.ctrlKey || event.metaKey || event.shiftKey));

    if (additive) {
      if (selectedNodeIds.has(id)) selectedNodeIds.delete(id);
      else selectedNodeIds.add(id);
    } else {
      selectedNodeIds = new Set([id]);
    }

    syncPrimarySelection();
    selectedEdgeId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function clearSelection() {
    selectedNodeIds.clear();
    selectedNodeId = null;
    selectedEdgeId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function startNodeDrag(event, node) {
    if (!selectedNodeIds.has(node.id)) {
      selectedNodeIds = new Set([node.id]);
      syncPrimarySelection();
    }

    const startPoint = screenToWorld(event.clientX, event.clientY);
    dragState = {
      pointerId: event.pointerId,
      startX: startPoint.x,
      startY: startPoint.y,
      starts: selectedNodes().map((item) => ({ id: item.id, x: item.x, y: item.y }))
    };

    window.addEventListener("pointermove", moveNode);
    window.addEventListener("pointerup", endNodeDrag, { once: true });
  }

  function moveNode(event) {
    if (!dragState) return;
    const point = screenToWorld(event.clientX, event.clientY);
    const dx = point.x - dragState.startX;
    const dy = point.y - dragState.startY;

    dragState.starts.forEach((startNode) => {
      const node = nodeById(startNode.id);
      if (!node) return;
      node.x = Math.round(startNode.x + dx);
      node.y = Math.round(startNode.y + dy);
      const el = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
      if (el) {
        el.style.left = node.x + "px";
        el.style.top = node.y + "px";
      }
    });

    renderEdges();
    renderMinimap();
  }

  function endNodeDrag() {
    window.removeEventListener("pointermove", moveNode);
    dragState = null;
    markDirty();
  }

  function handlePortClick(ref) {
    if (!pendingPort) {
      const item = memberByRef(ref);
      if (ref.side === "out" && item && item.kind === "function" && normalizedType(item.returnType) === "void") {
        showToast("Questo metodo è void: non ha un output dati.");
        return;
      }
      pendingPort = ref;
      $("connectionBanner").classList.add("show");
      renderNodes();
      return;
    }

    if (pendingPort.nodeId === ref.nodeId && pendingPort.rowId === ref.rowId && pendingPort.side === ref.side) {
      cancelConnection();
      return;
    }

    if (pendingPort.side === ref.side) {
      pendingPort = ref;
      renderNodes();
      return;
    }

    const check = connectionCheck(pendingPort, ref);
    if (!check.ok) {
      showToast(check.reason);
      renderNodes();
      return;
    }

    const duplicate = project.connections.some((edge) =>
      edge.from.nodeId === check.from.nodeId &&
      edge.from.rowId === check.from.rowId &&
      edge.to.nodeId === check.to.nodeId &&
      edge.to.rowId === check.to.rowId
    );

    if (!duplicate) {
      project.connections.push({
        id: uid("edge"),
        from: { nodeId: check.from.nodeId, rowId: check.from.rowId, side: "out" },
        to: { nodeId: check.to.nodeId, rowId: check.to.rowId, side: "in" },
        points: [],
        dataType: check.outputType
      });
      showToast(check.outputType === "any" ? "Collegamento creato" : "Collegamento " + check.outputType + " creato");
      markDirty();
    }

    pendingPort = null;
    $("connectionBanner").classList.remove("show");
    renderNodes();
    renderEdges();
    renderMinimap();
  }

  function cancelConnection() {
    pendingPort = null;
    $("connectionBanner").classList.remove("show");
    renderNodes();
  }

  function removeEdge(id) {
    project.connections = project.connections.filter((edge) => edge.id !== id);
    selectedEdgeId = null;
    renderEdges();
    markDirty();
    showToast("Collegamento rimosso");
  }

  function removeSelected() {
    if (selectedEdgeId) {
      removeEdge(selectedEdgeId);
      return;
    }
    if (!selectedNodeIds.size) return;

    const ids = new Set(selectedNodeIds);
    const count = ids.size;
    project.nodes = project.nodes.filter((item) => !ids.has(item.id));
    project.connections = project.connections.filter((edge) =>
      !ids.has(edge.from.nodeId) && !ids.has(edge.to.nodeId)
    );

    selectedNodeIds.clear();
    selectedNodeId = null;
    render();
    markDirty();
    showToast(count === 1 ? "Blocco eliminato" : count + " blocchi eliminati");
  }

  function defaultNode(type, x, y) {
    const templates = {
      object: {
        title: "New Object",
        description: "Entità o componente del sistema.",
        rows: [variableRow("id", "int", "public"), variableRow("state", "bool", "private")],
        pseudo: ""
      },
      class: {
        title: "NewClass",
        description: "Responsabilità, stato, metodi ed eventi della classe.",
        rows: [
          variableRow("value", "int", "private"),
          methodRow("Start", "void", "lifecycle")
        ],
        pseudo: "",
        extra: {
          classVisibility: "public",
          baseType: "MonoBehaviour",
          instanceAccess: "inspector",
          executionOrder: 0
        }
      },
      function: {
        title: "NewMethod",
        description: "Metodo concettuale con firma C#/Unity.",
        rows: [row("input", "value", "input"), row("result", "value", "output")],
        pseudo: "return result",
        extra: {
          ownerClassId: "",
          methodAccess: "public",
          methodKind: "custom",
          returnType: "void",
          parameters: ""
        }
      },
      variable: {
        title: "Variable",
        description: "Dato, configurazione o riferimento condiviso.",
        rows: [variableRow("value", "int", "private")],
        pseudo: ""
      },
      condition: {
        title: "Condition",
        description: "Confronto o scelta nel flow.",
        rows: [row("A", "input", "input"), row("B", "input", "input"), row("result", "bool", "output")],
        pseudo: "A == B"
      },
      ui: {
        title: "UI Element",
        description: "Elemento di interfaccia collegato allo stato del gioco.",
        rows: [row("text", "string", "property"), row("visible", "bool", "property")],
        pseudo: ""
      },
      note: {
        title: "Note",
        description: "",
        rows: [],
        pseudo: ""
      }
    };

    const source = templates[type] || templates.object;
    const node = {
      id: uid("node"),
      type: type,
      title: source.title,
      description: source.description,
      pseudo: source.pseudo,
      rows: source.rows,
      x: Math.round(x),
      y: Math.round(y)
    };
    Object.assign(node, source.extra || {});
    ensureNodeMeta(node);
    return node;
  }

  function viewportCenterWorld() {
    const rect = viewport.getBoundingClientRect();
    return {
      x: (-view.x + rect.width / 2) / view.scale,
      y: (-view.y + rect.height / 2) / view.scale
    };
  }

  function addNode(type) {
    const center = viewportCenterWorld();
    const offset = project.nodes.length % 5 * 18;
    const node = defaultNode(type, center.x - NODE_WIDTH / 2 + offset, center.y - 100 + offset);
    project.nodes.push(node);
    selectedNodeIds = new Set([node.id]);
    syncPrimarySelection();
    selectedEdgeId = null;
    render();
    markDirty();
    showToast(TYPE_META[type].label + " aggiunto");
    setTimeout(() => {
      const element = nodeLayer.querySelector('[data-node-id="' + node.id + '"] .node-title-inline');
      if (element) {
        element.focus();
        element.select();
      }
    }, 20);
  }

  function duplicateSelected() {
    const sources = selectedNodes();
    if (!sources.length) return;

    const newIds = [];
    sources.forEach((source) => {
      const copy = JSON.parse(JSON.stringify(source));
      copy.id = uid("node");
      copy.x += 38;
      copy.y += 38;
      copy.title += " Copy";
      copy.rows.forEach((item) => {
        item.id = uid("row");
      });
      project.nodes.push(copy);
      newIds.push(copy.id);
    });

    selectedNodeIds = new Set(newIds);
    syncPrimarySelection();
    selectedEdgeId = null;
    render();
    markDirty();
    showToast(newIds.length === 1 ? "Blocco duplicato" : newIds.length + " blocchi duplicati");
  }

  function fitView() {
    if (!project.nodes.length) {
      view = { x: 70, y: 60, scale: 1 };
      setWorldTransform();
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const minX = Math.min.apply(null, project.nodes.map((node) => node.x));
    const minY = Math.min.apply(null, project.nodes.map((node) => node.y));
    const maxX = Math.max.apply(null, project.nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max.apply(null, project.nodes.map((node) => node.y + 260));
    const width = Math.max(400, maxX - minX);
    const height = Math.max(300, maxY - minY);
    const scale = Math.max(0.35, Math.min(1.05, Math.min((rect.width - 150) / width, (rect.height - 150) / height)));
    view.scale = snapScale(scale);
    view.x = Math.round(rect.width / 2 - ((minX + maxX) / 2) * view.scale);
    view.y = Math.round(rect.height / 2 - ((minY + maxY) / 2) * view.scale);
    setWorldTransform();
  }

  function setZoom(nextScale, clientX, clientY) {
    const newScale = snapScale(Math.max(0.3, Math.min(1.65, nextScale)));
    const rect = viewport.getBoundingClientRect();
    const x = typeof clientX === "number" ? clientX - rect.left : rect.width / 2;
    const y = typeof clientY === "number" ? clientY - rect.top : rect.height / 2;
    const worldX = (x - view.x) / view.scale;
    const worldY = (y - view.y) / view.scale;
    view.x = x - worldX * newScale;
    view.y = y - worldY * newScale;
    view.scale = newScale;
    setWorldTransform();
  }

  function exportProject() {
    saveProject(false);
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (project.name || "projectflow").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    link.href = url;
    link.download = safeName + ".projectflow.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Flow esportato");
  }

  function importProjectFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = normalizeProject(JSON.parse(reader.result));
        project = imported;
        selectedNodeIds.clear();
        selectedNodeId = null;
        selectedEdgeId = null;
        pendingPort = null;
        $("projectName").value = project.name;
        saveProject(false);
        render();
        fitView();
        showToast("Flow importato");
      } catch (error) {
        showToast("JSON non valido");
      }
    };
    reader.readAsText(file);
  }

  $("nodeType").addEventListener("change", () => {
    const node = selectedNode();
    if (!node) return;
    node.type = $("nodeType").value;
    ensureNodeMeta(node);
    $("inspectorTitle").textContent = node.title;
    render();
    renderInspector();
    markDirty();
  });

  $("nodeTitle").addEventListener("input", () => {
    const node = selectedNode();
    if (!node) return;
    node.title = $("nodeTitle").value;
    $("inspectorTitle").textContent = node.title || "Blocco";
    refreshCanvas();
  });
  $("nodeTitle").addEventListener("blur", () => {
    const node = selectedNode();
    if (!node) return;
    renderNodes();
    renderInspector();
  });

  $("nodeDescription").addEventListener("input", () => {
    const node = selectedNode();
    if (!node) return;
    node.description = $("nodeDescription").value;
    refreshCanvas();
  });

  $("nodePseudo").addEventListener("input", () => {
    const node = selectedNode();
    if (!node) return;
    node.pseudo = $("nodePseudo").value;
    refreshCanvas();
  });

  $("addVariable").addEventListener("click", () => {
    const node = selectedNode();
    if (!node) return;
    node.rows.push(variableRow("newVariable", "int", "private"));
    render();
    renderInspector();
    markDirty();
  });

  $("addMethod").addEventListener("click", () => {
    const node = selectedNode();
    if (!node) return;
    node.rows.push(methodRow("NewMethod", "void", "custom"));
    render();
    renderInspector();
    markDirty();
  });

  $("addEvent").addEventListener("click", () => {
    const node = selectedNode();
    if (!node) return;
    node.rows.push(eventRow("OnEvent", "void"));
    render();
    renderInspector();
    markDirty();
  });

  $("addRow").addEventListener("click", () => {
    const node = selectedNode();
    if (!node) return;
    node.rows.push(row("newValue", "type / value", "text"));
    render();
    renderInspector();
    markDirty();
  });

  $("duplicateNode").addEventListener("click", duplicateSelected);
  $("deleteNode").addEventListener("click", removeSelected);
  $("closeInspector").addEventListener("click", () => setInspectorVisible(false));
  $("cancelConnection").addEventListener("click", cancelConnection);

  document.querySelectorAll(".block-template").forEach((button) => {
    button.addEventListener("click", () => addNode(button.dataset.template));
  });

  $("addObjectTop").addEventListener("click", () => addNode("object"));
  $("fitView").addEventListener("click", fitView);
  $("saveProject").addEventListener("click", () => saveProject(true));
  $("zoomIn").addEventListener("click", () => setZoom(view.scale + 0.1));
  $("zoomOut").addEventListener("click", () => setZoom(view.scale - 0.1));
  $("zoomReadout").addEventListener("click", () => setZoom(1));

  $("connectTool").addEventListener("click", () => {
    connectMode = !connectMode;
    $("connectTool").classList.toggle("active", connectMode);
    $("selectTool").classList.toggle("active", !connectMode);
    showToast(connectMode ? "Modalità collegamento attiva" : "Modalità selezione attiva");
  });

  $("selectTool").addEventListener("click", () => {
    connectMode = false;
    $("connectTool").classList.remove("active");
    $("selectTool").classList.add("active");
    cancelConnection();
  });

  $("dataMenuButton").addEventListener("click", (event) => {
    event.stopPropagation();
    $("dataMenu").classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".toolbar-menu")) $("dataMenu").classList.remove("open");
  });

  $("exportProject").addEventListener("click", () => {
    $("dataMenu").classList.remove("open");
    exportProject();
  });

  $("importProject").addEventListener("click", () => {
    $("dataMenu").classList.remove("open");
    $("importFile").click();
  });

  $("importFile").addEventListener("change", (event) => {
    importProjectFile(event.target.files[0]);
    event.target.value = "";
  });

  $("resetProject").addEventListener("click", () => {
    $("dataMenu").classList.remove("open");
    if (!confirm("Ripristinare il flow di esempio? Il progetto locale corrente verrà sostituito.")) return;
    project = sampleProject();
    $("projectName").value = project.name;
    selectedNodeIds.clear();
    selectedNodeId = null;
    selectedEdgeId = null;
    pendingPort = null;
    saveProject(false);
    render();
    fitView();
    showToast("Esempio ripristinato");
  });

  $("projectName").addEventListener("input", () => {
    project.name = $("projectName").value;
    markDirty();
  });

  $("blockSearch").addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase().trim();
    document.querySelectorAll(".block-template").forEach((button) => {
      button.style.display = !query || button.textContent.toLowerCase().includes(query) ? "" : "none";
    });
  });

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    setZoom(view.scale * factor, event.clientX, event.clientY);
  }, { passive: false });

  function startMarquee(event) {
    const rect = viewport.getBoundingClientRect();
    marqueeState = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      additive: event.ctrlKey || event.metaKey || event.shiftKey,
      moved: false
    };

    const box = document.createElement("div");
    box.className = "selection-marquee";
    box.id = "selectionMarquee";
    box.style.left = (event.clientX - rect.left) + "px";
    box.style.top = (event.clientY - rect.top) + "px";
    viewport.appendChild(box);

    window.addEventListener("pointermove", moveMarquee);
    window.addEventListener("pointerup", endMarquee, { once: true });
  }

  function moveMarquee(event) {
    if (!marqueeState) return;
    const rect = viewport.getBoundingClientRect();
    const left = Math.min(marqueeState.startClientX, event.clientX) - rect.left;
    const top = Math.min(marqueeState.startClientY, event.clientY) - rect.top;
    const width = Math.abs(event.clientX - marqueeState.startClientX);
    const height = Math.abs(event.clientY - marqueeState.startClientY);
    marqueeState.moved = width > 4 || height > 4;

    const box = $("selectionMarquee");
    if (!box) return;
    box.style.left = left + "px";
    box.style.top = top + "px";
    box.style.width = width + "px";
    box.style.height = height + "px";
  }

  function endMarquee(event) {
    window.removeEventListener("pointermove", moveMarquee);
    const state = marqueeState;
    marqueeState = null;

    const box = $("selectionMarquee");
    if (box) box.remove();
    if (!state) return;

    if (!state.moved) {
      if (!state.additive) clearSelection();
      return;
    }

    const a = screenToWorld(state.startClientX, state.startClientY);
    const b = screenToWorld(event.clientX, event.clientY);
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const right = Math.max(a.x, b.x);
    const bottom = Math.max(a.y, b.y);
    const next = state.additive ? new Set(selectedNodeIds) : new Set();

    project.nodes.forEach((node) => {
      const el = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
      const width = el ? el.offsetWidth : NODE_WIDTH;
      const height = el ? el.offsetHeight : 160;
      if (node.x < right && node.x + width > left && node.y < bottom && node.y + height > top) {
        next.add(node.id);
      }
    });

    selectedNodeIds = next;
    syncPrimarySelection();
    selectedEdgeId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function startPanelResize(side, event) {
    if (window.innerWidth <= 850) return;
    event.preventDefault();
    event.stopPropagation();
    panelResizeState = {
      side: side,
      startX: event.clientX,
      startWidth: side === "library" ? panelWidths.library : panelWidths.inspector
    };
    document.body.classList.add("resizing-panel");
    window.addEventListener("pointermove", movePanelResize);
    window.addEventListener("pointerup", endPanelResize, { once: true });
  }

  function movePanelResize(event) {
    if (!panelResizeState) return;
    const delta = event.clientX - panelResizeState.startX;
    if (panelResizeState.side === "library") {
      panelWidths.library = Math.max(180, Math.min(420, panelResizeState.startWidth + delta));
    } else {
      panelWidths.inspector = Math.max(240, Math.min(520, panelResizeState.startWidth - delta));
    }
    setPanelWidths();
  }

  function endPanelResize() {
    window.removeEventListener("pointermove", movePanelResize);
    panelResizeState = null;
    document.body.classList.remove("resizing-panel");
    setPanelWidths();
  }

  $("libraryResizer").addEventListener("pointerdown", (event) => startPanelResize("library", event));
  $("inspectorResizer").addEventListener("pointerdown", (event) => startPanelResize("inspector", event));

  viewport.addEventListener("pointerdown", (event) => {
    if (event.target !== viewport && event.target !== world && event.target !== nodeLayer && event.target !== edgeLayer) return;

    if (event.altKey || event.button === 1) {
      event.preventDefault();
      panState = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
      viewport.classList.add("panning");
      window.addEventListener("pointermove", movePan);
      window.addEventListener("pointerup", endPan, { once: true });
      return;
    }

    if (event.button === 0) {
      event.preventDefault();
      if (pendingPort) cancelConnection();
      startMarquee(event);
    }
  });

  function movePan(event) {
    if (!panState) return;
    view.x = panState.viewX + event.clientX - panState.x;
    view.y = panState.viewY + event.clientY - panState.y;
    setWorldTransform();
  }

  function endPan() {
    panState = null;
    viewport.classList.remove("panning");
    window.removeEventListener("pointermove", movePan);
  }

  window.addEventListener("keydown", (event) => {
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    if (event.key === "Escape") {
      cancelConnection();
      clearSelection();
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && !typing) {
      event.preventDefault();
      removeSelected();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && !typing) {
      event.preventDefault();
      selectedNodeIds = new Set(project.nodes.map((node) => node.id));
      syncPrimarySelection();
      selectedEdgeId = null;
      renderNodes();
      renderEdges();
      renderInspector();
      renderMinimap();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveProject(true);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && !typing) {
      event.preventDefault();
      duplicateSelected();
      return;
    }

    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    const shortcuts = { o: "object", c: "class", f: "function", v: "variable", d: "condition", u: "ui", n: "note" };
    const type = shortcuts[event.key.toLowerCase()];
    if (type) addNode(type);
  });

  $("toggleLibrary").addEventListener("click", () => $("libraryPanel").classList.add("open"));
  $("closeLibrary").addEventListener("click", () => $("libraryPanel").classList.remove("open"));

  window.addEventListener("resize", () => {
    renderEdges();
    renderMinimap();
  });

  window.addEventListener("beforeunload", () => saveProject(false));

  setInspectorVisible(false);
  render();
  if (!localStorage.getItem(VIEW_KEY)) {
    setTimeout(fitView, 30);
  }
})();