(() => {
  "use strict";

  const STORAGE_KEY = "projectflow.project.v1";
  const VIEW_KEY = "projectflow.view.v1";
  const NODE_WIDTH = 284;

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
    function: { icon: "ƒ", label: "Funzione" },
    property: { icon: "•", label: "Proprietà" },
    condition: { icon: "?", label: "Condizione" },
    input: { icon: "→", label: "Input" },
    output: { icon: "←", label: "Output" },
    text: { icon: "T", label: "Testo" }
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

  function row(label, value, kind) {
    return { id: uid("row"), label: label || "value", value: value || "", kind: kind || "variable" };
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
      node.rows.forEach((item) => {
        if (!item.id) item.id = uid("row");
        if (!ROW_META[item.kind]) item.kind = "variable";
        if (typeof item.label !== "string") item.label = "value";
        if (typeof item.value !== "string") item.value = "";
      });
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
  let selectedEdgeId = null;
  let pendingPort = null;
  let dragState = null;
  let junctionDrag = null;
  let panState = null;
  let saveTimer = null;
  let toastTimer = null;
  let connectMode = false;

  $("projectName").value = project.name;

  function nodeById(id) {
    return project.nodes.find((node) => node.id === id) || null;
  }

  function selectedNode() {
    return nodeById(selectedNodeId);
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
    }
    port.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlePortClick({ nodeId: nodeId, rowId: rowId, side: side });
    });
    return port;
  }

  function createNodeElement(node, connectedPorts) {
    const meta = typeMeta(node.type);
    const element = document.createElement("article");
    element.className = "flow-node type-" + node.type;
    if (node.id === selectedNodeId) element.classList.add("selected");
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
    heading.className = "node-heading";
    const title = document.createElement("strong");
    title.textContent = node.title;
    const label = document.createElement("small");
    label.textContent = meta.label;
    heading.append(title, label);

    const more = document.createElement("button");
    more.className = "node-more";
    more.type = "button";
    more.textContent = "•••";
    more.title = "Seleziona e modifica";
    more.addEventListener("pointerdown", (event) => event.stopPropagation());
    more.addEventListener("click", () => selectNode(node.id));

    header.append(typeDot, heading, more, makePort(node.id, "__node__", "out", connectedPorts));

    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".port") || event.target.closest("button")) return;
      event.preventDefault();
      selectNode(node.id);
      startNodeDrag(event, node);
    });

    const body = document.createElement("div");
    body.className = "node-body";

    if (node.description) {
      const desc = document.createElement("div");
      desc.className = "node-description";
      desc.textContent = node.description;
      body.appendChild(desc);
    }

    node.rows.forEach((item) => {
      const itemMeta = ROW_META[item.kind] || ROW_META.variable;
      const rowElement = document.createElement("div");
      rowElement.className = "node-row";
      rowElement.dataset.rowId = item.id;

      const kind = document.createElement("span");
      kind.className = "row-kind";
      kind.textContent = itemMeta.icon;

      const copy = document.createElement("div");
      copy.className = "row-copy";
      const rowTitle = document.createElement("strong");
      rowTitle.textContent = item.label;
      const rowValue = document.createElement("small");
      rowValue.textContent = item.value;
      copy.append(rowTitle, rowValue);

      rowElement.append(
        makePort(node.id, item.id, "in", connectedPorts),
        kind,
        copy,
        makePort(node.id, item.id, "out", connectedPorts)
      );
      body.appendChild(rowElement);
    });

    if (node.pseudo) {
      const pseudo = document.createElement("pre");
      pseudo.className = "node-pseudo";
      pseudo.textContent = node.pseudo;
      body.appendChild(pseudo);
    }

    element.append(header, body);

    element.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".port")) {
        selectNode(node.id);
        selectedEdgeId = null;
      }
    });

    element.addEventListener("dblclick", () => {
      selectNode(node.id);
      $("nodeTitle").focus();
      $("nodeTitle").select();
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
    const local = localCenter(port, nodeElement);
    const node = nodeById(portRef.nodeId);
    return { x: node.x + local.x, y: node.y + local.y };
  }

  function curveCommand(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const curve = Math.max(55, Math.min(180, Math.abs(dx) * 0.45 + Math.abs(dy) * 0.08));
    const direction = dx >= 0 ? 1 : -1;
    return " C " +
      (a.x + curve * direction) + " " + a.y + ", " +
      (b.x - curve * direction) + " " + b.y + ", " +
      b.x + " " + b.y;
  }

  function pathForRoute(points) {
    if (!points || points.length < 2) return "";
    let d = "M " + points[0].x + " " + points[0].y;
    for (let i = 0; i < points.length - 1; i += 1) {
      d += curveCommand(points[i], points[i + 1]);
    }
    return d;
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
    point.x = Math.round(worldPoint.x);
    point.y = Math.round(worldPoint.y);
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
      const edgeColor = sourceNode ? typeMeta(sourceNode.type).color : "#7c6cff";

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
      rect.setAttribute("class", "minimap-node" + (node.id === selectedNodeId ? " selected" : ""));
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

  function renderInspector() {
    const node = selectedNode();
    $("emptyInspector").style.display = node ? "none" : "block";
    $("inspectorContent").classList.toggle("hidden", !node);
    $("inspectorPanel").classList.toggle("open", !!node && window.innerWidth <= 850);
    if (!node) return;

    $("inspectorTitle").textContent = node.title;
    $("nodeType").value = node.type;
    $("nodeTitle").value = node.title;
    $("nodeDescription").value = node.description;
    $("nodePseudo").value = node.pseudo;

    const list = $("rowEditorList");
    list.innerHTML = "";
    node.rows.forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "row-edit";

      const select = document.createElement("select");
      Object.keys(ROW_META).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = ROW_META[key].label;
        select.appendChild(option);
      });
      select.value = item.kind;
      select.addEventListener("change", () => {
        item.kind = select.value;
        refreshCanvas();
      });

      const name = document.createElement("input");
      name.value = item.label;
      name.placeholder = "Nome";
      name.addEventListener("input", () => {
        item.label = name.value;
        refreshCanvas();
      });

      const remove = document.createElement("button");
      remove.className = "row-delete";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Rimuovi riga";
      remove.addEventListener("click", () => {
        node.rows = node.rows.filter((rowItem) => rowItem.id !== item.id);
        project.connections = project.connections.filter((edge) => edge.from.rowId !== item.id && edge.to.rowId !== item.id);
        render();
        renderInspector();
        markDirty();
      });

      const value = document.createElement("input");
      value.className = "row-value";
      value.value = item.value;
      value.placeholder = "Tipo, valore o nota libera";
      value.addEventListener("input", () => {
        item.value = value.value;
        refreshCanvas();
      });

      wrapper.append(select, name, remove, value);
      list.appendChild(wrapper);
    });
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

  function selectNode(id) {
    if (selectedNodeId === id) return;
    selectedNodeId = id;
    selectedEdgeId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function clearSelection() {
    selectedNodeId = null;
    selectedEdgeId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function startNodeDrag(event, node) {
    const rect = viewport.getBoundingClientRect();
    const worldX = (event.clientX - rect.left - view.x) / view.scale;
    const worldY = (event.clientY - rect.top - view.y) / view.scale;
    dragState = {
      nodeId: node.id,
      offsetX: worldX - node.x,
      offsetY: worldY - node.y,
      pointerId: event.pointerId
    };
    window.addEventListener("pointermove", moveNode);
    window.addEventListener("pointerup", endNodeDrag, { once: true });
  }

  function moveNode(event) {
    if (!dragState) return;
    const node = nodeById(dragState.nodeId);
    if (!node) return;
    const rect = viewport.getBoundingClientRect();
    const worldX = (event.clientX - rect.left - view.x) / view.scale;
    const worldY = (event.clientY - rect.top - view.y) / view.scale;
    node.x = Math.round(worldX - dragState.offsetX);
    node.y = Math.round(worldY - dragState.offsetY);
    const el = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
    if (el) {
      el.style.left = node.x + "px";
      el.style.top = node.y + "px";
    }
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

    let from = pendingPort;
    let to = ref;
    if (from.side === "in") {
      const temp = from;
      from = to;
      to = temp;
    }

    const duplicate = project.connections.some((edge) =>
      edge.from.nodeId === from.nodeId &&
      edge.from.rowId === from.rowId &&
      edge.to.nodeId === to.nodeId &&
      edge.to.rowId === to.rowId
    );

    if (!duplicate) {
      project.connections.push({
        id: uid("edge"),
        from: { nodeId: from.nodeId, rowId: from.rowId, side: "out" },
        to: { nodeId: to.nodeId, rowId: to.rowId, side: "in" },
        points: []
      });
      showToast("Collegamento creato");
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
    if (!selectedNodeId) return;
    const node = nodeById(selectedNodeId);
    if (!node) return;
    project.nodes = project.nodes.filter((item) => item.id !== selectedNodeId);
    project.connections = project.connections.filter((edge) => edge.from.nodeId !== selectedNodeId && edge.to.nodeId !== selectedNodeId);
    selectedNodeId = null;
    render();
    markDirty();
    showToast("Blocco eliminato");
  }

  function defaultNode(type, x, y) {
    const templates = {
      object: {
        title: "New Object",
        description: "Entità o componente del sistema.",
        rows: [row("id", "int", "variable"), row("state", "value", "property")],
        pseudo: ""
      },
      class: {
        title: "New Class",
        description: "Responsabilità, proprietà e funzioni principali.",
        rows: [row("property", "type", "property"), row("Method()", "returns value", "function")],
        pseudo: ""
      },
      function: {
        title: "New Function",
        description: "Trasforma degli input in un risultato.",
        rows: [row("input", "value", "input"), row("result", "value", "output")],
        pseudo: "result = input\nreturn result"
      },
      variable: {
        title: "Variable",
        description: "Dato, configurazione o stato condiviso.",
        rows: [row("value", "type", "variable")],
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
        description: "Scrivi una regola, un vincolo, un'idea o un TODO.",
        rows: [],
        pseudo: ""
      }
    };

    const source = templates[type] || templates.object;
    return {
      id: uid("node"),
      type: type,
      title: source.title,
      description: source.description,
      pseudo: source.pseudo,
      rows: source.rows,
      x: Math.round(x),
      y: Math.round(y)
    };
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
    selectedNodeId = node.id;
    selectedEdgeId = null;
    render();
    markDirty();
    showToast(TYPE_META[type].label + " aggiunto");
    setTimeout(() => {
      if ($("nodeTitle")) {
        $("nodeTitle").focus();
        $("nodeTitle").select();
      }
    }, 20);
  }

  function duplicateSelected() {
    const source = selectedNode();
    if (!source) return;
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = uid("node");
    copy.x += 38;
    copy.y += 38;
    copy.title += " Copy";
    const rowMap = {};
    copy.rows.forEach((item) => {
      const oldId = item.id;
      item.id = uid("row");
      rowMap[oldId] = item.id;
    });
    project.nodes.push(copy);
    selectedNodeId = copy.id;
    render();
    markDirty();
    showToast("Blocco duplicato");
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
    $("inspectorTitle").textContent = node.title;
    refreshCanvas();
  });

  $("nodeTitle").addEventListener("input", () => {
    const node = selectedNode();
    if (!node) return;
    node.title = $("nodeTitle").value;
    $("inspectorTitle").textContent = node.title || "Blocco";
    refreshCanvas();
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

  $("addRow").addEventListener("click", () => {
    const node = selectedNode();
    if (!node) return;
    node.rows.push(row("newValue", "type / value", "variable"));
    render();
    renderInspector();
    markDirty();
  });

  $("duplicateNode").addEventListener("click", duplicateSelected);
  $("deleteNode").addEventListener("click", removeSelected);
  $("closeInspector").addEventListener("click", clearSelection);
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

    if (event.button === 0 && event.target !== edgeLayer) {
      clearSelection();
      if (pendingPort) cancelConnection();
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

  render();
  if (!localStorage.getItem(VIEW_KEY)) {
    setTimeout(fitView, 30);
  }
})();