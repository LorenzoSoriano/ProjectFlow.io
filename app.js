(() => {
  "use strict";

  const STORAGE_KEY = "projectflow.project.v1";
  const VIEW_KEY = "projectflow.view.v1";
  const PANELS_KEY = "projectflow.panels.v1";
  const LIBRARY_KEY = "projectflow.library.v1";
  const PROJECT_LIBRARY_KEY = "projectflow.projects.v1";
  const ACTIVE_PROJECT_KEY = "projectflow.active-project.v1";
  const CLOUD_OPT_IN_KEY = "projectflow.cloud-opt-in.v1";
  const FIREBASE_SDK_VERSION = "12.19.0";
  const MINIMAP_SIZE_KEY = "projectflow.minimap-size.v1";
  const FORCE_CONNECTIONS_KEY = "projectflow.force-connections.v1";
  const NODE_WIDTH = 440;
  let rootProject = null;
  let project = null;

  function nodeWidthFor(nodeOrType) {
    const node = typeof nodeOrType === "object" && nodeOrType ? nodeOrType : null;
    const type = typeof nodeOrType === "string" ? nodeOrType : (node && node.type) || "object";
    if (type === "object" || type === "class") return 500;
    if (type === "function") return 470;
    if (type === "emptyGraph") return 450;
    if (type === "graphInput" || type === "graphOutput") return 360;
    if (type === "enum") return 440;
    if (type === "component") return 430;
    if (["event", "action", "condition", "state", "switch", "ifElse", "whileLoop", "doWhileLoop", "forLoop", "foreachLoop"].includes(type)) return 430;
    if (["adapter", "math", "logic", "compare"].includes(type)) return 440;
    if (type === "note") return 390;
    if (type === "sketch") {
      return node && typeof node.sketchWidth === "number"
        ? Math.max(360, Math.min(2400, node.sketchWidth))
        : 520;
    }
    return 430;
  }

  function memberScrollLimit(node, sectionTitle) {
    if (sectionTitle === "METHODS") return 520;
    if (sectionTitle === "VARIABLES" || sectionTitle === "DATA") return 470;
    if (sectionTitle === "COMPONENTS") return 490;
    if (sectionTitle === "UNITY EVENTS") return 420;
    return 430;
  }

  const $ = (id) => document.getElementById(id);
  const nodeLayer = $("nodeLayer");
  const edgeLayer = $("edgeLayer");
  const groupLayer = $("groupLayer");
  const collaborationLayer = $("collaborationLayer");
  const viewport = $("canvasViewport");
  const world = $("world");

  const TYPE_META = {
    object: { label: "GameObject", icon: "◇", color: "#5b9bc4" },
    component: { label: "Componente Unity", icon: "⬡", color: "#6f91ad" },
    class: { label: "Classe", icon: "C", color: "#4faab7" },
    struct: { label: "Struct", icon: "{}", color: "#63a59a" },
    jobStruct: { label: "Unity Job Struct", icon: "J", color: "#d29a58" },
    function: { label: "Funzione", icon: "ƒ", color: "#6fb47b" },
    emptyGraph: { label: "Empty", icon: "□", color: "#7189a8" },
    graphInput: { label: "Graph Input", icon: "→", color: "#55a9b7" },
    graphOutput: { label: "Graph Output", icon: "←", color: "#b57bab" },
    enum: { label: "Enum", icon: "E", color: "#9c7fb5" },
    switch: { label: "Switch", icon: "⇆", color: "#8f7fb2" },
    ifElse: { label: "If / Else", icon: "if", color: "#c88455" },
    whileLoop: { label: "While", icon: "↻", color: "#6f91ad" },
    doWhileLoop: { label: "Do While", icon: "⟳", color: "#6f91ad" },
    forLoop: { label: "For", icon: "i", color: "#6fb47b" },
    foreachLoop: { label: "Foreach", icon: "∀", color: "#6fb47b" },
    breakFlow: { label: "Break", icon: "■", color: "#b87a63" },
    continueFlow: { label: "Continue", icon: "↪", color: "#7e9fb7" },
    returnFlow: { label: "Return", icon: "↩", color: "#8a78b5" },
    flowStart: { label: "Start", icon: "▶", color: "#66b985" },
    flowEnd: { label: "End", icon: "■", color: "#b87a63" },
    flowIO: { label: "Input / Output", icon: "⇄", color: "#55a9b7" },
    flowProcess: { label: "Process", icon: "▭", color: "#70b77c" },
    adapter: { label: "Adapter", icon: "↔", color: "#55a9b7" },
    math: { label: "Math", icon: "±", color: "#6fb47b" },
    logic: { label: "Logic", icon: "∧", color: "#c88455" },
    compare: { label: "Compare", icon: "≶", color: "#c88455" },
    event: { label: "Evento", icon: "⚡", color: "#c9ad58" },
    action: { label: "Azione", icon: "▶", color: "#70b77c" },
    state: { label: "Stato", icon: "S", color: "#5f93ba" },
    variable: { label: "Variabile", icon: "x", color: "#c9ad58" },
    constant: { label: "Valore", icon: "•", color: "#d1a85a" },
    condition: { label: "Condizione", icon: "?", color: "#c88455" },
    ui: { label: "Interfaccia", icon: "▣", color: "#b57bab" },
    note: { label: "Nota", icon: "≡", color: "#98a6c2" },
    sketch: { label: "Sketch", icon: "✎", color: "#8aa7c2" }
  };

  const LEGACY_BLOCK_TYPES = new Set(["condition", "state", "ui"]);

  const ROW_META = {
    variable: { icon: "x", label: "Variabile" },
    function: { icon: "ƒ", label: "Metodo" },
    unityEvent: { icon: "⚡", label: "UnityEvent" },
    component: { icon: "⬡", label: "Componente" },
    property: { icon: "•", label: "Proprietà" },
    condition: { icon: "?", label: "Condizione" },
    flowIn: { icon: "▷", label: "Flow In" },
    flowOut: { icon: "▶", label: "Flow Out" },
    input: { icon: "→", label: "Input" },
    output: { icon: "←", label: "Output" },
    text: { icon: "T", label: "Testo" }
  };

  const DATA_TYPES = [
    "bool", "int", "float", "double", "string",
    "Vector2", "Vector3", "Quaternion", "Color",
    "GameObject", "Transform", "Rigidbody", "Rigidbody2D", "CharacterController", "Collider", "Collider2D",
    "BoxCollider", "SphereCollider", "CapsuleCollider", "MeshCollider", "BoxCollider2D", "CircleCollider2D", "CapsuleCollider2D",
    "NavMeshAgent", "NavMeshObstacle", "OffMeshLink",
    "Animator", "Animation", "PlayableDirector", "AudioSource", "AudioListener", "AudioReverbZone", "AudioClip",
    "Camera", "Light", "SpriteRenderer", "MeshRenderer", "SkinnedMeshRenderer",
    "ParticleSystem", "TrailRenderer", "LineRenderer", "Canvas", "CanvasGroup", "GraphicRaycaster",
    "Texture2D", "Material", "AnimationClip", "RuntimeAnimatorController",
    "LayerMask", "RectTransform"
  ];

  const UNITY_COMPONENT_CATEGORIES = [
    {
      id: "core",
      label: "CORE",
      components: ["Transform"]
    },
    {
      id: "physics",
      label: "PHYSICS",
      components: ["Rigidbody", "Rigidbody2D", "CharacterController", "BoxCollider", "SphereCollider", "CapsuleCollider", "MeshCollider", "Collider2D", "BoxCollider2D", "CircleCollider2D", "CapsuleCollider2D"]
    },
    {
      id: "animation",
      label: "ANIMATION",
      components: ["Animator", "Animation", "PlayableDirector"]
    },
    {
      id: "audio",
      label: "AUDIO",
      components: ["AudioSource", "AudioListener", "AudioReverbZone"]
    },
    {
      id: "rendering",
      label: "RENDERING",
      components: ["Camera", "Light", "MeshRenderer", "SkinnedMeshRenderer", "SpriteRenderer", "LineRenderer", "TrailRenderer"]
    },
    {
      id: "ui",
      label: "UI",
      components: ["Canvas", "CanvasGroup", "RectTransform", "GraphicRaycaster"]
    },
    {
      id: "effects",
      label: "EFFECTS",
      components: ["ParticleSystem"]
    },
    {
      id: "navigation",
      label: "NAVIGATION",
      components: ["NavMeshAgent", "NavMeshObstacle", "OffMeshLink"]
    }
  ];

  function componentCategoryFor(type) {
    const group = UNITY_COMPONENT_CATEGORIES.find((category) => category.components.includes(type));
    return group ? group.id : "other";
  }

  function componentCategoryLabel(id) {
    const group = UNITY_COMPONENT_CATEGORIES.find((category) => category.id === id);
    return group ? group.label : (id === "scripts" ? "SCRIPTS" : "OTHER");
  }

  function dataTypeCategories() {
    const schema = currentSchemaId();
    const groups = [
      { id: "primitive", label: "PRIMITIVE", values: ["bool", "int", "float", "double", "string"] },
      { id: "math", label: "MATH", values: ["Vector2", "Vector3", "Quaternion", "Color"] }
    ];

    if (schema === "unity") {
      groups.push(
        { id: "core", label: "UNITY CORE", values: ["GameObject", "Transform", "LayerMask"] },
        { id: "physics", label: "PHYSICS", values: ["Rigidbody", "Rigidbody2D", "CharacterController", "Collider", "Collider2D", "BoxCollider", "SphereCollider", "CapsuleCollider", "MeshCollider", "BoxCollider2D", "CircleCollider2D", "CapsuleCollider2D"] },
        { id: "animation", label: "ANIMATION", values: ["Animator", "Animation", "PlayableDirector", "AnimationClip", "RuntimeAnimatorController"] },
        { id: "audio", label: "AUDIO", values: ["AudioSource", "AudioListener", "AudioReverbZone", "AudioClip"] },
        { id: "rendering", label: "RENDERING", values: ["Camera", "Light", "SpriteRenderer", "MeshRenderer", "SkinnedMeshRenderer", "Texture2D", "Material"] },
        { id: "ui", label: "UI", values: ["Canvas", "CanvasGroup", "RectTransform", "GraphicRaycaster"] },
        { id: "effects", label: "EFFECTS", values: ["ParticleSystem", "TrailRenderer", "LineRenderer"] },
        { id: "navigation", label: "NAVIGATION", values: ["NavMeshAgent", "NavMeshObstacle", "OffMeshLink"] }
      );
    }

    const enums = enumNodes().map((node) => node.title);
    if (enums.length) groups.push({ id: "enums", label: "ENUMS", values: enums });

    if (schema === "unity") {
      const custom = publicClassNodes().map((node) => node.title);
      if (custom.length) groups.push({ id: "classes", label: "CUSTOM CLASSES", values: custom });

      const structs = publicStructNodes().filter((node) => node.type === "struct").map((node) => node.title);
      if (structs.length) groups.push({ id: "structs", label: "STRUCTS", values: structs });

      const jobs = publicStructNodes().filter((node) => node.type === "jobStruct").map((node) => node.title);
      if (jobs.length) groups.push({ id: "jobs", label: "UNITY JOBS", values: jobs });
    }
    return groups;
  }

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
    const snapped = Math.round(Number(value || 1) * 20) / 20;
    if (snapped > 0.97 && snapped < 1.03) return 1;
    return Math.max(0.3, Math.min(1.65, snapped));
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

  function functionParameter(name, dataType, extra) {
    return Object.assign({
      id: uid("param"),
      kind: "parameter",
      name: name || "value",
      label: name || "value",
      dataType: dataType || "int",
      collectionKind: "single",
      arrayLength: 0,
      listInitialCount: 0,
      dictionaryKeyType: "string",
      mode: "value",
      access: "public"
    }, extra || {});
  }

  function parseTypeDescriptor(text) {
    const raw = String(text || "int").trim();
    const dictionary = raw.match(/^Dictionary<\s*([^,]+)\s*,\s*(.+)\s*>$/i);
    if (dictionary) {
      return {
        dataType: dictionary[2].trim(),
        collectionKind: "dictionary",
        dictionaryKeyType: dictionary[1].trim()
      };
    }

    const list = raw.match(/^List<\s*(.+)\s*>$/i);
    if (list) {
      return { dataType: list[1].trim(), collectionKind: "list" };
    }

    const array = raw.match(/^(.+)\[\s*\]$/);
    if (array) {
      return { dataType: array[1].trim(), collectionKind: "array" };
    }

    return { dataType: raw || "int", collectionKind: "single" };
  }

  function parseParameterString(text, access) {
    const source = String(text || "").trim();
    if (!source) return [];

    return source.split(",").map((part, index) => {
      const tokens = part.trim().split(/\s+/).filter(Boolean);
      let mode = "value";
      if (["ref", "out", "in"].includes(tokens[0])) mode = tokens.shift();

      const typeToken = tokens.shift() || "int";
      const name = tokens.join(" ") || ("value" + (index + 1));
      const descriptor = parseTypeDescriptor(typeToken);
      return functionParameter(name, descriptor.dataType, {
        collectionKind: descriptor.collectionKind,
        dictionaryKeyType: descriptor.dictionaryKeyType || "string",
        mode: mode,
        access: access || "public"
      });
    });
  }

  function parameterTypeLabel(parameter) {
    return collectionTypeLabel(
      parameter.collectionKind,
      parameter.dataType,
      parameter.dictionaryKeyType,
      parameter.arrayLength
    );
  }

  function parameterTypeKey(parameter) {
    return collectionTypeKey(
      parameter.collectionKind,
      parameter.dataType,
      parameter.dictionaryKeyType
    );
  }

  function syncLegacyParameters(target) {
    if (!target || !Array.isArray(target.methodParameters)) return;
    target.parameters = target.methodParameters.map((parameter) => {
      const prefix = parameter.mode && parameter.mode !== "value" ? parameter.mode + " " : "";
      return prefix + parameterTypeKey(parameter) + " " + (parameter.name || parameter.label || "value");
    }).join(", ");
  }

  function ensureFunctionSignature(target, accessFallback) {
    if (!target) return;
    const access = target.access || target.methodAccess || accessFallback || "public";

    if (!Array.isArray(target.methodParameters)) {
      target.methodParameters = parseParameterString(target.parameters || "", access);
    }

    target.methodParameters = target.methodParameters.map((parameter, index) => {
      if (!parameter || typeof parameter !== "object") {
        return functionParameter("value" + (index + 1), "int", { access: access });
      }
      if (!parameter.id) parameter.id = uid("param");
      parameter.kind = "parameter";
      if (typeof parameter.name !== "string" || !parameter.name) parameter.name = parameter.label || ("value" + (index + 1));
      parameter.label = parameter.name;
      if (typeof parameter.dataType !== "string" || !parameter.dataType) parameter.dataType = "int";
      if (typeof parameter.collectionKind !== "string") parameter.collectionKind = "single";
      if (!["single", "array", "list", "dictionary"].includes(parameter.collectionKind)) parameter.collectionKind = "single";
      if (typeof parameter.arrayLength !== "number") parameter.arrayLength = 0;
      if (typeof parameter.listInitialCount !== "number") parameter.listInitialCount = 0;
      if (typeof parameter.dictionaryKeyType !== "string" || !parameter.dictionaryKeyType) parameter.dictionaryKeyType = "string";
      if (!["value", "ref", "out", "in"].includes(parameter.mode)) parameter.mode = "value";
      parameter.access = access;
      return parameter;
    });

    if (!target.returnPortId) target.returnPortId = uid("return");
    if (typeof target.returnName !== "string" || !target.returnName) target.returnName = "result";
    if (typeof target.methodLogic !== "string") target.methodLogic = "";
    if (!["basic", "advanced"].includes(target.methodEditorMode)) target.methodEditorMode = "basic";
    if (!target.methodBody || typeof target.methodBody !== "object") {
      target.methodBody = { version: 1, name: "Function Body", nodes: [], connections: [], groups: [] };
    }
    if (!Array.isArray(target.methodBody.nodes)) target.methodBody.nodes = [];
    if (!Array.isArray(target.methodBody.connections)) target.methodBody.connections = [];
    if (!Array.isArray(target.methodBody.groups)) target.methodBody.groups = [];
    if (typeof target.methodBody.name !== "string" || !target.methodBody.name) target.methodBody.name = "Function Body";
    if (!target.methodEntryPortId) target.methodEntryPortId = uid("method_entry");
    if (!target.methodExitPortId) target.methodExitPortId = uid("method_exit");
    syncLegacyParameters(target);
  }

  function applyLifecyclePreset(target, preset) {
    if (!target || !preset) return;
    target.label = target.label !== undefined ? preset.name : target.label;
    if (target.title !== undefined) target.title = preset.name;
    target.returnType = preset.returnType || "void";
    target.returnCollectionKind = "single";
    target.methodParameters = parseParameterString(preset.parameters || "", target.access || target.methodAccess || "private");
    syncLegacyParameters(target);
  }

  function variableRow(label, dataType, access) {
    return row(label || "value", "", "variable", {
      dataType: dataType || "int",
      access: access || "private",
      serialized: false,
      referenceMode: "value",
      defaultValue: "",
      collectionKind: "single",
      arrayLength: 0,
      listInitialCount: 0,
      dictionaryKeyType: "string"
    });
  }

  function methodRow(label, returnType, methodKind) {
    return row(label || "Method", "", "function", {
      access: "private",
      methodKind: methodKind || "custom",
      returnType: returnType || "void",
      returnCollectionKind: "single",
      returnArrayLength: 0,
      returnDictionaryKeyType: "string",
      parameters: "",
      methodParameters: [],
      returnPortId: uid("return"),
      returnName: "result",
      methodDescription: "",
      methodLogic: "",
      methodEditorMode: "basic",
      methodBody: { nodes: [], connections: [] }
    });
  }

  function eventRow(label, payloadType) {
    return row(label || "OnEvent", "", "unityEvent", {
      access: "public",
      payloadType: payloadType || "void",
      serialized: true
    });
  }

  function enumValue(name, value) {
    return {
      id: uid("enum"),
      name: name || "Value",
      value: typeof value === "number" ? value : 0
    };
  }

  function enumNodes() {
    return project.nodes.filter((node) => node.type === "enum");
  }

  function enumByName(name) {
    return enumNodes().find((node) => node.title === name) || null;
  }

  function pruneNodeRowConnections(node) {
    if (!node || !Array.isArray(node.rows)) return;
    const validRows = new Set(node.rows.map((item) => item && item.id).filter(Boolean));
    project.connections = project.connections.filter((edge) => {
      if (edge.from.nodeId === node.id && !validRows.has(edge.from.rowId)) return false;
      if (edge.to.nodeId === node.id && !validRows.has(edge.to.rowId)) return false;
      return true;
    });
  }

  function syncFlowStartNode(node) {
    if (!node || node.type !== "flowStart") return;
    const existing = node.rows.find((item) => item && item.kind === "flowOut");
    if (!node.flowStartOutId) node.flowStartOutId = existing ? existing.id : uid("flow_start_out");
    node.rows = [{ id: node.flowStartOutId, label: "Next", value: "", kind: "flowOut" }];
  }

  function syncFlowEndNode(node) {
    if (!node || node.type !== "flowEnd") return;
    const existing = node.rows.find((item) => item && item.kind === "flowIn");
    if (!node.flowEndInId) node.flowEndInId = existing ? existing.id : uid("flow_end_in");
    node.rows = [{ id: node.flowEndInId, label: "Enter", value: "", kind: "flowIn" }];
  }

  function syncFlowIONode(node) {
    if (!node || node.type !== "flowIO") return;
    if (!["input", "output"].includes(node.flowIoMode)) node.flowIoMode = "input";
    if (typeof node.flowChartDataType !== "string" || !node.flowChartDataType) node.flowChartDataType = "any";

    const flowIn = node.rows.find((item) => item && item.kind === "flowIn");
    const flowOut = node.rows.find((item) => item && item.kind === "flowOut");
    const dataIn = node.rows.find((item) => item && item.kind === "input");
    const dataOut = node.rows.find((item) => item && item.kind === "output");

    if (!node.flowIoFlowInId) node.flowIoFlowInId = flowIn ? flowIn.id : uid("flow_io_in");
    if (!node.flowIoFlowOutId) node.flowIoFlowOutId = flowOut ? flowOut.id : uid("flow_io_out");
    if (!node.flowIoDataInId) node.flowIoDataInId = dataIn ? dataIn.id : uid("flow_io_data_in");
    if (!node.flowIoDataOutId) node.flowIoDataOutId = dataOut ? dataOut.id : uid("flow_io_data_out");

    node.rows = [
      { id: node.flowIoFlowInId, label: "Enter", value: "", kind: "flowIn" },
      { id: node.flowIoFlowOutId, label: "Next", value: "", kind: "flowOut" }
    ];

    if (node.flowIoMode === "input") {
      node.rows.push({ id: node.flowIoDataOutId, label: "Value", value: node.flowChartDataType, kind: "output" });
    } else {
      node.rows.push({ id: node.flowIoDataInId, label: "Value", value: node.flowChartDataType, kind: "input" });
    }
  }

  function syncFlowProcessNode(node) {
    if (!node || node.type !== "flowProcess") return;
    const flowIn = node.rows.find((item) => item && item.kind === "flowIn");
    const flowOut = node.rows.find((item) => item && item.kind === "flowOut");
    if (!node.flowProcessInId) node.flowProcessInId = flowIn ? flowIn.id : uid("flow_process_in");
    if (!node.flowProcessOutId) node.flowProcessOutId = flowOut ? flowOut.id : uid("flow_process_out");

    const dataRows = node.rows.filter((item) => item && (item.kind === "input" || item.kind === "output"));
    node.rows = [
      { id: node.flowProcessInId, label: "Enter", value: "", kind: "flowIn" },
      { id: node.flowProcessOutId, label: "Next", value: "", kind: "flowOut" }
    ].concat(dataRows);

    if (!node.nestedGraph || typeof node.nestedGraph !== "object") {
      node.nestedGraph = { version: 1, name: "Process Body", nodes: [], connections: [], groups: [] };
    }
  }

  function syncClassicEventNode(node) {
    if (!node || node.type !== "event" || currentSchemaId() !== "classic") return;
    if (typeof node.flowChartDataType !== "string" || !node.flowChartDataType) node.flowChartDataType = "any";

    const existingFlow = node.rows.find((item) => item && item.kind === "flowOut");
    const existingValue = node.rows.find((item) => item && item.kind === "output" &&
      ["payload", "value", "input"].includes(String(item.label || "").toLowerCase()));

    if (!node.classicEventFlowOutId) node.classicEventFlowOutId = existingFlow ? existingFlow.id : uid("classic_event_next");
    if (!node.classicEventValueOutId) node.classicEventValueOutId = existingValue ? existingValue.id : uid("classic_event_value");

    const reserved = new Set([node.classicEventFlowOutId, node.classicEventValueOutId]);
    const customRows = node.rows.filter((item) => item && !reserved.has(item.id));

    const rows = [{
      id: node.classicEventFlowOutId,
      label: "Next",
      value: "",
      kind: "flowOut"
    }];

    if (node.eventKind === "input") {
      rows.push({
        id: node.classicEventValueOutId,
        label: "Value",
        value: node.flowChartDataType,
        kind: "output"
      });
    }

    node.rows = rows.concat(customRows);
  }

  function syncClassicActionNode(node) {
    if (!node || node.type !== "action" || currentSchemaId() !== "classic") return;
    if (typeof node.flowChartDataType !== "string" || !node.flowChartDataType) node.flowChartDataType = "any";

    const flowIn = node.rows.find((item) => item && item.kind === "flowIn");
    const flowOut = node.rows.find((item) => item && item.kind === "flowOut");
    if (!node.classicActionFlowInId) node.classicActionFlowInId = flowIn ? flowIn.id : uid("classic_action_in");
    if (!node.classicActionFlowOutId) node.classicActionFlowOutId = flowOut ? flowOut.id : uid("classic_action_out");
    if (!node.classicActionValueInId) node.classicActionValueInId = uid("classic_action_value_in");
    if (!node.classicActionValueOutId) node.classicActionValueOutId = uid("classic_action_value_out");

    const reserved = new Set([
      node.classicActionFlowInId,
      node.classicActionFlowOutId,
      node.classicActionValueInId,
      node.classicActionValueOutId
    ]);
    const customRows = node.rows.filter((item) => item && !reserved.has(item.id));

    const rows = [
      { id: node.classicActionFlowInId, label: "Enter", value: "", kind: "flowIn" },
      { id: node.classicActionFlowOutId, label: "Next", value: "", kind: "flowOut" }
    ];

    if (["setVariable", "writeOutput", "callFunction"].includes(node.actionKind)) {
      rows.push({
        id: node.classicActionValueInId,
        label: node.actionKind === "callFunction" ? "Argument" : "Value",
        value: node.flowChartDataType,
        kind: "input"
      });
    }

    if (["readInput", "callFunction"].includes(node.actionKind)) {
      rows.push({
        id: node.classicActionValueOutId,
        label: node.actionKind === "callFunction" ? "Result" : "Value",
        value: node.flowChartDataType,
        kind: "output"
      });
    }

    node.rows = rows.concat(customRows);
  }

  function syncSwitchNode(node) {
    if (!node || node.type !== "switch") return;

    if (typeof node.switchValueType !== "string" || !node.switchValueType) node.switchValueType = "int";
    if (!Array.isArray(node.switchCases) || !node.switchCases.length) {
      node.switchCases = [
        { id: uid("switch_case"), value: "0" },
        { id: uid("switch_case"), value: "1" }
      ];
    }
    node.switchCases = node.switchCases.map((entry, index) => ({
      id: entry && entry.id ? entry.id : uid("switch_case"),
      value: entry && entry.value !== undefined ? String(entry.value) : String(index)
    }));
    if (typeof node.switchDefaultRowId !== "string" || !node.switchDefaultRowId) {
      const existingDefault = node.rows.find((item) => item && item.kind === "flowOut" && String(item.label || "").toLowerCase() === "default");
      node.switchDefaultRowId = existingDefault ? existingDefault.id : uid("switch_default");
    }

    const enumType = enumByName(node.switchValueType);
    if (enumType) {
      node.switchCases = enumType.enumValues.map((entry) => ({
        id: "case_" + entry.id,
        value: entry.name
      }));
    }

    const enter = node.rows.find((item) => item && item.kind === "flowIn") || row("Enter", "", "flowIn");
    enter.label = "Enter";
    const selector = node.rows.find((item) => item && item.kind === "input") || row("Value", node.switchValueType, "input");
    selector.label = "Value";
    selector.value = node.switchValueType;

    const outputs = node.switchCases.map((entry) => ({
      id: entry.id,
      label: "Case " + entry.value,
      value: "",
      kind: "flowOut",
      switchCaseValue: entry.value
    }));

    const defaultRow = {
      id: node.switchDefaultRowId,
      label: "Default",
      value: "",
      kind: "flowOut"
    };

    node.rows = [enter, selector].concat(outputs, [defaultRow]);
  }

  function syncReturnFlowNode(node) {
    if (!node || node.type !== "returnFlow") return;
    if (typeof node.returnFlowType !== "string" || !node.returnFlowType) node.returnFlowType = "void";
    if (typeof node.returnFlowInId !== "string" || !node.returnFlowInId) node.returnFlowInId = uid("return_flow_in");
    if (typeof node.returnValueRowId !== "string" || !node.returnValueRowId) node.returnValueRowId = uid("return_value");

    node.rows = [{
      id: node.returnFlowInId,
      label: "Enter",
      value: "",
      kind: "flowIn"
    }];
    if (node.returnFlowType !== "void") {
      node.rows.push({
        id: node.returnValueRowId,
        label: "Value",
        value: node.returnFlowType,
        kind: "input"
      });
    }
    node.pseudo = node.returnFlowType === "void" ? "return;" : "return Value;";
  }

  function syncConstantNode(node) {
    if (!node || node.type !== "constant") return;
    if (typeof node.constantType !== "string" || !node.constantType) node.constantType = "int";
    if (typeof node.constantValue !== "string") node.constantValue = "0";
    if (typeof node.constantOutputRowId !== "string" || !node.constantOutputRowId) {
      node.constantOutputRowId = uid("constant_out");
    }
    node.rows = [{
      id: node.constantOutputRowId,
      label: "Value",
      value: node.constantType,
      kind: "output"
    }];
    node.pseudo = node.constantValue;
  }

  function syncAdapterNode(node) {
    if (!node || node.type !== "adapter") return;
    if (typeof node.adapterInputType !== "string" || !node.adapterInputType) node.adapterInputType = "int";
    if (typeof node.adapterOutputType !== "string" || !node.adapterOutputType) node.adapterOutputType = "float";
    if (typeof node.adapterInputRowId !== "string" || !node.adapterInputRowId) node.adapterInputRowId = uid("adapter_in");
    if (typeof node.adapterOutputRowId !== "string" || !node.adapterOutputRowId) node.adapterOutputRowId = uid("adapter_out");

    node.rows = [
      {
        id: node.adapterInputRowId,
        label: "In",
        value: node.adapterInputType,
        kind: "input"
      },
      {
        id: node.adapterOutputRowId,
        label: "Out",
        value: node.adapterOutputType,
        kind: "output"
      }
    ];
  }

  function adapterConversionHint(fromType, toType) {
    const from = normalizedType(fromType);
    const to = normalizedType(toType);
    if (from === to) return "Pass-through";
    const scalar = new Set(["int", "float", "double"]);
    if (scalar.has(from) && scalar.has(to)) return "Conversione numerica";
    if (scalar.has(from) && ["Vector2", "Vector3"].includes(to)) return "Espandi il valore sui componenti";
    if (["Vector2", "Vector3"].includes(from) && scalar.has(to)) return "Estrai / riduci un componente";
    if (from === "Vector2" && to === "Vector3") return "XY → XYZ";
    if (from === "Vector3" && to === "Vector2") return "XYZ → XY";
    return "Conversione esplicita";
  }

  function mathOperationLabel(operation) {
    const labels = {
      add: "Add",
      subtract: "Subtract",
      multiply: "Multiply",
      divide: "Divide",
      modulo: "Modulo",
      power: "Power",
      min: "Min",
      max: "Max",
      clamp: "Clamp",
      lerp: "Lerp",
      abs: "Absolute",
      sqrt: "Square Root"
    };
    return labels[operation] || "Math";
  }

  function logicOperationLabel(operation) {
    return ({ and: "AND", or: "OR", xor: "XOR", not: "NOT" })[operation] || "Logic";
  }

  function compareOperationLabel(operation) {
    return ({
      equal: "Equal",
      notEqual: "Not Equal",
      greater: "Greater Than",
      greaterEqual: "Greater / Equal",
      less: "Less Than",
      lessEqual: "Less / Equal"
    })[operation] || "Compare";
  }

  function ensureStableRowId(node, key, prefix) {
    if (typeof node[key] !== "string" || !node[key]) node[key] = uid(prefix);
    return node[key];
  }

  function syncMathNode(node) {
    if (!node || node.type !== "math") return;
    if (typeof node.mathOperation !== "string") node.mathOperation = "add";
    if (typeof node.mathDataType !== "string" || !node.mathDataType) node.mathDataType = "float";

    const aId = ensureStableRowId(node, "mathInputAId", "math_a");
    const bId = ensureStableRowId(node, "mathInputBId", "math_b");
    const cId = ensureStableRowId(node, "mathInputCId", "math_c");
    const outId = ensureStableRowId(node, "mathOutputId", "math_out");
    const type = node.mathDataType;
    const rows = [];

    if (["abs", "sqrt"].includes(node.mathOperation)) {
      rows.push({ id: aId, label: "Value", value: type, kind: "input" });
    } else if (node.mathOperation === "clamp") {
      rows.push(
        { id: aId, label: "Value", value: type, kind: "input" },
        { id: bId, label: "Min", value: type, kind: "input" },
        { id: cId, label: "Max", value: type, kind: "input" }
      );
    } else if (node.mathOperation === "lerp") {
      rows.push(
        { id: aId, label: "A", value: type, kind: "input" },
        { id: bId, label: "B", value: type, kind: "input" },
        { id: cId, label: "T", value: "float", kind: "input" }
      );
    } else {
      rows.push(
        { id: aId, label: "A", value: type, kind: "input" },
        { id: bId, label: "B", value: type, kind: "input" }
      );
    }

    rows.push({ id: outId, label: "Result", value: type, kind: "output" });
    node.rows = rows;
  }

  function syncLogicNode(node) {
    if (!node || node.type !== "logic") return;
    if (typeof node.logicOperation !== "string") node.logicOperation = "and";
    const aId = ensureStableRowId(node, "logicInputAId", "logic_a");
    const bId = ensureStableRowId(node, "logicInputBId", "logic_b");
    const outId = ensureStableRowId(node, "logicOutputId", "logic_out");

    node.rows = [{ id: aId, label: "A", value: "bool", kind: "input" }];
    if (node.logicOperation !== "not") {
      node.rows.push({ id: bId, label: "B", value: "bool", kind: "input" });
    }
    node.rows.push({ id: outId, label: "Result", value: "bool", kind: "output" });
  }

  function syncCompareNode(node) {
    if (!node || node.type !== "compare") return;
    if (typeof node.compareOperation !== "string") node.compareOperation = "equal";
    if (typeof node.compareDataType !== "string" || !node.compareDataType) node.compareDataType = "float";
    const aId = ensureStableRowId(node, "compareInputAId", "compare_a");
    const bId = ensureStableRowId(node, "compareInputBId", "compare_b");
    const outId = ensureStableRowId(node, "compareOutputId", "compare_out");

    node.rows = [
      { id: aId, label: "A", value: node.compareDataType, kind: "input" },
      { id: bId, label: "B", value: node.compareDataType, kind: "input" },
      { id: outId, label: "Result", value: "bool", kind: "output" }
    ];
  }

  function componentRow(componentType, category, source, extra) {
    return row(componentType || "Component", "", "component", Object.assign({
      componentType: componentType || "Component",
      componentCategory: category || componentCategoryFor(componentType),
      componentSource: source || "unity",
      componentClassId: "",
      enabled: true,
      locked: componentType === "Transform"
    }, extra || {}));
  }

  function attachableScriptNodes() {
    return project.nodes.filter((node) =>
      node.type === "class" &&
      node.baseType === "MonoBehaviour"
    );
  }

  function componentPresetRows(componentType) {
    const presets = {
      Transform: [
        variableRow("position", "Vector3", "public"),
        variableRow("rotation", "Vector3", "public"),
        variableRow("scale", "Vector3", "public")
      ],
      Rigidbody: [
        variableRow("velocity", "Vector3", "public"),
        variableRow("angularVelocity", "Vector3", "public"),
        variableRow("mass", "float", "public"),
        variableRow("useGravity", "bool", "public"),
        variableRow("isKinematic", "bool", "public")
      ],
      Rigidbody2D: [
        variableRow("linearVelocity", "Vector2", "public"),
        variableRow("angularVelocity", "float", "public"),
        variableRow("mass", "float", "public"),
        variableRow("gravityScale", "float", "public")
      ],
      CharacterController: [
        variableRow("velocity", "Vector3", "public"),
        variableRow("isGrounded", "bool", "public"),
        variableRow("height", "float", "public"),
        variableRow("radius", "float", "public")
      ],
      Animator: [
        variableRow("controller", "RuntimeAnimatorController", "public"),
        variableRow("speed", "float", "public"),
        variableRow("applyRootMotion", "bool", "public")
      ],
      AudioSource: [
        variableRow("clip", "AudioClip", "public"),
        variableRow("volume", "float", "public"),
        variableRow("loop", "bool", "public")
      ],
      Camera: [
        variableRow("fieldOfView", "float", "public"),
        variableRow("cullingMask", "LayerMask", "public")
      ],
      Light: [
        variableRow("intensity", "float", "public"),
        variableRow("color", "Color", "public")
      ],
      ParticleSystem: [
        variableRow("playOnAwake", "bool", "public"),
        variableRow("loop", "bool", "public")
      ],
      Canvas: [
        variableRow("enabled", "bool", "public")
      ],
      CanvasGroup: [
        variableRow("alpha", "float", "public"),
        variableRow("interactable", "bool", "public"),
        variableRow("blocksRaycasts", "bool", "public")
      ],
      NavMeshAgent: [
        variableRow("speed", "float", "public"),
        variableRow("stoppingDistance", "float", "public"),
        variableRow("isStopped", "bool", "public"),
        variableRow("velocity", "Vector3", "public")
      ],
      SpriteRenderer: [
        variableRow("color", "Color", "public"),
        variableRow("enabled", "bool", "public")
      ]
    };
    return (presets[componentType] || []).map((item) => item);
  }

  function applyStandaloneComponentType(node, nextType) {
    if (!node || node.type !== "component" || !nextType) return;
    const previousRows = Array.isArray(node.rows) ? node.rows.slice() : [];
    const output = previousRows.find((item) => item && item.kind === "output") || row(nextType, nextType, "output");
    output.label = nextType;
    output.value = nextType;

    const previousByLabel = new Map(
      previousRows
        .filter((item) => item && (item.kind === "variable" || item.kind === "property"))
        .map((item) => [String(item.label || "").toLowerCase(), item])
    );

    const presetRows = componentPresetRows(nextType).map((preset) => {
      const existing = previousByLabel.get(String(preset.label || "").toLowerCase());
      if (!existing) return preset;
      existing.kind = preset.kind;
      existing.dataType = preset.dataType;
      existing.value = preset.value;
      existing.access = preset.access;
      return existing;
    });

    const keptIds = new Set([output.id].concat(presetRows.map((item) => item.id)));
    project.connections = project.connections.filter((edge) =>
      !(edge.from.nodeId === node.id && !keptIds.has(edge.from.rowId)) &&
      !(edge.to.nodeId === node.id && !keptIds.has(edge.to.rowId))
    );

    node.componentType = nextType;
    node.componentCategory = componentCategoryFor(nextType);
    node.componentSource = "unity";
    node.title = nextType;
    node.rows = [output].concat(presetRows);
    ensureNodeMeta(node);
  }

  function publicClassNodes() {
    return project.nodes.filter((node) => node.type === "class" && node.classVisibility === "public");
  }

  function allClassNodes() {
    return project.nodes.filter((node) => node.type === "class");
  }

  function publicStructNodes() {
    return project.nodes.filter((node) =>
      (node.type === "struct" || node.type === "jobStruct") &&
      (node.structVisibility || "public") === "public"
    );
  }

  function availableDataTypes() {
    const schema = currentSchemaId();
    const neutralTypes = ["bool", "int", "float", "double", "string", "Vector2", "Vector3", "Quaternion", "Color"];
    const baseTypes = schema === "unity" ? DATA_TYPES : neutralTypes;
    let values = baseTypes.concat(enumNodes().map((node) => node.title));

    if (schema === "unity") {
      values = values
        .concat(publicClassNodes().map((node) => node.title))
        .concat(publicStructNodes().map((node) => node.title));
    }

    return values.filter((value, index, array) => array.indexOf(value) === index);
  }

  function normalizeMember(item) {
    if (!item.id) item.id = uid("row");
    if (!ROW_META[item.kind]) item.kind = "variable";
    if (typeof item.label !== "string") item.label = "value";
    if (typeof item.value !== "string") item.value = "";
    if (typeof item.uiExpanded !== "boolean") item.uiExpanded = false;
    if (typeof item.memberComment !== "string") item.memberComment = "";

    if (item.kind === "variable" || item.kind === "property") {
      if (typeof item.access !== "string") item.access = item.kind === "property" ? "public" : "private";
      if (typeof item.dataType !== "string" || !item.dataType) {
        const guess = item.value.split("=")[0].trim();
        item.dataType = guess && guess.length < 32 ? guess : "int";
      }
      if (typeof item.serialized !== "boolean") item.serialized = item.access === "public";
      if (typeof item.referenceMode !== "string") item.referenceMode = "value";
      if (typeof item.defaultValue !== "string") item.defaultValue = "";
      if (typeof item.collectionKind !== "string") item.collectionKind = "single";
      if (!["single", "array", "list", "dictionary", "nativeArray", "nativeList", "nativeReference"].includes(item.collectionKind)) item.collectionKind = "single";
      if (typeof item.jobAccess !== "string" || !["readwrite", "readonly", "writeonly"].includes(item.jobAccess)) item.jobAccess = "readwrite";
      if (typeof item.arrayLength !== "number") item.arrayLength = 0;
      if (typeof item.listInitialCount !== "number") item.listInitialCount = 0;
      if (typeof item.dictionaryKeyType !== "string" || !item.dictionaryKeyType) item.dictionaryKeyType = "string";
    }

    if (item.kind === "function") {
      if (typeof item.access !== "string") item.access = "private";
      if (typeof item.methodKind !== "string") item.methodKind = "custom";
      if (typeof item.returnType !== "string" || !item.returnType) {
        const match = item.value.match(/returns?\s+([^\s]+)/i);
        item.returnType = match ? match[1] : "void";
      }
      if (typeof item.returnCollectionKind !== "string") item.returnCollectionKind = "single";
      if (!["single", "array", "list", "dictionary"].includes(item.returnCollectionKind)) item.returnCollectionKind = "single";
      if (typeof item.returnArrayLength !== "number") item.returnArrayLength = 0;
      if (typeof item.returnDictionaryKeyType !== "string" || !item.returnDictionaryKeyType) item.returnDictionaryKeyType = "string";
      if (typeof item.parameters !== "string") item.parameters = "";
      if (typeof item.methodDescription !== "string") item.methodDescription = "";
      ensureFunctionSignature(item, item.access);
    }

    if (item.kind === "unityEvent") {
      if (typeof item.access !== "string") item.access = "public";
      if (typeof item.payloadType !== "string") item.payloadType = "void";
      if (typeof item.serialized !== "boolean") item.serialized = true;
    }

    if (item.kind === "component") {
      if (typeof item.componentType !== "string" || !item.componentType) item.componentType = item.label || "Component";
      if (typeof item.componentCategory !== "string") item.componentCategory = componentCategoryFor(item.componentType);
      if (typeof item.componentSource !== "string") item.componentSource = "unity";
      if (typeof item.componentClassId !== "string") item.componentClassId = "";
      if (typeof item.enabled !== "boolean") item.enabled = true;
      if (typeof item.locked !== "boolean") item.locked = item.componentType === "Transform";
      item.label = item.componentType;
    }
    return item;
  }

  function syncJobExecuteMethod(node) {
    if (!node || node.type !== "jobStruct") return;
    let execute = (node.rows || []).find((item) => item && item.kind === "function" && item.jobExecute);
    if (!execute) {
      execute = methodRow("Execute", "void", "custom");
      execute.access = "public";
      execute.jobExecute = true;
      node.rows.push(execute);
    }

    execute.label = "Execute";
    execute.access = "public";
    execute.returnType = "void";
    execute.returnCollectionKind = "single";
    execute.methodKind = "custom";

    const interfaceName = node.jobInterface || "IJob";
    if (interfaceName === "IJobFor" || interfaceName === "IJobParallelFor") {
      if (!execute.methodParameters.length ||
          execute.methodParameters.length !== 1 ||
          execute.methodParameters[0].name !== "index" ||
          execute.methodParameters[0].dataType !== "int") {
        execute.methodParameters = [functionParameter("index", "int", { access: "public" })];
      }
    } else if (interfaceName === "IJob" || interfaceName === "IJobEntity") {
      execute.methodParameters = [];
    }
    syncLegacyParameters(execute);
  }

  function structureKindLabel(node) {
    if (!node) return "Structure";
    if (node.type === "jobStruct") return node.jobInterface || "IJob";
    if (node.type === "struct") return node.structReadonly ? "readonly struct" : "struct";
    return typeMeta(node.type).label;
  }

  function ensureNodeMeta(node) {
    if (!Array.isArray(node.rows)) node.rows = [];
    node.rows.forEach(normalizeMember);
    if (!node.uiSections || typeof node.uiSections !== "object") node.uiSections = {};
    if (!node.uiComponentCategories || typeof node.uiComponentCategories !== "object") node.uiComponentCategories = {};

    if (node.type === "object") {
      const hasTransform = node.rows.some((item) => item.kind === "component" && item.componentType === "Transform");
      if (!hasTransform) node.rows.unshift(componentRow("Transform", "core", "unity", { locked: true }));
    }

    if (node.type === "component") {
      if (typeof node.componentType !== "string" || !node.componentType) node.componentType = "Animator";
      if (typeof node.componentCategory !== "string") node.componentCategory = componentCategoryFor(node.componentType);
      if (typeof node.componentSource !== "string") node.componentSource = "unity";
    }

    if (node.type === "struct" || node.type === "jobStruct") {
      if (typeof node.structVisibility !== "string") node.structVisibility = "public";
      if (typeof node.structReadonly !== "boolean") node.structReadonly = false;
      if (typeof node.structSerializable !== "boolean") node.structSerializable = node.type === "struct";
    }

    if (node.type === "jobStruct") {
      if (!["IJob", "IJobFor", "IJobParallelFor", "IJobEntity"].includes(node.jobInterface)) node.jobInterface = "IJob";
      if (!["Run", "Schedule", "ScheduleParallel"].includes(node.jobScheduleMode)) node.jobScheduleMode = "Schedule";
      if (typeof node.jobBurst !== "boolean") node.jobBurst = true;
      syncJobExecuteMethod(node);
    }

    if (node.type === "enum") {
      if (typeof node.enumVisibility !== "string") node.enumVisibility = "public";
      if (typeof node.enumUnderlyingType !== "string") node.enumUnderlyingType = "int";
      if (typeof node.enumFlags !== "boolean") node.enumFlags = false;
      if (!Array.isArray(node.enumValues)) node.enumValues = [enumValue("None", 0), enumValue("ValueA", 1)];
      node.enumValues = node.enumValues.map((item, index) => ({
        id: item && item.id ? item.id : uid("enum"),
        name: item && typeof item.name === "string" ? item.name : "Value" + index,
        value: item && typeof item.value === "number" ? item.value : index
      }));
    }

    if (node.type === "switch") {
      if (typeof node.switchValueType !== "string" || !node.switchValueType) {
        const selector = node.rows.find((item) => item && item.kind === "input");
        node.switchValueType = selector && selector.value ? selector.value : "int";
      }
      if (!Array.isArray(node.switchCases) || !node.switchCases.length) {
        node.switchCases = node.rows
          .filter((item) => item && item.kind === "flowOut" && String(item.label || "").toLowerCase() !== "default")
          .map((item, index) => ({
            id: item.id || uid("switch_case"),
            value: String(item.label || index).replace(/^Case\s+/i, "")
          }));
        if (!node.switchCases.length) {
          node.switchCases = [
            { id: uid("switch_case"), value: "0" },
            { id: uid("switch_case"), value: "1" }
          ];
        }
      }
      if (typeof node.switchDefaultRowId !== "string" || !node.switchDefaultRowId) {
        const defaultRow = node.rows.find((item) =>
          item && item.kind === "flowOut" && String(item.label || "").toLowerCase() === "default"
        );
        node.switchDefaultRowId = defaultRow ? defaultRow.id : uid("switch_default");
      }
    }

    if (node.type === "returnFlow") {
      syncReturnFlowNode(node);
    }
    if (node.type === "flowStart") {
      syncFlowStartNode(node);
    }
    if (node.type === "flowEnd") {
      syncFlowEndNode(node);
    }
    if (node.type === "flowIO") {
      syncFlowIONode(node);
    }
    if (node.type === "flowProcess") {
      syncFlowProcessNode(node);
    }
    if (node.type === "constant") {
      syncConstantNode(node);
    }
    if (node.type === "adapter") {
      syncAdapterNode(node);
    }
    if (node.type === "math") {
      syncMathNode(node);
    }
    if (node.type === "logic") {
      syncLogicNode(node);
    }
    if (node.type === "compare") {
      syncCompareNode(node);
    }

    if (node.type === "foreachLoop") {
      if (typeof node.foreachItemType !== "string" || !node.foreachItemType) node.foreachItemType = "any";
      const itemRow = node.rows.find((item) => item && item.id === "foreach_item");
      if (itemRow) itemRow.value = node.foreachItemType;
    }

    if (node.type === "event") {
      if (typeof node.eventKind !== "string") node.eventKind = "custom";
      if (currentSchemaId() === "classic" && !["start", "input", "manual"].includes(node.eventKind)) {
        node.eventKind = "start";
      }
    }

    if (node.type === "action") {
      if (typeof node.actionKind !== "string") node.actionKind = "custom";
      if (currentSchemaId() === "classic" && !["process", "callFunction", "setVariable", "readInput", "writeOutput"].includes(node.actionKind)) {
        node.actionKind = "process";
      }
    }

    syncClassicEventNode(node);
    syncClassicActionNode(node);

    if (node.type === "state") {
      if (typeof node.stateKind !== "string") node.stateKind = "normal";
    }

    if (node.type === "emptyGraph") {
      if (!node.nestedGraph || typeof node.nestedGraph !== "object") {
        node.nestedGraph = { version: 1, name: "Empty Body", nodes: [], connections: [], groups: [] };
      }
      if (!Array.isArray(node.nestedGraph.nodes)) node.nestedGraph.nodes = [];
      if (!Array.isArray(node.nestedGraph.connections)) node.nestedGraph.connections = [];
      if (!Array.isArray(node.nestedGraph.groups)) node.nestedGraph.groups = [];
      if (typeof node.nestedGraph.name !== "string" || !node.nestedGraph.name) node.nestedGraph.name = "Empty Body";
    }

    if (node.type === "graphInput" || node.type === "graphOutput") {
      node.boundaryLocked = true;
    }

    if (node.type === "sketch") {
      const fallbackSketchWidth = Math.max(360, Math.min(2400, Number(node.sketchWidth) || 520));
      const fallbackSketchHeight = Math.max(220, Math.min(1600, Number(node.sketchHeight) || 320));
      const fallbackStrokeWidth = Math.max(1, fallbackSketchWidth - 22);
      const fallbackStrokeHeight = Math.max(1, fallbackSketchHeight - 2);
      if (!Array.isArray(node.sketchStrokes)) node.sketchStrokes = [];
      node.sketchStrokes = node.sketchStrokes
        .filter((stroke) => stroke && Array.isArray(stroke.points) && stroke.points.length > 1)
        .map((stroke) => ({
          id: stroke.id || uid("stroke"),
          color: typeof stroke.color === "string" ? stroke.color : "#52677c",
          size: Math.max(1, Math.min(16, Number(stroke.size) || 3)),
          mode: stroke.mode === "erase" ? "erase" : "draw",
          // Every stroke keeps the local paper size it was drawn on.
          // Resizing the Sketch can therefore reveal/crop space without
          // scaling artwork that already exists.
          spaceWidth: Math.max(1, Number(stroke.spaceWidth) || fallbackStrokeWidth),
          spaceHeight: Math.max(1, Number(stroke.spaceHeight) || fallbackStrokeHeight),
          points: stroke.points
            .filter((point) => point && typeof point.x === "number" && typeof point.y === "number")
            .map((point) => ({
              x: Math.max(0, Math.min(1, point.x)),
              y: Math.max(0, Math.min(1, point.y))
            }))
        }))
        .filter((stroke) => stroke.points.length > 1);
      if (typeof node.sketchColor !== "string") node.sketchColor = "#52677c";
      if (typeof node.sketchSize !== "number") node.sketchSize = 3;
      node.sketchSize = Math.max(1, Math.min(16, node.sketchSize));
      if (node.sketchMode !== "erase") node.sketchMode = "draw";
      node.sketchWidth = fallbackSketchWidth;
      node.sketchHeight = fallbackSketchHeight;
    }

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
      if (typeof node.returnCollectionKind !== "string") node.returnCollectionKind = "single";
      if (!["single", "array", "list", "dictionary"].includes(node.returnCollectionKind)) node.returnCollectionKind = "single";
      if (typeof node.returnArrayLength !== "number") node.returnArrayLength = 0;
      if (typeof node.returnDictionaryKeyType !== "string" || !node.returnDictionaryKeyType) node.returnDictionaryKeyType = "string";
      if (typeof node.parameters !== "string") node.parameters = "";
      if (typeof node.methodDescription !== "string") node.methodDescription = node.description || "";

      if (!Array.isArray(node.methodParameters)) {
        const legacyInputs = node.rows.filter((item) => item.kind === "input");
        if (legacyInputs.length) {
          node.methodParameters = legacyInputs.map((item) => {
            const descriptor = parseTypeDescriptor(item.value && item.value !== "input" ? item.value : "int");
            return functionParameter(item.label || "value", descriptor.dataType, {
              collectionKind: descriptor.collectionKind,
              dictionaryKeyType: descriptor.dictionaryKeyType || "string",
              access: node.methodAccess
            });
          });
        }
      }

      const legacyOutput = node.rows.find((item) => item.kind === "output");
      if (legacyOutput) {
        if ((!node.returnType || node.returnType === "void") && legacyOutput.value && !["value", "output"].includes(legacyOutput.value)) {
          const descriptor = parseTypeDescriptor(legacyOutput.value);
          node.returnType = descriptor.dataType;
          node.returnCollectionKind = descriptor.collectionKind;
          node.returnDictionaryKeyType = descriptor.dictionaryKeyType || "string";
        }
        if (!node.returnName || node.returnName === "result") node.returnName = legacyOutput.label || "result";
      }

      node.rows = node.rows.filter((item) => item.kind !== "input" && item.kind !== "output");
      ensureFunctionSignature(node, node.methodAccess);
    }
  }

  function sampleProject() {
    const itemTypeValues = [
      enumValue("Consumable", 0),
      enumValue("Weapon", 1),
      enumValue("Armor", 2),
      enumValue("Material", 3),
      enumValue("Quest", 4),
      enumValue("KeyItem", 5),
      enumValue("Currency", 6),
      enumValue("Misc", 7)
    ];
    const rarityValues = [
      enumValue("Common", 0),
      enumValue("Uncommon", 1),
      enumValue("Rare", 2),
      enumValue("Epic", 3),
      enumValue("Legendary", 4)
    ];

    const itemDataRows = [
      variableRow("id", "string", "public"),
      variableRow("displayName", "string", "public"),
      variableRow("type", "ItemType", "public"),
      variableRow("rarity", "ItemRarity", "public"),
      variableRow("maxStack", "int", "public"),
      variableRow("icon", "Texture2D", "public"),
      variableRow("value", "int", "public")
    ];
    itemDataRows[4].defaultValue = "1";

    const slotItem = variableRow("item", "ItemData", "public");
    const slotQuantity = variableRow("quantity", "int", "public");
    const slotIsEmpty = methodRow("IsEmpty", "bool", "custom");
    slotIsEmpty.access = "public";
    slotIsEmpty.methodDescription = "True quando lo slot non contiene un item o la quantità è zero.";
    slotIsEmpty.methodLogic = "return item == null || quantity <= 0";
    const slotCanStack = methodRow("CanStack", "bool", "custom");
    slotCanStack.access = "public";
    slotCanStack.methodParameters = [functionParameter("other", "ItemData")];
    slotCanStack.methodDescription = "Verifica se l'item può essere aggiunto allo stack esistente.";
    slotCanStack.methodLogic = "return item == other && quantity < item.maxStack";
    syncLegacyParameters(slotCanStack);

    const inventorySlots = variableRow("slots", "InventorySlot", "private");
    inventorySlots.collectionKind = "list";
    inventorySlots.serialized = true;
    inventorySlots.listInitialCount = 12;
    const inventoryCapacity = variableRow("capacity", "int", "private");
    inventoryCapacity.serialized = true;
    inventoryCapacity.defaultValue = "24";

    const addItem = methodRow("AddItem", "bool", "custom");
    addItem.access = "public";
    addItem.methodParameters = [
      functionParameter("item", "ItemData"),
      functionParameter("amount", "int")
    ];
    addItem.methodDescription = "Aggiunge quantità allo stack compatibile o crea un nuovo slot se c'è capacità.";
    addItem.methodLogic = "find compatible stack\nif found: increase quantity\nelse if free slot: create slot\nraise OnInventoryChanged\nreturn success";
    addItem.returnName = "added";
    syncLegacyParameters(addItem);

    const removeItem = methodRow("RemoveItem", "bool", "custom");
    removeItem.access = "public";
    removeItem.methodParameters = [
      functionParameter("item", "ItemData"),
      functionParameter("amount", "int")
    ];
    removeItem.methodDescription = "Rimuove una quantità e libera lo slot quando raggiunge zero.";
    removeItem.methodLogic = "find matching slots\nsubtract amount\nclear empty slots\nraise OnInventoryChanged";
    removeItem.returnName = "removed";
    syncLegacyParameters(removeItem);

    const containsItem = methodRow("Contains", "bool", "custom");
    containsItem.access = "public";
    containsItem.methodParameters = [
      functionParameter("item", "ItemData"),
      functionParameter("amount", "int")
    ];
    containsItem.methodDescription = "Controlla se l'inventario contiene almeno la quantità richiesta.";
    containsItem.methodLogic = "sum quantities for item\nreturn total >= amount";
    containsItem.returnName = "contains";
    syncLegacyParameters(containsItem);

    const inventoryChanged = eventRow("OnInventoryChanged", "void");

    const dbItems = variableRow("itemsById", "ItemData", "private");
    dbItems.collectionKind = "dictionary";
    dbItems.dictionaryKeyType = "string";
    const getById = methodRow("GetById", "ItemData", "custom");
    getById.access = "public";
    getById.methodParameters = [functionParameter("id", "string")];
    getById.methodDescription = "Risolve un ItemData a partire dal suo identificatore persistente.";
    getById.methodLogic = "return itemsById.TryGetValue(id)";
    getById.returnName = "item";
    syncLegacyParameters(getById);

    const uiInventoryRef = variableRow("inventory", "Inventory", "private");
    uiInventoryRef.serialized = true;
    uiInventoryRef.referenceMode = "inspector";
    const refreshMethod = methodRow("Refresh", "void", "custom");
    refreshMethod.access = "public";
    refreshMethod.methodDescription = "Ridisegna gli slot UI a partire dallo stato corrente dell'inventario.";
    refreshMethod.methodLogic = "for each visible slot\nbind item icon, quantity and rarity\nclear unused views";

    const playerInventoryComponent = componentRow("Inventory", "scripts", "script", {
      componentClassId: "inventory",
      locked: false
    });

    const pickupItem = variableRow("item", "ItemData", "private");
    pickupItem.serialized = true;
    pickupItem.referenceMode = "inspector";
    const pickupAmount = variableRow("amount", "int", "private");
    pickupAmount.serialized = true;
    pickupAmount.defaultValue = "1";

    const pickupEventOut = row("Next", "", "flowOut");
    const pickupDataOut = row("item", "ItemData", "output");
    const canAddIn = row("Enter", "", "flowIn");
    const canAddItemIn = row("item", "ItemData", "input");
    const canAddTrue = row("True", "", "flowOut");
    const canAddFalse = row("False", "", "flowOut");
    const canAddResult = row("canAdd", "bool", "output");
    const addFlowIn = row("Enter", "", "flowIn");
    const addFlowOut = row("Next", "", "flowOut");
    const addItemIn = row("item", "ItemData", "input");
    const refreshFlowIn = row("Enter", "", "flowIn");
    const refreshFlowOut = row("Done", "", "flowOut");

    const nodes = [
      {
        id: "item_type",
        type: "enum",
        title: "ItemType",
        description: "Categorie di gameplay usate per filtrare, equipaggiare e presentare gli item.",
        pseudo: "",
        x: 120, y: 120, rows: [],
        enumVisibility: "public", enumUnderlyingType: "int", enumFlags: false,
        enumValues: itemTypeValues
      },
      {
        id: "item_rarity",
        type: "enum",
        title: "ItemRarity",
        description: "Rarità usata da UI, loot table e bilanciamento.",
        pseudo: "",
        x: 120, y: 520, rows: [],
        enumVisibility: "public", enumUnderlyingType: "int", enumFlags: false,
        enumValues: rarityValues
      },
      {
        id: "item_data",
        type: "class",
        title: "ItemData",
        description: "Dati statici condivisi di un item. Concettualmente adatto a uno ScriptableObject Unity.",
        pseudo: "",
        x: 650, y: 120,
        rows: itemDataRows,
        classVisibility: "public", baseType: "ScriptableObject", instanceAccess: "scriptableObject", executionOrder: 0
      },
      {
        id: "inventory_slot",
        type: "class",
        title: "InventorySlot",
        description: "Stato runtime di uno slot: item assegnato e quantità corrente.",
        pseudo: "",
        x: 650, y: 650,
        rows: [slotItem, slotQuantity, slotIsEmpty, slotCanStack],
        classVisibility: "public", baseType: "Plain C#", instanceAccess: "value", executionOrder: 0
      },
      {
        id: "inventory",
        type: "class",
        title: "Inventory",
        description: "Responsabile di capacità, stacking, aggiunta/rimozione item e notifica dei cambiamenti.",
        pseudo: "",
        x: 1250, y: 170,
        rows: [inventorySlots, inventoryCapacity, addItem, removeItem, containsItem, inventoryChanged],
        classVisibility: "public", baseType: "MonoBehaviour", instanceAccess: "inspector", executionOrder: 0
      },
      {
        id: "item_database",
        type: "class",
        title: "ItemDatabase",
        description: "Lookup centrale degli ItemData tramite ID persistente.",
        pseudo: "",
        x: 1250, y: 820,
        rows: [dbItems, getById],
        classVisibility: "public", baseType: "ScriptableObject", instanceAccess: "scriptableObject", executionOrder: 0
      },
      {
        id: "inventory_ui",
        type: "class",
        title: "InventoryUI",
        description: "Presenter UI che ascolta l'inventario e aggiorna le view degli slot.",
        pseudo: "",
        x: 1850, y: 160,
        rows: [uiInventoryRef, refreshMethod],
        classVisibility: "public", baseType: "MonoBehaviour", instanceAccess: "inspector", executionOrder: 0
      },
      {
        id: "player",
        type: "object",
        title: "Player",
        description: "GameObject che contiene il componente Inventory.",
        pseudo: "",
        x: 1850, y: 690,
        rows: [
          componentRow("Transform", "core", "unity", { locked: true }),
          playerInventoryComponent
        ]
      },
      {
        id: "item_pickup",
        type: "class",
        title: "ItemPickup",
        description: "Oggetto nel mondo che espone ItemData e quantità da raccogliere.",
        pseudo: "",
        x: 2380, y: 160,
        rows: [pickupItem, pickupAmount],
        classVisibility: "public", baseType: "MonoBehaviour", instanceAccess: "inspector", executionOrder: 0
      },
      {
        id: "pickup_event",
        type: "event",
        title: "OnItemPickup",
        description: "Evento concettuale generato quando il player interagisce con un pickup.",
        pseudo: "",
        x: 2380, y: 630,
        rows: [pickupEventOut, pickupDataOut],
        eventKind: "trigger"
      },
      {
        id: "can_add",
        type: "condition",
        title: "CanAddItem?",
        description: "Controlla stacking e capacità prima di modificare l'inventario.",
        pseudo: "inventory has compatible stack || free slot",
        x: 2850, y: 600,
        rows: [canAddIn, canAddItemIn, canAddTrue, canAddFalse, canAddResult]
      },
      {
        id: "add_action",
        type: "action",
        title: "Add To Inventory",
        description: "Chiama Inventory.AddItem con l'ItemData raccolto.",
        pseudo: "",
        x: 3330, y: 530,
        rows: [addFlowIn, addFlowOut, addItemIn],
        actionKind: "callMethod"
      },
      {
        id: "refresh_action",
        type: "action",
        title: "Refresh Inventory UI",
        description: "Aggiorna la UI dopo il cambiamento dell'inventario.",
        pseudo: "",
        x: 3800, y: 530,
        rows: [refreshFlowIn, refreshFlowOut],
        actionKind: "callMethod"
      },
      {
        id: "inventory_note",
        type: "note",
        title: "Inventory architecture",
        description: "ItemData = dati statici. InventorySlot = stato runtime. Inventory = regole. ItemDatabase = lookup. InventoryUI = presentazione. FLOW = comportamento del pickup.",
        pseudo: "",
        x: 2850, y: 950, rows: []
      }
    ];

    return {
      version: 1,
      name: "Inventory System — Demo",
      nodes: nodes,
      connections: [
        { id: uid("edge"), from: { nodeId: "pickup_event", rowId: pickupEventOut.id, side: "out", kind: "flow" }, to: { nodeId: "can_add", rowId: canAddIn.id, side: "in", kind: "flow" }, points: [], dataType: "__flow__" },
        { id: uid("edge"), from: { nodeId: "pickup_event", rowId: pickupDataOut.id, side: "out", kind: "data" }, to: { nodeId: "can_add", rowId: canAddItemIn.id, side: "in", kind: "data" }, points: [], dataType: "ItemData" },
        { id: uid("edge"), from: { nodeId: "can_add", rowId: canAddTrue.id, side: "out", kind: "flow" }, to: { nodeId: "add_action", rowId: addFlowIn.id, side: "in", kind: "flow" }, points: [], dataType: "__flow__" },
        { id: uid("edge"), from: { nodeId: "pickup_event", rowId: pickupDataOut.id, side: "out", kind: "data" }, to: { nodeId: "add_action", rowId: addItemIn.id, side: "in", kind: "data" }, points: [], dataType: "ItemData" },
        { id: uid("edge"), from: { nodeId: "add_action", rowId: addFlowOut.id, side: "out", kind: "flow" }, to: { nodeId: "refresh_action", rowId: refreshFlowIn.id, side: "in", kind: "flow" }, points: [], dataType: "__flow__" }
      ]
    };
  }

  const PROJECT_SCHEMAS = {
    unity: {
      label: "Unity",
      description: "Schema orientato a Unity e C#, pronto per componenti, MonoBehaviour e logica di gioco."
    },
    unreal: {
      label: "Unreal Engine",
      description: "Schema orientato ai concetti di Unreal Engine e Blueprint."
    },
    godot: {
      label: "Godot",
      description: "Schema orientato a scene, nodi, segnali e script Godot."
    },
    classic: {
      label: "Flow Chart",
      description: "Diagramma logico generico: controllo di flusso, funzioni, dati, confronti e matematica senza dipendenze da un game engine."
    }
  };

  function normalizeProjectSchema(schema) {
    return Object.prototype.hasOwnProperty.call(PROJECT_SCHEMAS, schema) ? schema : "unity";
  }

  function projectSchemaMeta(schema) {
    return PROJECT_SCHEMAS[normalizeProjectSchema(schema)];
  }

  function currentSchemaId() {
    const documentProject = rootProject || project || null;
    return normalizeProjectSchema(documentProject && documentProject.schema);
  }

  function schemaAllowsNodeType(type) {
    if (["graphInput", "graphOutput", "note", "sketch"].includes(type)) return true;
    const schema = currentSchemaId();
    if (schema === "unity") return true;

    if (schema === "classic") {
      return new Set([
        "flowStart", "flowEnd", "flowIO", "flowProcess",
        "function", "emptyGraph",
        "ifElse", "switch", "forLoop", "foreachLoop", "whileLoop", "doWhileLoop",
        "breakFlow", "continueFlow", "returnFlow",
        "constant", "variable", "adapter", "math", "logic", "compare"
      ]).has(type);
    }

    return new Set([
      "function", "emptyGraph", "enum",
      "event", "action", "ifElse", "switch", "forLoop", "foreachLoop", "whileLoop", "doWhileLoop",
      "breakFlow", "continueFlow", "returnFlow",
      "constant", "variable", "adapter", "math", "logic", "compare"
    ]).has(type);
  }

  function eventKindOptionsForSchema() {
    if (currentSchemaId() === "classic") {
      return [
        ["start", "Start"],
        ["input", "Input"],
        ["manual", "Manual Entry"]
      ];
    }
    return [
      ["custom", "Custom Event"],
      ["start", "Start"],
      ["update", "Update"],
      ["fixedUpdate", "Fixed Update"],
      ["lateUpdate", "Late Update"],
      ["input", "Input"],
      ["trigger", "Trigger"],
      ["collision", "Collision"],
      ["unityEvent", "UnityEvent"]
    ];
  }

  function actionKindOptionsForSchema() {
    if (currentSchemaId() === "classic") {
      return [
        ["process", "Process"],
        ["callFunction", "Call Function"],
        ["setVariable", "Set Variable"],
        ["readInput", "Read Input"],
        ["writeOutput", "Write Output"]
      ];
    }
    return [
      ["custom", "Custom"],
      ["callMethod", "Call Method"],
      ["setVariable", "Set Variable"],
      ["animator", "Animator"],
      ["audio", "Audio"],
      ["spawn", "Spawn"],
      ["destroy", "Destroy"],
      ["enable", "Enable / Disable"]
    ];
  }

  function classicEventLabel(kind) {
    if (kind === "input") return "INPUT";
    if (kind === "manual") return "MANUAL ENTRY";
    return "START";
  }

  function classicActionLabel(kind) {
    const labels = {
      process: "PROCESS",
      callFunction: "CALL FUNCTION",
      setVariable: "SET VARIABLE",
      readInput: "READ INPUT",
      writeOutput: "WRITE OUTPUT"
    };
    return labels[kind] || "PROCESS";
  }

  function blankProject(name, schema) {
    return {
      version: 1,
      name: name || "Nuovo schema",
      schema: normalizeProjectSchema(schema),
      nodes: [],
      connections: []
    };
  }

  function normalizeProject(raw) {
    const base = raw && typeof raw === "object" ? raw : sampleProject();
    if (!Array.isArray(base.nodes)) base.nodes = [];
    if (!Array.isArray(base.connections)) base.connections = [];
    if (!Array.isArray(base.groups)) base.groups = [];
    base.schema = normalizeProjectSchema(base.schema);
    // v2.5 migration: the old project-level Sketch drawer becomes a real node.
    if (base.sketch && Array.isArray(base.sketch.strokes) && base.sketch.strokes.length &&
        !base.nodes.some((node) => node && node.type === "sketch")) {
      base.nodes.push({
        id: uid("node"),
        type: "sketch",
        title: "Sketch",
        description: "",
        pseudo: "",
        rows: [],
        x: 240,
        y: 240,
        sketchStrokes: base.sketch.strokes
      });
    }
    delete base.sketch;

    base.connections.forEach((edge) => {
      if (!edge.id) edge.id = uid("edge");
      if (!Array.isArray(edge.points)) edge.points = [];
      edge.points = edge.points.filter((point) =>
        point && typeof point.x === "number" && typeof point.y === "number"
      ).map((point) => {
        const normalized = {
          id: point.id || uid("junction"),
          x: point.x,
          y: point.y
        };
        if (point.junctionLink && point.junctionLink.edgeId && point.junctionLink.pointId) {
          normalized.junctionLink = {
            edgeId: String(point.junctionLink.edgeId),
            pointId: String(point.junctionLink.pointId)
          };
          if (point.junctionAnchor === "from" || point.junctionAnchor === "to") {
            normalized.junctionAnchor = point.junctionAnchor;
          }
        }
        return normalized;
      });
    });
    base.nodes.forEach((node) => {
      if (!node.id) node.id = uid("node");

      // v2.17 migration: old enum-only Switch becomes a generic Switch.
      if (node.type === "enumSwitch") {
        const oldInput = Array.isArray(node.rows) ? node.rows.find((item) => item && item.kind === "input") : null;
        const oldCases = Array.isArray(node.rows)
          ? node.rows.filter((item) => item && item.kind === "flowOut" && String(item.label || "").toLowerCase() !== "default")
          : [];
        const oldDefault = Array.isArray(node.rows)
          ? node.rows.find((item) => item && item.kind === "flowOut" && String(item.label || "").toLowerCase() === "default")
          : null;
        node.type = "switch";
        node.switchValueType = node.switchEnumType || (oldInput && oldInput.value) || "int";
        node.switchCases = oldCases.map((item, index) => ({
          id: item.id || uid("switch_case"),
          value: item.label || String(index)
        }));
        node.switchDefaultRowId = oldDefault && oldDefault.id ? oldDefault.id : uid("switch_default");
        if (node.title === "Switch Enum") node.title = "Switch";
        delete node.switchEnumType;
      }

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
    const validNodeIds = new Set(base.nodes.map((node) => node.id));
    base.groups = base.groups
      .filter((group) => group && typeof group === "object")
      .map((group, index) => ({
        id: group.id || uid("group"),
        title: typeof group.title === "string" && group.title.trim() ? group.title : "Gruppo " + (index + 1),
        nodeIds: Array.from(new Set(Array.isArray(group.nodeIds) ? group.nodeIds.filter((id) => validNodeIds.has(id)) : []))
      }))
      .filter((group) => group.nodeIds.length);

    if (typeof base.name !== "string") base.name = "Untitled Flow";
    return base;
  }

  function cloneProjectData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readProjectLibrary() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROJECT_LIBRARY_KEY) || "null");
      if (saved && Array.isArray(saved.projects)) {
        return saved.projects
          .filter((entry) => entry && entry.id && entry.data)
          .map((entry) => ({
            id: String(entry.id),
            name: String(entry.name || entry.data.name || "Untitled Flow"),
            updatedAt: Number(entry.updatedAt) || Date.now(),
            createdAt: Number(entry.createdAt) || Number(entry.updatedAt) || Date.now(),
            sharedProjectId: entry.sharedProjectId ? String(entry.sharedProjectId) : "",
            sharedRole: entry.sharedRole ? String(entry.sharedRole) : "",
            ownerId: entry.ownerId ? String(entry.ownerId) : "",
            ownerName: entry.ownerName ? String(entry.ownerName) : "",
            ownerEmail: entry.ownerEmail ? String(entry.ownerEmail) : "",
            data: normalizeProject(entry.data)
          }));
      }
    } catch (error) {
      console.warn("ProjectFlow: impossibile leggere la libreria progetti.", error);
    }
    return [];
  }

  function persistProjectLibrary() {
    localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify({
      version: 1,
      projects: projectLibrary
    }));
  }

  function migrateLegacyProject(projects) {
    if (projects.length) return projects;

    let legacy = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) legacy = normalizeProject(JSON.parse(saved));
    } catch (error) {}

    const data = legacy || sampleProject();
    const now = Date.now();
    const entry = {
      id: uid("project"),
      name: data.name || "Game Systems — Concept",
      createdAt: now,
      updatedAt: now,
      data: normalizeProject(data)
    };

    projects.push(entry);
    localStorage.setItem(ACTIVE_PROJECT_KEY, entry.id);
    localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify({
      version: 1,
      projects: projects
    }));
    return projects;
  }

  let projectLibrary = migrateLegacyProject(readProjectLibrary());

  function resolveActiveProjectId() {
    const savedId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (savedId && projectLibrary.some((entry) => entry.id === savedId)) return savedId;
    return projectLibrary[0] ? projectLibrary[0].id : "";
  }

  let currentProjectId = resolveActiveProjectId();

  function projectRecordById(id) {
    return projectLibrary.find((entry) => entry.id === id) || null;
  }

  function loadProject() {
    const record = projectRecordById(currentProjectId);
    if (record) return normalizeProject(cloneProjectData(record.data));
    return blankProject();
  }

  function upsertLocalProject(data, id, options) {
    const now = Date.now();
    const opts = options || {};
    const projectId = id || uid("project");
    let record = projectRecordById(projectId);

    if (!record) {
      record = {
        id: projectId,
        name: data.name || "Untitled Flow",
        createdAt: opts.createdAt || now,
        updatedAt: Number(opts.updatedAt) || now,
        sharedProjectId: opts.sharedProjectId || "",
        sharedRole: opts.sharedRole || "",
        ownerId: opts.ownerId || "",
        ownerName: opts.ownerName || "",
        ownerEmail: opts.ownerEmail || "",
        data: normalizeProject(cloneProjectData(data))
      };
      projectLibrary.unshift(record);
    } else {
      record.name = data.name || "Untitled Flow";
      record.updatedAt = Number(opts.updatedAt) || now;
      record.data = normalizeProject(cloneProjectData(data));
      if (opts.sharedProjectId !== undefined) record.sharedProjectId = opts.sharedProjectId || "";
      if (opts.sharedRole !== undefined) record.sharedRole = opts.sharedRole || "";
      if (opts.ownerId !== undefined) record.ownerId = opts.ownerId || "";
      if (opts.ownerName !== undefined) record.ownerName = opts.ownerName || "";
      if (opts.ownerEmail !== undefined) record.ownerEmail = opts.ownerEmail || "";
    }

    persistProjectLibrary();
    return record;
  }

  function removeLocalProject(id) {
    projectLibrary = projectLibrary.filter((entry) => entry.id !== id);
    persistProjectLibrary();
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

  function loadMinimapSize() {
    try {
      const saved = JSON.parse(localStorage.getItem(MINIMAP_SIZE_KEY) || "null");
      if (saved && typeof saved.width === "number" && typeof saved.height === "number") {
        return {
          width: Math.max(220, Math.min(520, saved.width)),
          height: Math.max(160, Math.min(380, saved.height))
        };
      }
    } catch (error) {}
    return { width: 262, height: 196 };
  }

  rootProject = loadProject();
  project = rootProject;
  let graphWorkspaceStack = [];
  let currentWorkspaceLabel = "";
  let view = loadView();
  let minimapSize = loadMinimapSize();
  let selectedNodeId = null;
  let selectedNodeIds = new Set();
  let selectedEdgeId = null;
  let selectedTypeRelationId = null;
  let selectedJunctionIds = new Set();
  let selectedGroupId = null;
  let pendingPort = null;
  let pendingJunction = null;
  let junctionClickSuppressKey = "";
  let junctionClickSuppressUntil = 0;
  let dragState = null;
  let groupDrag = null;
  let junctionDrag = null;
  let forceConnectionsVisible = localStorage.getItem(FORCE_CONNECTIONS_KEY) === "1";
  let marqueeState = null;
  let minimapProjection = null;
  let minimapDrag = false;
  let minimapResizeState = null;
  let activeBlockFanCategory = "";
  let panelResizeState = null;
  let inspectorVisible = false;
  let panState = null;
  let saveTimer = null;
  let toastTimer = null;
  const GEMINI_MODEL_ID = "gemini-3.8-flash";
  const GEMINI_COMPAT_MODEL_ID = "gemini-3.5-flash";
  let geminiModel = null;
  let geminiModelPromise = null;
  let geminiRelaxedModel = null;
  let geminiBareModel = null;
  let geminiCompatModel = null;
  let zoomSharpTimer = null;
  let interactionFrame = null;
  let interactionNeedsGroups = false;
  let interactionNeedsMinimap = false;
  let minimapRenderTimer = null;
  let viewSaveTimer = null;
  let presencePointerFrame = null;
  let presencePointerClient = null;
  let connectMode = false;

  const historyState = {
    entries: [],
    index: -1,
    timer: null,
    restoring: false,
    limit: 120
  };

  const cloudState = {
    configured: !!(window.PROJECTFLOW_FIREBASE_CONFIG && window.PROJECTFLOW_FIREBASE_CONFIG.projectId),
    ready: false,
    loadingPromise: null,
    app: null,
    user: null,
    auth: null,
    db: null,
    provider: null,
    api: null,
    saveTimer: null,
    accountAnchor: null,
    sharedProjectId: "",
    sharedProjectUnsubscribe: null,
    presenceUnsubscribe: null,
    presenceHeartbeat: null,
    presenceWriteTimer: null,
    presenceCursor: null,
    presenceActivity: "Attivo",
    presencePreview: null,
    presencePreviewClearTimer: null,
    presenceLastWrite: 0,
    remotePresence: new Map(),
    applyingRemote: false,
    sharedMeta: null
  };

  function historySnapshot() {
    return JSON.stringify(rootProject || project);
  }

  function updateHistoryUI() {
    const undoButton = $("undoAction");
    const redoButton = $("redoAction");
    if (undoButton) undoButton.disabled = historyState.index <= 0;
    if (redoButton) redoButton.disabled = historyState.index < 0 || historyState.index >= historyState.entries.length - 1;
  }

  function resetHistory() {
    clearTimeout(historyState.timer);
    historyState.timer = null;
    historyState.entries = [historySnapshot()];
    historyState.index = 0;
    historyState.restoring = false;
    updateHistoryUI();
  }

  function commitHistoryCheckpoint() {
    clearTimeout(historyState.timer);
    historyState.timer = null;
    if (historyState.restoring) return;

    const snapshot = historySnapshot();
    const current = historyState.index >= 0 ? historyState.entries[historyState.index] : null;
    if (snapshot === current) {
      updateHistoryUI();
      return;
    }

    if (historyState.index < historyState.entries.length - 1) {
      historyState.entries = historyState.entries.slice(0, historyState.index + 1);
    }

    historyState.entries.push(snapshot);
    if (historyState.entries.length > historyState.limit) {
      historyState.entries.shift();
    }
    historyState.index = historyState.entries.length - 1;
    updateHistoryUI();
  }

  function scheduleHistoryCheckpoint() {
    if (historyState.restoring) return;
    clearTimeout(historyState.timer);
    historyState.timer = setTimeout(commitHistoryCheckpoint, 500);
  }

  function flushHistoryCheckpoint() {
    if (!historyState.timer) return;
    clearTimeout(historyState.timer);
    historyState.timer = null;
    commitHistoryCheckpoint();
  }

  function restoreHistoryAt(index, message) {
    if (index < 0 || index >= historyState.entries.length) return;
    clearTimeout(historyState.timer);
    historyState.timer = null;
    clearTimeout(saveTimer);

    historyState.restoring = true;
    try {
      setProjectDocument(normalizeProject(JSON.parse(historyState.entries[index])));
      historyState.index = index;
      resetEditorSelection();
      $("projectName").value = rootProject.name || "Untitled Flow";
      render();
      saveProject(false);
    } finally {
      historyState.restoring = false;
    }

    updateHistoryUI();
    if (message) showToast(message);
  }

  function undoProjectChange() {
    flushHistoryCheckpoint();
    if (historyState.index <= 0) {
      updateHistoryUI();
      return;
    }
    restoreHistoryAt(historyState.index - 1, "Annullato");
  }

  function redoProjectChange() {
    flushHistoryCheckpoint();
    if (historyState.index < 0 || historyState.index >= historyState.entries.length - 1) {
      updateHistoryUI();
      return;
    }
    restoreHistoryAt(historyState.index + 1, "Ripristinato");
  }

  function setAutosaveState(state, label) {
    const indicator = $("editorAutosaveIndicator");
    if (!indicator) return;
    indicator.classList.remove("saving", "saved", "cloud", "error");
    indicator.classList.add(state || "saved");
    const copy = indicator.querySelector("span:last-child");
    if (copy) copy.textContent = label || (state === "saving" ? "Salvataggio…" : "Autosave");
  }

  function showProjectLoading(title, detail) {
    const overlay = $("projectLoadingOverlay");
    if (!overlay) return performance.now();
    $("projectLoadingTitle").textContent = title || "Apertura progetto…";
    $("projectLoadingDetail").textContent = detail || "Preparazione blocchi, connessioni e viewport";
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    return performance.now();
  }

  function hideProjectLoading(startTime) {
    const overlay = $("projectLoadingOverlay");
    if (!overlay) return;
    const elapsed = performance.now() - (startTime || 0);
    const wait = Math.max(0, 420 - elapsed);
    setTimeout(() => {
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden", "true");
    }, wait);
  }

  async function withProjectLoading(title, task, detail) {
    const started = showProjectLoading(title, detail);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      return await task();
    } finally {
      hideProjectLoading(started);
    }
  }

  function closeInterfaceSurfaces(except) {
    const closeSurface = (surface) => {
      if (!surface || surface === except) return;
      surface.classList.remove("open");
      surface.classList.remove("show");
      surface.setAttribute("aria-hidden", "true");
      surface.style.marginLeft = "";
      surface.style.marginTop = "";
      if (surface.id === "newBlockPalette") closeNewBlockFan();
      if (typeof surface._resetFanPopup === "function") surface._resetFanPopup();
      if (typeof surface._resetTypePicker === "function") surface._resetTypePicker();
    };

    closeSurface($("accountMenu"));
    closeSurface($("newBlockPalette"));
    closeSurface($("sharePanel"));
    if ($("aiBuilderPanel") && except !== $("aiBuilderPanel")) closeAiBuilderPanel();
    if ($("addObjectTop")) $("addObjectTop").setAttribute("aria-expanded", "false");
    if ($("shareProjectButton")) $("shareProjectButton").setAttribute("aria-expanded", "false");
    if ($("aiBuilderButton")) $("aiBuilderButton").setAttribute("aria-expanded", "false");
    document.querySelectorAll(".section-add-popup.open, .type-picker-popup.open").forEach(closeSurface);

    if ($("editorAuthButton") && except !== $("accountMenu")) {
      $("editorAuthButton").setAttribute("aria-expanded", "false");
    }
  }

  function keepSurfaceInViewport(surface, padding) {
    if (!surface) return;
    const safe = Number(padding) || 12;
    surface.style.marginLeft = "";
    surface.style.marginTop = "";

    requestAnimationFrame(() => {
      const rect = surface.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (rect.left < safe) dx += safe - rect.left;
      if (rect.right > window.innerWidth - safe) dx -= rect.right - (window.innerWidth - safe);
      if (rect.top < safe) dy += safe - rect.top;
      if (rect.bottom > window.innerHeight - safe) dy -= rect.bottom - (window.innerHeight - safe);

      const scale = surface.closest(".world") ? Math.max(0.01, view.scale) : 1;
      if (dx) surface.style.marginLeft = (dx / scale) + "px";
      if (dy) surface.style.marginTop = (dy / scale) + "px";
    });
  }

  function positionAccountMenu(anchor) {
    const menu = $("accountMenu");
    if (!menu || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    menu.style.left = "0px";
    menu.style.top = "0px";
    menu.classList.add("open");
    menu.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      const left = Math.max(12, Math.min(window.innerWidth - menuRect.width - 12, rect.right - menuRect.width));
      const topCandidate = rect.bottom + 8;
      const top = topCandidate + menuRect.height <= window.innerHeight - 12
        ? topCandidate
        : Math.max(12, rect.top - menuRect.height - 8);
      menu.style.left = Math.round(left) + "px";
      menu.style.top = Math.round(top) + "px";
    });
  }

  function closeAccountMenu() {
    const menu = $("accountMenu");
    if (!menu) return;
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    if ($("editorAuthButton")) $("editorAuthButton").setAttribute("aria-expanded", "false");
    cloudState.accountAnchor = null;
  }

  $("projectName").value = project.name;

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

  function groupById(id) {
    return Array.isArray(project.groups) ? project.groups.find((group) => group.id === id) || null : null;
  }

  function groupWorldBounds(group) {
    if (!group || !Array.isArray(group.nodeIds) || !group.nodeIds.length) return null;
    const members = group.nodeIds.map(nodeById).filter(Boolean);
    if (!members.length) return null;

    const paddingX = 34;
    const paddingBottom = 34;
    const headerSpace = 54;
    const minX = Math.min.apply(null, members.map((node) => node.x));
    const minY = Math.min.apply(null, members.map((node) => node.y));
    const maxX = Math.max.apply(null, members.map((node) => {
      const el = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
      return node.x + (el ? el.offsetWidth : nodeWidthFor(node));
    }));
    const maxY = Math.max.apply(null, members.map((node) => {
      const el = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
      return node.y + (el ? el.offsetHeight : 220);
    }));

    return {
      x: minX - paddingX,
      y: minY - headerSpace,
      width: Math.max(180, maxX - minX + paddingX * 2),
      height: Math.max(120, maxY - minY + headerSpace + paddingBottom)
    };
  }

  function updateGroupActionUI() {
    const button = $("createGroup");
    const label = $("groupActionLabel");
    if (!button || !label) return;
    const hasGroup = !!(selectedGroupId && groupById(selectedGroupId));
    label.textContent = hasGroup ? "Disgruppa" : "Raggruppa";
    button.classList.toggle("ungroup", hasGroup);
    button.disabled = !hasGroup && selectedNodeIds.size < 2;
    button.title = hasGroup
      ? "Disgruppa mantenendo i blocchi nel canvas"
      : "Raggruppa i blocchi selezionati (Ctrl/Cmd+G)";
  }

  function applyGroupSelection(groupId, rerenderGroupLayer) {
    const group = groupById(groupId);
    if (!group) return;
    selectedGroupId = group.id;
    selectedNodeIds = new Set(group.nodeIds.filter((id) => !!nodeById(id)));
    syncPrimarySelection();
    selectedEdgeId = null;
    selectedTypeRelationId = null;
    selectedJunctionIds.clear();
    updateGroupActionUI();

    if (rerenderGroupLayer !== false) {
      renderNodes();
    } else {
      nodeLayer.querySelectorAll(".flow-node").forEach((element) => {
        element.classList.toggle("selected", selectedNodeIds.has(element.dataset.nodeId));
      });
      groupLayer.querySelectorAll(".graph-group").forEach((element) => {
        element.classList.toggle("selected", element.dataset.groupId === group.id);
      });
    }

    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function selectGroup(groupId) {
    applyGroupSelection(groupId, true);
  }

  function removeGroup(groupId) {
    if (!Array.isArray(project.groups)) return;
    project.groups = project.groups.filter((group) => group.id !== groupId);
    if (selectedGroupId === groupId) selectedGroupId = null;
    updateGroupActionUI();
    renderGroups();
    renderInspector();
    renderMinimap();
    markDirty();
    showToast("Gruppo rimosso · i blocchi restano nel canvas");
  }

  function renderGroups() {
    if (!groupLayer) return;
    groupLayer.innerHTML = "";
    if (!Array.isArray(project.groups)) project.groups = [];

    project.groups = project.groups.filter((group) => {
      group.nodeIds = Array.isArray(group.nodeIds) ? group.nodeIds.filter((id) => !!nodeById(id)) : [];
      return group.nodeIds.length > 0;
    });

    (project.groups || []).forEach((group) => {
      const bounds = groupWorldBounds(group);
      if (!bounds) return;

      const frame = document.createElement("div");
      frame.className = "graph-group" + (selectedGroupId === group.id ? " selected" : "");
      frame.dataset.groupId = group.id;
      frame.style.left = Math.round(bounds.x) + "px";
      frame.style.top = Math.round(bounds.y) + "px";
      frame.style.width = Math.round(bounds.width) + "px";
      frame.style.height = Math.round(bounds.height) + "px";

      const header = document.createElement("div");
      header.className = "graph-group-header";
      header.title = "Clicca la fascia superiore per rinominare";

      const title = document.createElement("input");
      title.className = "graph-group-title";
      title.value = group.title || "Gruppo";
      title.title = "Clicca per modificare il nome del gruppo";
      title.setAttribute("aria-label", "Nome gruppo");
      title.spellcheck = false;

      const beginTitleEdit = (selectAll) => {
        if (selectedGroupId !== group.id) applyGroupSelection(group.id, false);
        requestAnimationFrame(() => {
          title.focus({ preventScroll: true });
          if (selectAll) title.select();
        });
      };

      title.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        if (selectedGroupId !== group.id) beginTitleEdit(false);
      });
      title.addEventListener("click", (event) => {
        event.stopPropagation();
        beginTitleEdit(false);
      });
      title.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        beginTitleEdit(true);
      });
      title.addEventListener("input", () => {
        group.title = title.value || "Gruppo";
        markDirty();
      });
      title.addEventListener("blur", () => {
        if (!title.value.trim()) {
          title.value = "Gruppo";
          group.title = "Gruppo";
          markDirty();
        }
      });
      title.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          title.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          title.value = group.title || "Gruppo";
          title.blur();
        }
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "graph-group-remove";
      remove.textContent = "×";
      remove.title = "Disgruppa";
      remove.addEventListener("pointerdown", (event) => event.stopPropagation());
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeGroup(group.id);
      });

      header.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest("input") || event.target.closest("button")) return;
        event.preventDefault();
        event.stopPropagation();
        beginTitleEdit(true);
      });

      header.addEventListener("dblclick", (event) => {
        if (event.target.closest("button")) return;
        event.preventDefault();
        event.stopPropagation();
        beginTitleEdit(true);
      });

      const dragZones = ["top", "right", "bottom", "left"].map((side) => {
        const zone = document.createElement("span");
        zone.className = "graph-group-drag-zone " + side;
        zone.title = "Trascina l'intero gruppo";
        zone.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          if (selectedGroupId !== group.id) applyGroupSelection(group.id, false);
          if (zone.setPointerCapture) {
            try { zone.setPointerCapture(event.pointerId); } catch (error) {}
          }
          startGroupDrag(event, group.id);
        });
        return zone;
      });

      header.append(title, remove);
      frame.append(header, ...dragZones);
      groupLayer.appendChild(frame);
    });

    updateGroupActionUI();
  }

  function createGroupFromSelection() {
    const ids = Array.from(selectedNodeIds).filter((id) => !!nodeById(id));
    if (ids.length < 2) {
      showToast("Seleziona almeno 2 blocchi per creare un gruppo");
      return;
    }

    const selected = new Set(ids);
    (project.groups || []).forEach((group) => {
      group.nodeIds = group.nodeIds.filter((id) => !selected.has(id));
    });
    project.groups = project.groups.filter((group) => group.nodeIds.length);

    const group = {
      id: uid("group"),
      title: "Nuovo gruppo",
      nodeIds: ids
    };
    project.groups.push(group);
    selectedGroupId = group.id;
    selectedEdgeId = null;
    selectedJunctionIds.clear();
    renderNodes();
    renderInspector();
    renderMinimap();
    markDirty();

    requestAnimationFrame(() => {
      const input = groupLayer.querySelector('[data-group-id="' + group.id + '"] .graph-group-title');
      if (input) {
        input.focus();
        input.select();
      }
    });
    showToast("Gruppo creato · scrivi il nome nell'intestazione");
  }

  function toggleGrouping() {
    if (selectedGroupId && groupById(selectedGroupId)) {
      removeGroup(selectedGroupId);
      return;
    }
    createGroupFromSelection();
  }

  function startGroupDrag(event, groupId) {
    const group = groupById(groupId);
    broadcastActivity("Sposta gruppo " + (group && group.title ? group.title : ""));
    if (!group) return;
    const start = screenToWorld(event.clientX, event.clientY);
    const startBounds = groupWorldBounds(group);
    const groupNodeIds = new Set(group.nodeIds);
    const junctionStarts = [];

    project.connections.forEach((edge) => {
      const bothInside = groupNodeIds.has(edge.from.nodeId) && groupNodeIds.has(edge.to.nodeId);
      (edge.points || []).forEach((edgePoint) => {
        if (edgePoint.junctionLink) return;
        const insideFrame = startBounds &&
          edgePoint.x >= startBounds.x &&
          edgePoint.x <= startBounds.x + startBounds.width &&
          edgePoint.y >= startBounds.y &&
          edgePoint.y <= startBounds.y + startBounds.height;
        if (bothInside || insideFrame) {
          junctionStarts.push({
            edgeId: edge.id,
            pointId: edgePoint.id,
            x: edgePoint.x,
            y: edgePoint.y
          });
        }
      });
    });

    groupDrag = {
      groupId: groupId,
      startX: start.x,
      startY: start.y,
      starts: group.nodeIds.map(nodeById).filter(Boolean).map((node) => ({ id: node.id, x: node.x, y: node.y })),
      junctionStarts: junctionStarts
    };
    window.addEventListener("pointermove", moveGroup);
    window.addEventListener("pointerup", endGroupDrag, { once: true });
  }

  function moveGroup(event) {
    if (!groupDrag) return;
    const point = screenToWorld(event.clientX, event.clientY);
    const dx = point.x - groupDrag.startX;
    const dy = point.y - groupDrag.startY;

    groupDrag.starts.forEach((startNode) => {
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

    (groupDrag.junctionStarts || []).forEach((startPoint) => {
      const edge = project.connections.find((item) => item.id === startPoint.edgeId);
      const edgePoint = edge && Array.isArray(edge.points)
        ? edge.points.find((item) => item.id === startPoint.pointId)
        : null;
      if (!edgePoint) return;
      edgePoint.x = Math.round(startPoint.x + dx);
      edgePoint.y = Math.round(startPoint.y + dy);
    });
    syncLinkedJunctionPoints();

    const group = groupById(groupDrag.groupId);
    broadcastDragPreview(group ? group.nodeIds.map(nodeById).filter(Boolean) : [], "Sposta gruppo");
    scheduleInteractionRender(true, true);
  }

  function endGroupDrag() {
    window.removeEventListener("pointermove", moveGroup);
    if (!groupDrag) return;
    groupDrag = null;
    if (interactionFrame) {
      cancelAnimationFrame(interactionFrame);
      interactionFrame = null;
      interactionNeedsGroups = false;
      interactionNeedsMinimap = false;
    }
    renderGroups();
    renderEdges();
    renderMinimap();
    markDirty();
    finishDragPreview();
  }

  function projectStats(data) {
    const nodes = Array.isArray(data && data.nodes) ? data.nodes.length : 0;
    const connections = Array.isArray(data && data.connections) ? data.connections.length : 0;
    const classes = Array.isArray(data && data.nodes)
      ? data.nodes.filter((node) => node.type === "class" || node.type === "object").length
      : 0;
    return { nodes, connections, classes };
  }

  function formatProjectDate(timestamp) {
    try {
      return new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(timestamp));
    } catch (error) {
      return "";
    }
  }

  function setActiveProjectId(id) {
    currentProjectId = id || "";
    if (currentProjectId) localStorage.setItem(ACTIVE_PROJECT_KEY, currentProjectId);
    else localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }

  function resetEditorSelection() {
    selectedNodeIds.clear();
    selectedNodeId = null;
    selectedEdgeId = null;
    selectedJunctionIds.clear();
    selectedGroupId = null;
    pendingPort = null;
    pendingJunction = null;
    $("connectionBanner").classList.remove("show");
  }

  function setProjectDocument(nextProject) {
    rootProject = normalizeProject(nextProject || blankProject());
    project = rootProject;
    graphWorkspaceStack = [];
    currentWorkspaceLabel = "";
    updateGraphBreadcrumb();
    return rootProject;
  }

  function normalizeNestedWorkspaceGraph(rawGraph, fallbackName) {
    const graph = rawGraph && typeof rawGraph === "object" ? rawGraph : {};
    if (typeof graph.name !== "string" || !graph.name) graph.name = fallbackName || "Nested Graph";
    graph.version = 1;
    graph.schema = normalizeProjectSchema((rootProject && rootProject.schema) || graph.schema || "unity");
    if (!Array.isArray(graph.nodes)) graph.nodes = [];
    if (!Array.isArray(graph.connections)) graph.connections = [];
    if (!Array.isArray(graph.groups)) graph.groups = [];

    graph.nodes = graph.nodes
      .filter((entry) => entry && typeof entry === "object")
      .map((entry, index) => {
        const legacyInlineAction = entry.type === "action" &&
          (!Array.isArray(entry.rows) || !entry.rows.length) &&
          typeof entry.x !== "number" &&
          typeof entry.y !== "number";
        if (!legacyInlineAction) return entry;

        const migrated = defaultNode("action", 430 + index * 470, 320);
        migrated.id = entry.id || migrated.id;
        migrated.title = entry.title || migrated.title;
        migrated.actionKind = entry.actionKind || migrated.actionKind;
        return migrated;
      });

    return normalizeProject(graph);
  }

  function boundaryNode(graph, id, type, title, x, y) {
    let node = graph.nodes.find((item) => item && item.id === id);
    if (!node) {
      node = {
        id,
        type,
        title,
        description: type === "graphInput" ? "Input del graph padre" : "Output verso il graph padre",
        pseudo: "",
        rows: [],
        x,
        y,
        boundaryLocked: true
      };
      graph.nodes.push(node);
    }
    node.type = type;
    node.title = title;
    node.boundaryLocked = true;
    if (typeof node.x !== "number") node.x = x;
    if (typeof node.y !== "number") node.y = y;
    if (!Array.isArray(node.rows)) node.rows = [];
    return node;
  }

  function boundaryRow(source, kind, fallbackLabel, valueOverride) {
    return {
      id: source.id,
      label: source.label || source.name || fallbackLabel,
      value: valueOverride !== undefined ? valueOverride : (source.value || source.dataType || ""),
      kind
    };
  }

  function syncFunctionNestedBoundaries(target, graph) {
    ensureFunctionSignature(target, target.access || target.methodAccess);
    const inputNode = boundaryNode(graph, "__graph_input__", "graphInput", "Function Inputs", 120, 280);
    const outputNode = boundaryNode(graph, "__graph_output__", "graphOutput", "Function Output", 1180, 280);

    inputNode.rows = [{ id: target.methodEntryPortId, label: "Entry", value: "", kind: "flowOut" }];
    target.methodParameters.forEach((parameter) => {
      if ((parameter.mode || "value") === "out") return;
      inputNode.rows.push(boundaryRow(parameter, "output", parameter.name || "value", parameterTypeKey(parameter)));
    });

    outputNode.rows = [{ id: target.methodExitPortId, label: "Return", value: "", kind: "flowIn" }];
    target.methodParameters.forEach((parameter) => {
      if (!["out", "ref"].includes(parameter.mode || "value")) return;
      outputNode.rows.push(boundaryRow(parameter, "input", parameter.name || "value", parameterTypeKey(parameter)));
    });
    if (target.returnType && target.returnType !== "void") {
      outputNode.rows.push({
        id: target.returnPortId,
        label: target.returnName || "result",
        value: nodeReturnTypeKey(target),
        kind: "input"
      });
    }

    const validInput = new Set(inputNode.rows.map((rowItem) => rowItem.id));
    const validOutput = new Set(outputNode.rows.map((rowItem) => rowItem.id));
    graph.connections = graph.connections.filter((edge) => {
      if (edge.from.nodeId === inputNode.id && !validInput.has(edge.from.rowId)) return false;
      if (edge.to.nodeId === outputNode.id && !validOutput.has(edge.to.rowId)) return false;
      return true;
    });
  }

  function syncEmptyNestedBoundaries(target, graph) {
    const inputNode = boundaryNode(graph, "__graph_input__", "graphInput", "Inputs", 120, 280);
    const outputNode = boundaryNode(graph, "__graph_output__", "graphOutput", "Outputs", 1180, 280);

    inputNode.rows = target.rows
      .filter((item) => item.kind === "flowIn" || item.kind === "input")
      .map((item) => boundaryRow(item, item.kind === "flowIn" ? "flowOut" : "output", "Input", item.value));

    outputNode.rows = target.rows
      .filter((item) => item.kind === "flowOut" || item.kind === "output")
      .map((item) => boundaryRow(item, item.kind === "flowOut" ? "flowIn" : "input", "Output", item.value));

    const validInput = new Set(inputNode.rows.map((rowItem) => rowItem.id));
    const validOutput = new Set(outputNode.rows.map((rowItem) => rowItem.id));
    graph.connections = graph.connections.filter((edge) => {
      if (edge.from.nodeId === inputNode.id && !validInput.has(edge.from.rowId)) return false;
      if (edge.to.nodeId === outputNode.id && !validOutput.has(edge.to.rowId)) return false;
      return true;
    });
  }

  function saveCurrentGraphView() {
    if (!project || project === rootProject) return;
    project.workspaceView = { x: view.x, y: view.y, scale: view.scale };
  }

  function openNestedGraph(target, kind, label) {
    let graph;
    if (kind === "function") {
      ensureFunctionSignature(target, target.access || target.methodAccess);
      target.methodBody = normalizeNestedWorkspaceGraph(target.methodBody, "Function Body");
      graph = target.methodBody;
      syncFunctionNestedBoundaries(target, graph);
    } else {
      ensureNodeMeta(target);
      target.nestedGraph = normalizeNestedWorkspaceGraph(target.nestedGraph, "Empty Body");
      graph = target.nestedGraph;
      syncEmptyNestedBoundaries(target, graph);
    }

    saveCurrentGraphView();
    graphWorkspaceStack.push({
      graph: project,
      label: currentWorkspaceLabel || (rootProject && rootProject.name) || "Project",
      view: { x: view.x, y: view.y, scale: view.scale }
    });

    project = graph;
    currentWorkspaceLabel = label || graph.name || "Nested Graph";
    const savedView = graph.workspaceView;
    view = savedView && typeof savedView.x === "number"
      ? { x: savedView.x, y: savedView.y, scale: savedView.scale || 1 }
      : { x: 70, y: 60, scale: 1 };

    closeInterfaceSurfaces();
    resetEditorSelection();
    updateGraphBreadcrumb();
    render();
    if (!savedView) requestAnimationFrame(() => fitView());
    markDirty();
  }

  function leaveNestedGraphTo(index) {
    if (!graphWorkspaceStack.length) return;
    saveCurrentGraphView();

    const targetIndex = Math.max(0, Math.min(index, graphWorkspaceStack.length - 1));
    const target = graphWorkspaceStack[targetIndex];
    project = target.graph;
    currentWorkspaceLabel = target.label;
    view = { x: target.view.x, y: target.view.y, scale: target.view.scale };
    graphWorkspaceStack = graphWorkspaceStack.slice(0, targetIndex);

    resetEditorSelection();
    updateGraphBreadcrumb();
    render();
  }

  function leaveNestedGraph() {
    if (!graphWorkspaceStack.length) return false;
    leaveNestedGraphTo(graphWorkspaceStack.length - 1);
    return true;
  }

  function updateGraphBackButton() {
    const button = $("backToProjects");
    if (!button) return;

    const label = button.querySelector("span");
    const nested = graphWorkspaceStack.length > 0;

    button.classList.toggle("nested-back", nested);
    if (nested) {
      const parentLabel = graphWorkspaceStack[graphWorkspaceStack.length - 1]?.label || "Graph padre";
      if (label) label.textContent = "Graph padre";
      button.title = "Esci dal Sub Graph e torna a " + parentLabel;
      button.setAttribute("aria-label", "Esci dal Sub Graph e torna al graph padre");
    } else {
      if (label) label.textContent = "Progetti";
      button.title = "Torna ai progetti";
      button.setAttribute("aria-label", "Torna ai progetti");
    }
  }

  function updateGraphBreadcrumb() {
    const nav = $("graphBreadcrumb");
    updateGraphBackButton();
    if (!nav) return;
    nav.innerHTML = "";

    if (!graphWorkspaceStack.length) {
      nav.classList.add("hidden");
      return;
    }

    nav.classList.remove("hidden");
    const crumbs = graphWorkspaceStack.map((entry) => entry.label).concat([currentWorkspaceLabel || project.name || "Nested Graph"]);
    crumbs.forEach((label, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "graph-breadcrumb-separator";
        sep.textContent = "›";
        nav.appendChild(sep);
      }

      if (index < crumbs.length - 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => leaveNestedGraphTo(index));
        nav.appendChild(button);
      } else {
        const current = document.createElement("strong");
        current.textContent = label;
        nav.appendChild(current);
      }
    });
  }

  const SITE_PAGE_NAMES = new Set(["home", "projects", "guide", "about", "privacy"]);
  let currentSitePage = "home";

  function normalizedSitePage(name) {
    return SITE_PAGE_NAMES.has(name) ? name : "home";
  }

  function updateSiteNavigation(pageName) {
    document.querySelectorAll("[data-site-page-target]").forEach((control) => {
      const active = control.dataset.sitePageTarget === pageName;
      control.classList.toggle("active", active);
      if (active) control.setAttribute("aria-current", "page");
      else control.removeAttribute("aria-current");
    });
  }

  function navigateSitePage(name, options) {
    const opts = options || {};
    const pageName = normalizedSitePage(name);
    const next = document.querySelector('[data-site-page="' + pageName + '"]');
    if (!next) return;

    const current = document.querySelector(".site-page.active");
    currentSitePage = pageName;

    if (current && current !== next) {
      current.classList.remove("active", "page-entering");
      current.classList.add("page-leaving");
      setTimeout(() => {
        current.hidden = true;
        current.classList.remove("page-leaving");
      }, 150);
    }

    next.hidden = false;
    next.classList.remove("page-leaving", "page-entering", "active");
    void next.offsetWidth;
    next.classList.add("active", "page-entering");
    setTimeout(() => next.classList.remove("page-entering"), 320);

    updateSiteNavigation(pageName);
    if (pageName === "projects") renderProjectLibrary();

    if (opts.updateHash !== false) {
      const hash = "#" + pageName;
      if (window.location.hash !== hash) {
        if (opts.replaceHash) history.replaceState(null, "", hash);
        else history.pushState(null, "", hash);
      }
    }

    if (opts.scroll !== false) {
      window.scrollTo({ top: 0, behavior: opts.instant ? "auto" : "smooth" });
    }
  }

  function showProjectHome(pageName) {
    stopSharedProjectSession();
    const home = $("projectHome");
    const editor = $("editorView");
    if (home) home.classList.remove("hidden");
    if (editor) editor.classList.add("hidden");
    document.body.classList.add("home-mode");
    navigateSitePage(
      pageName || normalizedSitePage(window.location.hash.replace(/^#/, "")),
      { updateHash: true, replaceHash: !window.location.hash, instant: true }
    );
  }

  function canRenameCurrentProject() {
    const record = projectRecordById(currentProjectId);
    if (!record || !record.sharedProjectId) return true;
    if (record.sharedRole === "owner") return true;
    return !!(cloudState.user && record.ownerId && record.ownerId === cloudState.user.uid);
  }

  function updateProjectNameAccess() {
    const input = $("projectName");
    if (!input) return;
    const allowed = canRenameCurrentProject();
    input.readOnly = !allowed;
    input.classList.toggle("owner-locked", !allowed);
    input.title = allowed
      ? "Rinomina progetto"
      : "Solo il proprietario può rinominare questo progetto condiviso";
  }

  function showEditorView() {
    const home = $("projectHome");
    const editor = $("editorView");
    if (home) home.classList.add("hidden");
    if (editor) editor.classList.remove("hidden");
    document.body.classList.remove("home-mode");

    $("projectName").value = (rootProject || project).name || "Untitled Flow";
    updateProjectNameAccess();
    updateGraphBreadcrumb();
    resetHistory();
    requestAnimationFrame(() => {
      render();
    });
  }

  async function activateProject(id, fitAfterOpen) {
    const record = projectRecordById(id);
    if (!record) return;

    return withProjectLoading("Apertura di " + record.name, async () => {
      closeInterfaceSurfaces();
      setActiveProjectId(record.id);
      setProjectDocument(normalizeProject(cloneProjectData(record.data)));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rootProject));
      resetEditorSelection();
      showEditorView();
      if (record.sharedProjectId) startSharedProjectSession(record);
      else stopSharedProjectSession();
      renderSharePanel();

      if (fitAfterOpen !== false) {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        fitView();
      }
    });
  }

  function updateCreateProjectSchemaPreview() {
    const select = $("createProjectSchema");
    const note = $("createProjectSchemaNote");
    if (!select || !note) return;
    const meta = projectSchemaMeta(select.value);
    note.textContent = meta.description;
  }

  function openCreateProjectDialog() {
    const dialog = $("createProjectDialog");
    const nameInput = $("createProjectName");
    const schemaSelect = $("createProjectSchema");
    if (!dialog || !nameInput || !schemaSelect) return;

    nameInput.value = "Nuovo schema";
    schemaSelect.value = "unity";
    updateCreateProjectSchemaPreview();

    dialog.classList.add("show");
    dialog.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      nameInput.focus();
      nameInput.select();
    });
  }

  function closeCreateProjectDialog() {
    const dialog = $("createProjectDialog");
    if (!dialog) return;
    dialog.classList.remove("show");
    dialog.setAttribute("aria-hidden", "true");
  }

  async function createProjectFromDialog() {
    const nameInput = $("createProjectName");
    const schemaSelect = $("createProjectSchema");
    const name = (nameInput && nameInput.value.trim()) || "Nuovo schema";
    const schema = normalizeProjectSchema(schemaSelect ? schemaSelect.value : "unity");

    closeCreateProjectDialog();

    return withProjectLoading("Creazione " + name + "…", async () => {
      const data = blankProject(name, schema);
      const record = upsertLocalProject(data, uid("project"));
      setActiveProjectId(record.id);
      setProjectDocument(normalizeProject(cloneProjectData(record.data)));
      queueCloudSave(record);
      resetEditorSelection();
      showEditorView();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      fitView();
    }, "Preparazione canvas " + projectSchemaMeta(schema).label + " e autosave");
  }

  function createProjectFromHome() {
    openCreateProjectDialog();
  }

  async function openDemoProject() {
    return withProjectLoading("Caricamento Inventory Demo…", async () => {
      const demo = normalizeProject(cloneProjectData(sampleProject()));
      demo.name = "Inventory System — Demo";

      const record = upsertLocalProject(demo, uid("project"));
      setActiveProjectId(record.id);
      setProjectDocument(normalizeProject(cloneProjectData(record.data)));
      queueCloudSave(record);
      resetEditorSelection();
      showEditorView();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      fitView();
    }, "Creazione ItemType, ItemData, Inventory, flow pickup e UI");
  }

  function duplicateLibraryProject(id) {
    const source = projectRecordById(id);
    if (!source) return;
    const copy = normalizeProject(cloneProjectData(source.data));
    copy.name = (source.name || "Schema") + " — copia";
    const record = upsertLocalProject(copy, uid("project"));
    queueCloudSave(record);
    renderProjectLibrary();
  }

  function downloadProjectData(data) {
    const normalized = normalizeProject(cloneProjectData(data));
    const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (normalized.name || "projectflow").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    link.href = url;
    link.download = safeName + ".projectflow.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteLibraryProject(id) {
    const record = projectRecordById(id);
    if (!record) return;
    if (!confirm('Eliminare lo schema "' + record.name + '"?')) return;

    removeLocalProject(id);
    if (currentProjectId === id) {
      setActiveProjectId(projectLibrary[0] ? projectLibrary[0].id : "");
      setProjectDocument(currentProjectId
        ? normalizeProject(cloneProjectData(projectRecordById(currentProjectId).data))
        : blankProject());
    }

    await cloudDeleteProject(id);
    renderProjectLibrary();
  }

  function makeProjectCard(record) {
    const card = document.createElement("article");
    card.className = "project-card";
    card.dataset.projectId = record.id;

    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "project-card-preview";
    preview.title = "Apri " + record.name;

    const stats = projectStats(record.data);
    const glyphs = document.createElement("div");
    glyphs.className = "project-card-glyphs";
    const visibleNodes = (record.data.nodes || []).slice(0, 7);
    visibleNodes.forEach((node, index) => {
      const glyph = document.createElement("span");
      glyph.className = "project-preview-node";
      glyph.style.setProperty("--preview-accent", typeMeta(node.type).color);
      glyph.style.left = (12 + (index % 3) * 27 + ((index * 11) % 9)) + "%";
      glyph.style.top = (17 + Math.floor(index / 3) * 27 + ((index * 7) % 8)) + "%";
      glyphs.appendChild(glyph);
    });
    preview.appendChild(glyphs);
    preview.addEventListener("click", () => activateProject(record.id, true));

    const body = document.createElement("div");
    body.className = "project-card-body";

    const titleRow = document.createElement("div");
    titleRow.className = "project-card-title-row";
    const title = document.createElement("h3");
    title.textContent = record.name || "Untitled Flow";
    const localBadge = document.createElement("span");
    localBadge.className = "project-storage-badge";
    localBadge.textContent = record.sharedProjectId
      ? (record.sharedRole === "owner" ? "Condiviso" : "Condiviso con me")
      : (cloudState.user ? "Cloud" : "Local");
    titleRow.append(title, localBadge);

    const meta = document.createElement("p");
    meta.className = "project-card-meta";
    meta.textContent =
      projectSchemaMeta(record.data.schema).label + " · " +
      stats.nodes + " blocchi · " +
      stats.connections + " connessioni · " +
      formatProjectDate(record.updatedAt);

    const actions = document.createElement("div");
    actions.className = "project-card-actions";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "project-card-action primary";
    open.textContent = "Apri";
    open.addEventListener("click", () => activateProject(record.id, true));

    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.className = "project-card-action";
    duplicate.textContent = "Duplica";
    duplicate.addEventListener("click", () => duplicateLibraryProject(record.id));

    const download = document.createElement("button");
    download.type = "button";
    download.className = "project-card-action";
    download.textContent = "Esporta";
    download.addEventListener("click", () => downloadProjectData(record.data));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "project-card-action danger";
    remove.textContent = "Elimina";
    remove.addEventListener("click", () => deleteLibraryProject(record.id));

    actions.append(open, duplicate, download, remove);
    body.append(titleRow, meta, actions);
    card.append(preview, body);
    return card;
  }

  function renderProjectLibrary() {
    const grid = $("projectLibraryGrid");
    const empty = $("projectLibraryEmpty");
    const search = $("projectLibrarySearch");
    if (!grid || !empty) return;

    const query = (search ? search.value : "").trim().toLowerCase();
    const matches = projectLibrary
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((record) => !query || record.name.toLowerCase().includes(query));

    grid.innerHTML = "";
    matches.forEach((record) => grid.appendChild(makeProjectCard(record)));

    const noProjects = projectLibrary.length === 0;
    const noMatches = matches.length === 0;
    const createTopButton = $("createProjectProjects");

    empty.classList.toggle("hidden", !noProjects);
    grid.classList.toggle("empty-search", !noProjects && noMatches);
    if (createTopButton) createTopButton.hidden = noProjects;

    let noResults = $("projectLibraryNoResults");
    if (!noResults && grid.parentElement) {
      noResults = document.createElement("div");
      noResults.id = "projectLibraryNoResults";
      noResults.className = "project-library-no-results hidden";
      noResults.textContent = "Nessuno schema corrisponde alla ricerca.";
      grid.parentElement.appendChild(noResults);
    }
    if (noResults) noResults.classList.toggle("hidden", noProjects || !noMatches);
  }

  function importLibraryFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = normalizeProject(JSON.parse(reader.result));
        if (!imported.name || imported.name === "Untitled Flow") {
          imported.name = file.name.replace(/\.projectflow\.json$|\.json$/i, "") || "Schema importato";
        }
        const record = upsertLocalProject(imported, uid("project"));
        queueCloudSave(record);
        renderProjectLibrary();
      } catch (error) {
        alert("Il file non contiene un progetto ProjectFlow valido.");
      }
    };
    reader.readAsText(file);
  }

  function updateAccountUI() {
    const user = cloudState.user;
    const configured = cloudState.configured;
    const homeButton = $("homeAuthButton");
    const editorButton = $("editorAuthButton");
    const syncState = $("homeSyncState");
    const avatar = $("editorAccountAvatar");
    const label = $("editorAccountLabel");
    const menuAvatar = $("accountMenuAvatar");
    const menuName = $("accountMenuName");
    const menuEmail = $("accountMenuEmail");
    const menuDot = $("accountMenuSyncDot");
    const menuSync = $("accountMenuSyncText");
    const logout = $("accountLogout");
    const syncNow = $("accountSyncNow");

    if (syncState) {
      const dot = syncState.querySelector(".sync-dot");
      const copy = syncState.querySelector("span:last-child");
      if (dot) {
        dot.classList.toggle("cloud", !!user);
        dot.classList.toggle("local", !user);
      }
      if (copy) {
        copy.textContent = user
          ? "Cloud attivo · " + (user.displayName || user.email || "Google")
          : configured ? "Modalità locale" : "Salvataggio locale";
      }
    }

    if (homeButton) {
      const text = homeButton.querySelector("span:last-child");
      homeButton.classList.toggle("signed-in", !!user);
      if (text) text.textContent = user ? (user.displayName || "Account") : "Accedi con Google";
      homeButton.title = configured
        ? (user ? "Apri menu account" : "Accedi per sincronizzare i progetti")
        : "Configura Firebase per attivare Google login e cloud";
    }

    if (editorButton) {
      editorButton.classList.toggle("signed-in", !!user);
      if (label) label.textContent = user ? (user.displayName || "Account") : "Accedi";
      if (avatar) {
        const initial = user && (user.displayName || user.email)
          ? (user.displayName || user.email).trim().charAt(0).toUpperCase()
          : "G";
        const hasPhoto = !!(user && user.photoURL);
        avatar.textContent = hasPhoto ? "" : initial;
        avatar.classList.toggle("has-photo", hasPhoto);
        avatar.style.backgroundImage = hasPhoto ? 'url("' + user.photoURL + '")' : "";
      }
    }

    if (menuAvatar) {
      const initial = user && (user.displayName || user.email)
        ? (user.displayName || user.email).trim().charAt(0).toUpperCase()
        : "G";
      const hasPhoto = !!(user && user.photoURL);
      menuAvatar.textContent = hasPhoto ? "" : initial;
      menuAvatar.classList.toggle("has-photo", hasPhoto);
      menuAvatar.style.backgroundImage = hasPhoto ? 'url("' + user.photoURL + '")' : "";
    }
    if (menuName) menuName.textContent = user ? (user.displayName || "Account Google") : "Modalità locale";
    if (menuEmail) menuEmail.textContent = user ? (user.email || "Account Google") : "Nessun account collegato";
    if (menuDot) {
      menuDot.classList.toggle("cloud", !!user);
      menuDot.classList.toggle("local", !user);
    }
    if (menuSync) menuSync.textContent = user ? "Sincronizzazione Firebase attiva" : "Solo salvataggio locale";
    if (logout) logout.hidden = !user;
    if (syncNow) syncNow.disabled = !user;
  }

  async function initCloud(force) {
    updateAccountUI();
    if (!cloudState.configured) return false;
    if (cloudState.ready) return true;
    if (cloudState.loadingPromise) return cloudState.loadingPromise;

    const optedIn = localStorage.getItem(CLOUD_OPT_IN_KEY) === "1";
    if (!force && !optedIn) return false;

    cloudState.loadingPromise = (async () => {
      try {
        const base = "https://www.gstatic.com/firebasejs/" + FIREBASE_SDK_VERSION + "/";
        const [appApi, authApi, firestoreApi] = await Promise.all([
          import(base + "firebase-app.js"),
          import(base + "firebase-auth.js"),
          import(base + "firebase-firestore.js")
        ]);

        const firebaseApp = appApi.initializeApp(window.PROJECTFLOW_FIREBASE_CONFIG);
        const auth = authApi.getAuth(firebaseApp);
        const db = firestoreApi.getFirestore(firebaseApp);
        const provider = new authApi.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        cloudState.app = firebaseApp;
        cloudState.auth = auth;
        cloudState.db = db;
        cloudState.provider = provider;
        cloudState.api = Object.assign({}, authApi, firestoreApi);
        cloudState.ready = true;

        authApi.onAuthStateChanged(auth, async (user) => {
          cloudState.user = user || null;
          updateAccountUI();

          if (user) {
            localStorage.setItem(CLOUD_OPT_IN_KEY, "1");
            await mergeCloudLibrary();
            renderProjectLibrary();
            setAutosaveState("cloud", "Autosave · Cloud");
            if (sharedProjectIdFromLocation()) await openSharedProjectFromLink();
            renderSharePanel();
          } else {
            stopSharedProjectSession();
            setAutosaveState("saved", "Autosave");
            renderSharePanel();
          }
        });
        return true;
      } catch (error) {
        console.warn("ProjectFlow: Firebase non disponibile.", error);
        cloudState.ready = false;
        updateAccountUI();
        return false;
      } finally {
        cloudState.loadingPromise = null;
      }
    })();

    return cloudState.loadingPromise;
  }

  function authErrorMessage(error) {
    const code = error && error.code ? String(error.code) : "";
    if (code === "auth/configuration-not-found") {
      return (
        "Firebase Authentication non è ancora configurato per questo progetto.\n\n" +
        "Apri Firebase Console → projectflow-7ce02 → Authentication → Sign-in method → Google, " +
        "attiva il provider, scegli l'email di supporto e premi Salva."
      );
    }
    if (code === "auth/unauthorized-domain") {
      return (
        "Il dominio non è autorizzato per Firebase Authentication.\n\n" +
        "Aggiungi lorenzosoriano.github.io in Authentication → Settings → Authorized domains."
      );
    }
    if (code === "auth/popup-blocked") {
      return "Il browser ha bloccato il popup Google. Consenti i popup per questo sito e riprova.";
    }
    if (code === "auth/popup-closed-by-user") {
      return "Accesso annullato: la finestra Google è stata chiusa prima di completare il login.";
    }
    return "Accesso Google non riuscito: " + (error.message || code || "errore sconosciuto");
  }

  async function startGoogleLogin() {
    if (!cloudState.configured) {
      alert("Firebase non è configurato per il login Google.");
      return;
    }

    localStorage.setItem(CLOUD_OPT_IN_KEY, "1");
    const ready = await initCloud(true);
    if (!ready || !cloudState.api) {
      alert("Impossibile inizializzare Firebase.");
      return;
    }

    try {
      await cloudState.api.signInWithPopup(cloudState.auth, cloudState.provider);
    } catch (error) {
      console.warn("ProjectFlow: accesso Google non riuscito.", error);
      alert(authErrorMessage(error));
    }
  }

  async function logoutGoogleAuth() {
    if (!cloudState.user || !cloudState.api || !cloudState.auth) return;
    try {
      await cloudState.api.signOut(cloudState.auth);
      localStorage.removeItem(CLOUD_OPT_IN_KEY);
      closeAccountMenu();
      showToast("Logout completato · modalità locale");
    } catch (error) {
      console.warn("ProjectFlow: logout non riuscito.", error);
    }
  }

  async function handleAccountButton(anchor) {
    if (!cloudState.user) {
      await startGoogleLogin();
      return;
    }

    const menu = $("accountMenu");
    const alreadyOpen = menu && menu.classList.contains("open") && cloudState.accountAnchor === anchor;
    if (alreadyOpen) {
      closeAccountMenu();
      return;
    }

    closeInterfaceSurfaces(menu);
    cloudState.accountAnchor = anchor;
    updateAccountUI();
    positionAccountMenu(anchor);
    if (anchor === $("editorAuthButton")) anchor.setAttribute("aria-expanded", "true");
  }


  function inviteDocumentRef(email, projectId) {
    return cloudState.api.doc(
      cloudState.db,
      "shareInvites",
      normalizeShareEmail(email),
      "projects",
      projectId
    );
  }

  function ownerInviteDocumentRef(projectId, email) {
    return cloudState.api.doc(
      cloudState.db,
      "sharedProjects",
      projectId,
      "invites",
      encodeURIComponent(normalizeShareEmail(email))
    );
  }

  async function refreshSharePanelMeta() {
    const record = projectRecordById(currentProjectId);
    if (!cloudState.user || !record || !cloudState.api || !cloudState.db) {
      cloudState.sharedMeta = null;
      renderSharePanel();
      return;
    }

    if (!record.sharedProjectId) {
      cloudState.sharedMeta = {
        projectId: "",
        ownerId: cloudState.user.uid,
        ownerName: cloudState.user.displayName || "",
        ownerEmail: normalizeShareEmail(cloudState.user.email),
        invites: []
      };
      renderSharePanel();
      return;
    }

    try {
      const snapshot = await cloudState.api.getDoc(sharedProjectRef(record.sharedProjectId));
      if (!snapshot.exists()) {
        cloudState.sharedMeta = null;
        renderSharePanel();
        return;
      }

      const value = snapshot.data() || {};
      const meta = {
        projectId: snapshot.id,
        ownerId: value.ownerId || "",
        ownerName: value.ownerName || "",
        ownerEmail: value.ownerEmail || "",
        invites: []
      };

      if (meta.ownerId === cloudState.user.uid) {
        const inviteCollection = cloudState.api.collection(
          cloudState.db,
          "sharedProjects",
          snapshot.id,
          "invites"
        );
        const inviteSnapshot = await cloudState.api.getDocs(inviteCollection);
        inviteSnapshot.forEach((inviteDoc) => {
          const invite = inviteDoc.data() || {};
          if (invite.email) meta.invites.push({
            email: normalizeShareEmail(invite.email),
            createdAt: Number(invite.createdAt) || 0
          });
        });
        meta.invites.sort((a, b) => a.email.localeCompare(b.email));
      }

      cloudState.sharedMeta = meta;
      renderSharePanel();
    } catch (error) {
      console.warn("ProjectFlow: impossibile leggere i dati di condivisione.", error);
      renderSharePanel();
    }
  }

  function renderSharePanel() {
    const notice = $("shareLoginNotice");
    const controls = $("shareControls");
    const ownerCopy = $("shareOwnerCopy");
    const inviteField = $("shareInviteField");
    const memberList = $("shareMemberList");
    const copyButton = $("copyShareLink");
    if (!notice || !controls || !memberList) return;

    const record = projectRecordById(currentProjectId);
    const loggedIn = !!cloudState.user;
    notice.hidden = loggedIn;
    controls.hidden = !loggedIn;

    if (!loggedIn) {
      memberList.innerHTML = "";
      return;
    }

    const meta = cloudState.sharedMeta || {
      projectId: record && record.sharedProjectId || "",
      ownerId: record && record.ownerId || cloudState.user.uid,
      ownerName: record && record.ownerName || cloudState.user.displayName || "",
      ownerEmail: record && record.ownerEmail || normalizeShareEmail(cloudState.user.email),
      invites: []
    };
    const isOwner = !meta.ownerId || meta.ownerId === cloudState.user.uid;

    if (ownerCopy) {
      ownerCopy.textContent = isOwner
        ? (meta.projectId
          ? "Sei il proprietario. Gli inviti restano validi anche quando chiudi ProjectFlow."
          : "Il progetto non è ancora condiviso. Il primo invito creerà lo spazio collaborativo persistente.")
        : "Progetto di " + (meta.ownerName || meta.ownerEmail || "un altro utente") + ". Hai accesso come editor.";
    }

    if (inviteField) inviteField.hidden = !isOwner;
    if (copyButton) copyButton.hidden = !isOwner;

    memberList.innerHTML = "";
    const ownerRow = document.createElement("div");
    ownerRow.className = "share-member";
    const ownerAvatar = document.createElement("span");
    ownerAvatar.className = "share-member-avatar";
    ownerAvatar.textContent = (meta.ownerName || meta.ownerEmail || "P").trim().charAt(0).toUpperCase();
    const ownerText = document.createElement("span");
    ownerText.className = "share-member-copy";
    const ownerStrong = document.createElement("strong");
    ownerStrong.textContent = meta.ownerName || "Proprietario";
    const ownerSmall = document.createElement("small");
    ownerSmall.textContent = (meta.ownerEmail || "") + " · proprietario";
    ownerText.append(ownerStrong, ownerSmall);
    ownerRow.append(ownerAvatar, ownerText);
    memberList.appendChild(ownerRow);

    if (isOwner) {
      (meta.invites || []).forEach((invite) => {
        const row = document.createElement("div");
        row.className = "share-member";

        const avatar = document.createElement("span");
        avatar.className = "share-member-avatar";
        avatar.textContent = invite.email.charAt(0).toUpperCase();

        const copy = document.createElement("span");
        copy.className = "share-member-copy";
        const strong = document.createElement("strong");
        strong.textContent = invite.email;
        const small = document.createElement("small");
        small.textContent = "Editor invitato";
        copy.append(strong, small);

        const revoke = document.createElement("button");
        revoke.type = "button";
        revoke.textContent = "Revoca";
        revoke.addEventListener("click", () => revokeCollaborator(invite.email));

        row.append(avatar, copy, revoke);
        memberList.appendChild(row);
      });
    } else {
      const self = document.createElement("div");
      self.className = "share-member";
      const avatar = document.createElement("span");
      avatar.className = "share-member-avatar";
      avatar.textContent = (cloudState.user.displayName || cloudState.user.email || "T").trim().charAt(0).toUpperCase();
      const copy = document.createElement("span");
      copy.className = "share-member-copy";
      const strong = document.createElement("strong");
      strong.textContent = cloudState.user.displayName || "Tu";
      const small = document.createElement("small");
      small.textContent = normalizeShareEmail(cloudState.user.email) + " · editor";
      copy.append(strong, small);
      self.append(avatar, copy);
      memberList.appendChild(self);
    }
  }

  async function inviteCollaborator(emailValue) {
    const record = projectRecordById(currentProjectId);
    const email = normalizeShareEmail(emailValue);
    if (!record || !cloudState.user) {
      showToast("Accedi con Google per condividere");
      return;
    }
    if (!email || !email.includes("@")) {
      showToast("Inserisci un'email valida");
      return;
    }
    if (email === normalizeShareEmail(cloudState.user.email)) {
      showToast("Sei già il proprietario del progetto");
      return;
    }

    try {
      const ref = await ensureSharedProject(record);
      if (!ref) return;
      if (record.ownerId && record.ownerId !== cloudState.user.uid) {
        showToast("Solo il proprietario può invitare altri utenti");
        return;
      }

      const invitePayload = {
        projectId: record.sharedProjectId,
        email: email,
        ownerId: cloudState.user.uid,
        ownerName: cloudState.user.displayName || "",
        ownerEmail: normalizeShareEmail(cloudState.user.email),
        projectName: record.name,
        createdAt: Date.now()
      };

      await Promise.all([
        cloudState.api.setDoc(inviteDocumentRef(email, record.sharedProjectId), invitePayload, { merge: true }),
        cloudState.api.setDoc(ownerInviteDocumentRef(record.sharedProjectId, email), invitePayload, { merge: true })
      ]);

      record.sharedRole = "owner";
      record.ownerId = cloudState.user.uid;
      record.ownerName = cloudState.user.displayName || "";
      record.ownerEmail = normalizeShareEmail(cloudState.user.email);
      persistProjectLibrary();
      await refreshSharePanelMeta();
      startSharedProjectSession(record);
      showToast("Invito salvato per " + email);
    } catch (error) {
      console.warn("ProjectFlow: invito non riuscito.", error);
      const denied = error && (error.code === "permission-denied" || String(error.message || "").toLowerCase().includes("permission"));
      showToast(denied
        ? "Permesso Firebase negato · controlla e pubblica le Firestore Rules"
        : "Invito non riuscito · " + (error.code || "errore Firebase"));
    }
  }

  async function revokeCollaborator(emailValue) {
    const record = projectRecordById(currentProjectId);
    const email = normalizeShareEmail(emailValue);
    if (!record || !record.sharedProjectId || !cloudState.user) return;
    if (record.ownerId && record.ownerId !== cloudState.user.uid) return;

    try {
      await Promise.all([
        cloudState.api.deleteDoc(inviteDocumentRef(email, record.sharedProjectId)),
        cloudState.api.deleteDoc(ownerInviteDocumentRef(record.sharedProjectId, email))
      ]);
      await refreshSharePanelMeta();
      showToast("Accesso revocato a " + email);
    } catch (error) {
      console.warn("ProjectFlow: revoca non riuscita.", error);
      showToast("Revoca non riuscita");
    }
  }

  async function copyCurrentShareLink() {
    const record = projectRecordById(currentProjectId);
    if (!record || !cloudState.user) {
      showToast("Accedi con Google per condividere");
      return;
    }

    try {
      await ensureSharedProject(record);
      const url = new URL(window.location.href);
      url.searchParams.set("shared", record.sharedProjectId);
      url.hash = "";
      const text = url.toString();

      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch (clipboardError) {
          console.warn("ProjectFlow: Clipboard API non disponibile.", clipboardError);
        }
      }

      if (!copied) {
        const field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.left = "-9999px";
        document.body.appendChild(field);
        field.select();
        copied = document.execCommand("copy");
        field.remove();
      }

      await refreshSharePanelMeta();
      if (copied) showToast("Link copiato");
      else window.prompt("Copia questo link:", text);
    } catch (error) {
      console.warn("ProjectFlow: copia link non riuscita.", error);
      const denied = error && (error.code === "permission-denied" || String(error.message || "").toLowerCase().includes("permission"));
      showToast(denied
        ? "Permesso Firebase negato · pubblica le nuove Firestore Rules"
        : "Impossibile creare il link · " + (error.code || "errore Firebase"));
    }
  }

  function openSharePanel() {
    const panel = $("sharePanel");
    if (!panel) return;
    const willOpen = !panel.classList.contains("open");
    closeInterfaceSurfaces(willOpen ? panel : null);
    panel.classList.toggle("open", willOpen);
    panel.setAttribute("aria-hidden", willOpen ? "false" : "true");
    $("shareProjectButton").setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) refreshSharePanelMeta();
  }

  function renderRemotePresence() {
    const toolbar = $("collabPresence");
    if (toolbar) {
      toolbar.innerHTML = "";
      toolbar.hidden = true;
    }

    if (!cloudState.sharedProjectId || !cloudState.user) {
      if (collaborationLayer) collaborationLayer.innerHTML = "";
      nodeLayer.querySelectorAll(".remote-sketch-preview-canvas").forEach((canvas) => canvas.remove());
      return;
    }

    nodeLayer.querySelectorAll(".remote-sketch-preview-canvas").forEach((canvas) => {
      canvas.dataset.remoteSketchActive = "false";
    });

    const now = Date.now();
    const active = Array.from(cloudState.remotePresence.values())
      .filter((entry) => entry && entry.uid !== cloudState.user.uid && now - Number(entry.updatedAt || 0) < 45000);
    const activeKeys = new Set();

    const getPresenceElement = (key, className) => {
      if (!collaborationLayer) return null;
      let element = collaborationLayer.querySelector('[data-presence-key="' + key + '"]');
      if (!element) {
        element = document.createElement("div");
        element.dataset.presenceKey = key;
        element.className = className;
        collaborationLayer.appendChild(element);
      }
      activeKeys.add(key);
      return element;
    };

    active.forEach((entry) => {
      const userLabel = entry.name || entry.email || "Collaboratore";

      if (entry.cursor && typeof entry.cursor.x === "number" && typeof entry.cursor.y === "number") {
        const key = "cursor:" + entry.uid;
        const cursor = getPresenceElement(key, "remote-cursor");
        if (cursor) {
          cursor.style.left = entry.cursor.x + "px";
          cursor.style.top = entry.cursor.y + "px";
          if (!cursor.firstChild) {
            const pointer = document.createElement("span");
            pointer.className = "remote-cursor-pointer";
            const label = document.createElement("span");
            label.className = "remote-cursor-label";
            const activity = document.createElement("small");
            label.appendChild(activity);
            cursor.append(pointer, label);
          }
          const label = cursor.querySelector(".remote-cursor-label");
          const activity = cursor.querySelector("small");
          if (label) label.firstChild && label.firstChild.nodeType === Node.TEXT_NODE
            ? label.firstChild.nodeValue = userLabel
            : label.insertBefore(document.createTextNode(userLabel), label.firstChild);
          if (activity) activity.textContent = entry.activity || "Attivo";
        }
      }

      const preview = entry.preview;
      if (preview && preview.kind === "nodes" && Array.isArray(preview.positions) && now - Number(preview.updatedAt || entry.updatedAt || 0) < 5000) {
        preview.positions.forEach((position) => {
          const node = nodeById(position.id);
          if (!node || typeof position.x !== "number" || typeof position.y !== "number") return;
          const key = "preview:" + entry.uid + ":" + node.id;
          const ghost = getPresenceElement(key, "remote-node-preview");
          if (!ghost) return;
          const source = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
          ghost.style.left = position.x + "px";
          ghost.style.top = position.y + "px";
          ghost.style.width = (source ? source.offsetWidth : nodeWidthFor(node)) + "px";
          ghost.style.height = (source ? source.offsetHeight : 120) + "px";
          ghost.style.setProperty("--preview-accent", typeMeta(node.type).color);

          let title = ghost.querySelector(".remote-node-preview-title");
          if (!title) {
            title = document.createElement("span");
            title.className = "remote-node-preview-title";
            ghost.appendChild(title);
          }
          title.textContent = node.title || typeMeta(node.type).label;

          let by = ghost.querySelector(".remote-node-preview-user");
          if (!by) {
            by = document.createElement("span");
            by.className = "remote-node-preview-user";
            ghost.appendChild(by);
          }
          by.textContent = userLabel;
        });
      }

      if (preview && preview.kind === "sketch" && preview.nodeId && preview.stroke &&
          Array.isArray(preview.stroke.points) && preview.stroke.points.length > 1 &&
          now - Number(preview.updatedAt || entry.updatedAt || 0) < 5000) {
        const nodeElement = nodeLayer.querySelector('[data-node-id="' + preview.nodeId + '"]');
        const paper = nodeElement && nodeElement.querySelector(".node-sketch-paper");
        if (paper) {
          const key = "remote-sketch:" + entry.uid + ":" + preview.nodeId;
          let overlay = paper.querySelector('[data-remote-sketch-key="' + key + '"]');
          if (!overlay) {
            overlay = document.createElement("canvas");
            overlay.className = "remote-sketch-preview-canvas";
            overlay.dataset.remoteSketchKey = key;
            paper.appendChild(overlay);
          }

          const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
          const width = Math.max(1, Math.round(paper.clientWidth * ratio));
          const height = Math.max(1, Math.round(paper.clientHeight * ratio));
          if (overlay.width !== width || overlay.height !== height) {
            overlay.width = width;
            overlay.height = height;
          }

          const ctx = overlay.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            const stroke = preview.stroke;
            ctx.save();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = Math.max(1, (Number(stroke.size) || 3) * ratio);
            ctx.strokeStyle = stroke.mode === "erase"
              ? "rgba(199,96,102,.72)"
              : (stroke.color || "#52677c");
            if (stroke.mode === "erase") ctx.setLineDash([6 * ratio, 4 * ratio]);
            ctx.beginPath();
            const spaceWidth = Math.max(1, Number(stroke.spaceWidth) || paper.clientWidth);
            const spaceHeight = Math.max(1, Number(stroke.spaceHeight) || paper.clientHeight);
            stroke.points.forEach((point, index) => {
              const x = point.x * spaceWidth * ratio;
              const y = point.y * spaceHeight * ratio;
              if (index === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
          }
          overlay.dataset.remoteSketchActive = "true";
        }
      }

      if (toolbar) {
        const avatar = document.createElement("span");
        avatar.className = "collab-presence-avatar";
        avatar.textContent = userLabel.trim().charAt(0).toUpperCase();
        avatar.title = userLabel + " · " + (entry.activity || "Attivo");
        toolbar.appendChild(avatar);
      }
    });

    if (collaborationLayer) {
      collaborationLayer.querySelectorAll("[data-presence-key]").forEach((element) => {
        if (!activeKeys.has(element.dataset.presenceKey)) element.remove();
      });
    }
    nodeLayer.querySelectorAll(".remote-sketch-preview-canvas").forEach((canvas) => {
      if (canvas.dataset.remoteSketchActive !== "true") canvas.remove();
    });
    if (toolbar) toolbar.hidden = active.length === 0;
  }

  async function writePresenceNow() {
    if (!cloudState.sharedProjectId || !cloudState.user || !cloudState.api || !cloudState.db) return;
    clearTimeout(cloudState.presenceWriteTimer);
    cloudState.presenceWriteTimer = null;
    cloudState.presenceLastWrite = Date.now();

    try {
      const ref = cloudState.api.doc(
        cloudState.db,
        "sharedProjects",
        cloudState.sharedProjectId,
        "presence",
        cloudState.user.uid
      );
      await cloudState.api.setDoc(ref, {
        uid: cloudState.user.uid,
        name: cloudState.user.displayName || "",
        email: normalizeShareEmail(cloudState.user.email),
        photoURL: cloudState.user.photoURL || "",
        cursor: cloudState.presenceCursor,
        preview: cloudState.presencePreview,
        activity: cloudState.presenceActivity || "Attivo",
        updatedAt: Date.now()
      }, { merge: true });
    } catch (error) {
      console.warn("ProjectFlow: presenza realtime non disponibile.", error);
    }
  }

  function queuePresenceWrite(immediate, realtime) {
    if (!cloudState.sharedProjectId || !cloudState.user) return;
    const interval = realtime ? 140 : 260;
    const elapsed = Date.now() - cloudState.presenceLastWrite;
    if (immediate || elapsed >= interval) {
      writePresenceNow();
      return;
    }
    if (cloudState.presenceWriteTimer) return;
    cloudState.presenceWriteTimer = setTimeout(writePresenceNow, Math.max(35, interval - elapsed));
  }

  function broadcastDragPreview(nodes, activity) {
    if (!cloudState.sharedProjectId || !cloudState.user) return;
    const positions = (nodes || []).filter(Boolean).map((node) => ({
      id: node.id,
      x: Math.round(node.x),
      y: Math.round(node.y)
    }));
    if (!positions.length) return;
    cloudState.presencePreview = {
      kind: "nodes",
      positions: positions,
      updatedAt: Date.now()
    };
    cloudState.presenceActivity = activity || "Sposta blocchi";
    queuePresenceWrite(false, true);
  }

  function finishDragPreview() {
    if (!cloudState.sharedProjectId || !cloudState.user) return;
    clearTimeout(cloudState.presencePreviewClearTimer);
    clearTimeout(saveTimer);
    saveProject(false);
    cloudState.presencePreviewClearTimer = setTimeout(() => {
      cloudState.presencePreviewClearTimer = null;
      cloudState.presencePreview = null;
      cloudState.presenceActivity = "Nel progetto";
      queuePresenceWrite(true, true);
    }, 900);
  }

  function compactSketchPreviewPoints(points, limit) {
    const source = Array.isArray(points) ? points : [];
    const maxPoints = Math.max(20, Number(limit) || 180);
    if (source.length <= maxPoints) return source.map((point) => ({ x: point.x, y: point.y }));
    const result = [];
    const step = (source.length - 1) / (maxPoints - 1);
    for (let index = 0; index < maxPoints; index += 1) {
      const point = source[Math.min(source.length - 1, Math.round(index * step))];
      result.push({ x: point.x, y: point.y });
    }
    return result;
  }

  function broadcastSketchPreview(node, stroke) {
    if (!cloudState.sharedProjectId || !cloudState.user || !node || !stroke) return;
    cloudState.presencePreview = {
      kind: "sketch",
      nodeId: node.id,
      stroke: {
        id: stroke.id,
        color: stroke.color || "#52677c",
        size: Number(stroke.size) || 3,
        mode: stroke.mode === "erase" ? "erase" : "draw",
        spaceWidth: Math.max(1, Number(stroke.spaceWidth) || Number(node.sketchWidth) || 520),
        spaceHeight: Math.max(1, Number(stroke.spaceHeight) || Number(node.sketchHeight) || 320),
        points: compactSketchPreviewPoints(stroke.points, 180)
      },
      updatedAt: Date.now()
    };
    cloudState.presenceActivity = (stroke.mode === "erase" ? "Cancella" : "Disegna") + " nello Sketch";
    queuePresenceWrite(false, true);
  }

  function finishSketchPreview() {
    if (!cloudState.sharedProjectId || !cloudState.user) return;
    clearTimeout(cloudState.presencePreviewClearTimer);
    clearTimeout(saveTimer);
    saveProject(false);
    cloudState.presencePreviewClearTimer = setTimeout(() => {
      cloudState.presencePreviewClearTimer = null;
      cloudState.presencePreview = null;
      cloudState.presenceActivity = "Nel progetto";
      queuePresenceWrite(true, true);
    }, 700);
  }

  function broadcastActivity(text) {
    if (!cloudState.sharedProjectId || !cloudState.user) return;
    cloudState.presenceActivity = String(text || "Attivo").slice(0, 80);
    queuePresenceWrite(false);
  }

  function stopSharedProjectSession() {
    const previousId = cloudState.sharedProjectId;
    if (cloudState.sharedProjectUnsubscribe) cloudState.sharedProjectUnsubscribe();
    if (cloudState.presenceUnsubscribe) cloudState.presenceUnsubscribe();
    clearInterval(cloudState.presenceHeartbeat);
    clearTimeout(cloudState.presenceWriteTimer);
    clearTimeout(cloudState.presencePreviewClearTimer);

    if (previousId && cloudState.user && cloudState.api && cloudState.db) {
      try {
        const ref = cloudState.api.doc(
          cloudState.db,
          "sharedProjects",
          previousId,
          "presence",
          cloudState.user.uid
        );
        cloudState.api.deleteDoc(ref).catch(() => {});
      } catch (error) {}
    }

    cloudState.sharedProjectUnsubscribe = null;
    cloudState.presenceUnsubscribe = null;
    cloudState.presenceHeartbeat = null;
    cloudState.presenceWriteTimer = null;
    cloudState.presencePreviewClearTimer = null;
    cloudState.sharedProjectId = "";
    cloudState.remotePresence = new Map();
    cloudState.presenceCursor = null;
    cloudState.presencePreview = null;
    cloudState.presenceActivity = "Attivo";
    renderRemotePresence();
    scheduleMinimapRender(0);
  }

  function startSharedProjectSession(record) {
    if (!record || !record.sharedProjectId || !cloudState.user || !cloudState.api || !cloudState.db) {
      stopSharedProjectSession();
      return;
    }

    if (cloudState.sharedProjectId === record.sharedProjectId && cloudState.sharedProjectUnsubscribe) return;
    stopSharedProjectSession();
    cloudState.sharedProjectId = record.sharedProjectId;
    cloudState.presenceActivity = "Nel progetto";

    const ref = sharedProjectRef(record.sharedProjectId);
    cloudState.sharedProjectUnsubscribe = cloudState.api.onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) return;
      const value = snapshot.data() || {};
      cloudState.sharedMeta = Object.assign({}, cloudState.sharedMeta || {}, {
        projectId: snapshot.id,
        ownerId: value.ownerId || "",
        ownerName: value.ownerName || "",
        ownerEmail: value.ownerEmail || ""
      });

      if (!value.data || value.updatedBy === cloudState.user.uid) {
        renderSharePanel();
        return;
      }

      const localRecord = projectRecordById(record.id);
      cloudState.applyingRemote = true;
      try {
        setProjectDocument(normalizeProject(cloneProjectData(value.data)));
        if (localRecord) {
          localRecord.name = value.name || project.name || localRecord.name;
          localRecord.updatedAt = Number(value.updatedAt) || Date.now();
          localRecord.data = normalizeProject(cloneProjectData(project));
          localRecord.sharedProjectId = snapshot.id;
          localRecord.ownerId = value.ownerId || localRecord.ownerId || "";
          localRecord.ownerName = value.ownerName || localRecord.ownerName || "";
          localRecord.ownerEmail = value.ownerEmail || localRecord.ownerEmail || "";
        }
        persistProjectLibrary();
        $("projectName").value = value.name || project.name || "Untitled Flow";
        updateProjectNameAccess();
        render();
        resetHistory();
      } finally {
        cloudState.applyingRemote = false;
      }
    }, (error) => {
      console.warn("ProjectFlow: sessione condivisa interrotta.", error);
      showToast("Accesso collaborativo interrotto");
      stopSharedProjectSession();
    });

    const presenceCollection = cloudState.api.collection(
      cloudState.db,
      "sharedProjects",
      record.sharedProjectId,
      "presence"
    );
    cloudState.presenceUnsubscribe = cloudState.api.onSnapshot(presenceCollection, (snapshot) => {
      const next = new Map();
      snapshot.forEach((docSnapshot) => {
        const value = docSnapshot.data() || {};
        if (value.uid) next.set(value.uid, value);
      });
      cloudState.remotePresence = next;
      renderRemotePresence();
      scheduleMinimapRender(0);
    }, (error) => {
      console.warn("ProjectFlow: cursori collaborativi non disponibili.", error);
    });

    writePresenceNow();
    cloudState.presenceHeartbeat = setInterval(writePresenceNow, 12000);
  }

  async function mergeCloudLibrary() {
    if (!cloudState.user || !cloudState.api || !cloudState.db) return;

    try {
      const collectionRef = cloudState.api.collection(
        cloudState.db,
        "users",
        cloudState.user.uid,
        "projects"
      );
      const snapshot = await cloudState.api.getDocs(collectionRef);
      const cloudMap = new Map();

      snapshot.forEach((docSnapshot) => {
        const value = docSnapshot.data();
        if (!value || !value.data) return;
        cloudMap.set(docSnapshot.id, {
          id: docSnapshot.id,
          name: value.name || value.data.name || "Untitled Flow",
          createdAt: Number(value.createdAt) || Date.now(),
          updatedAt: Number(value.updatedAt) || Date.now(),
          data: normalizeProject(value.data)
        });
      });

      for (const [id, remote] of cloudMap) {
        const local = projectRecordById(id);
        if (!local || remote.updatedAt > local.updatedAt) {
          if (local) {
            local.name = remote.name;
            local.createdAt = remote.createdAt;
            local.updatedAt = remote.updatedAt;
            local.data = normalizeProject(cloneProjectData(remote.data));
          } else {
            projectLibrary.push(remote);
          }
        }
      }

      const sharedRecords = await fetchSharedProjects();
      const sharedIds = new Set();
      sharedRecords.forEach((remote) => {
        sharedIds.add(remote.id);
        mergeSharedRecord(remote);
      });

      const revokedActive = projectLibrary.some((entry) =>
        entry.id === currentProjectId &&
        entry.sharedProjectId &&
        entry.sharedRole === "editor" &&
        !sharedIds.has(entry.sharedProjectId)
      );
      projectLibrary = projectLibrary.filter((entry) =>
        !(entry.sharedProjectId && entry.sharedRole === "editor" && !sharedIds.has(entry.sharedProjectId))
      );

      persistProjectLibrary();

      if (revokedActive && $("editorView") && !$("editorView").classList.contains("hidden")) {
        setActiveProjectId("");
        stopSharedProjectSession();
        showProjectHome("projects");
        showToast("L'accesso al progetto condiviso è stato revocato");
      }

      for (const local of projectLibrary) {
        if (local.sharedProjectId) {
          const remote = sharedRecords.find((entry) => entry.id === local.sharedProjectId);
          if (remote && local.updatedAt > remote.updatedAt) await cloudWriteSharedProject(local);
          continue;
        }
        const remote = cloudMap.get(local.id);
        if (!remote || local.updatedAt > remote.updatedAt) {
          await cloudWriteProject(local);
        }
      }

      const active = projectRecordById(currentProjectId);
      if (active && $("editorView") && !$("editorView").classList.contains("hidden")) {
        setProjectDocument(normalizeProject(cloneProjectData(active.data)));
        $("projectName").value = rootProject.name;
        updateProjectNameAccess();
        render();
        if (active.sharedProjectId) startSharedProjectSession(active);
      }
    } catch (error) {
      console.warn("ProjectFlow: sincronizzazione cloud non riuscita.", error);
    }
  }

  async function cloudWriteProject(record) {
    if (!record || !cloudState.user || !cloudState.api || !cloudState.db) return;
    try {
      const ref = cloudState.api.doc(
        cloudState.db,
        "users",
        cloudState.user.uid,
        "projects",
        record.id
      );
      await cloudState.api.setDoc(ref, {
        name: record.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        data: record.data
      }, { merge: true });
    } catch (error) {
      console.warn("ProjectFlow: salvataggio cloud non riuscito.", error);
    }
  }

  function queueCloudSave(record) {
    if (!record || !cloudState.user) return;
    clearTimeout(cloudState.saveTimer);
    const delay = record.sharedProjectId ? 180 : 550;
    cloudState.saveTimer = setTimeout(() => {
      if (record.sharedProjectId) cloudWriteSharedProject(record);
      else cloudWriteProject(record);
    }, delay);
  }

  async function cloudDeleteProject(id) {
    if (!id || !cloudState.user || !cloudState.api || !cloudState.db) return;
    try {
      const ref = cloudState.api.doc(
        cloudState.db,
        "users",
        cloudState.user.uid,
        "projects",
        id
      );
      await cloudState.api.deleteDoc(ref);
    } catch (error) {
      console.warn("ProjectFlow: eliminazione cloud non riuscita.", error);
    }
  }

  function normalizeShareEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function sharedProjectRef(id) {
    if (!id || !cloudState.api || !cloudState.db) return null;
    return cloudState.api.doc(cloudState.db, "sharedProjects", id);
  }

  async function cloudWriteSharedProject(record) {
    if (!record || !record.sharedProjectId || !cloudState.user || !cloudState.api || !cloudState.db) return;
    try {
      const ref = sharedProjectRef(record.sharedProjectId);
      const payload = {
        updatedAt: record.updatedAt,
        updatedBy: cloudState.user.uid,
        data: record.data
      };
      if (record.sharedRole === "owner" || record.ownerId === cloudState.user.uid) {
        payload.name = record.name;
      }
      await cloudState.api.setDoc(ref, payload, { merge: true });
    } catch (error) {
      console.warn("ProjectFlow: salvataggio progetto condiviso non riuscito.", error);
      setAutosaveState("error", "Sync condivisa non riuscita");
    }
  }

  async function ensureSharedProject(record) {
    if (!record || !cloudState.user) return null;
    await initCloud(true);
    if (!cloudState.user || !cloudState.api || !cloudState.db) return null;

    if (record.sharedRole === "editor" || (record.ownerId && record.ownerId !== cloudState.user.uid)) {
      throw new Error("Solo il proprietario può gestire la condivisione.");
    }

    const id = record.sharedProjectId || record.id;
    const ref = sharedProjectRef(id);

    // Important: create/update directly. Reading a document before its first
    // creation can be denied by strict Firestore rules because resource.data
    // does not exist yet.
    await cloudState.api.setDoc(ref, {
      ownerId: cloudState.user.uid,
      ownerName: cloudState.user.displayName || "",
      ownerEmail: normalizeShareEmail(cloudState.user.email),
      name: record.name,
      createdAt: record.createdAt || Date.now(),
      updatedAt: record.updatedAt || Date.now(),
      updatedBy: cloudState.user.uid,
      data: record.data
    }, { merge: true });

    record.sharedProjectId = id;
    record.ownerId = cloudState.user.uid;
    record.ownerName = cloudState.user.displayName || "";
    record.ownerEmail = normalizeShareEmail(cloudState.user.email);
    record.sharedRole = "owner";
    persistProjectLibrary();
    return ref;
  }

  function sharedRecordFromSnapshot(docSnapshot) {
    const value = docSnapshot && docSnapshot.data ? docSnapshot.data() : null;
    if (!value || !value.data) return null;
    const owner = cloudState.user && value.ownerId === cloudState.user.uid;
    return {
      id: docSnapshot.id,
      name: value.name || value.data.name || "Untitled Flow",
      createdAt: Number(value.createdAt) || Date.now(),
      updatedAt: Number(value.updatedAt) || Date.now(),
      sharedProjectId: docSnapshot.id,
      sharedRole: owner ? "owner" : "editor",
      ownerId: value.ownerId || "",
      ownerName: value.ownerName || "",
      ownerEmail: value.ownerEmail || "",
      data: normalizeProject(value.data)
    };
  }

  function mergeSharedRecord(remote) {
    if (!remote) return null;
    let local = projectRecordById(remote.id);
    if (!local) {
      projectLibrary.push(remote);
      return remote;
    }

    local.sharedProjectId = remote.sharedProjectId;
    local.sharedRole = remote.sharedRole;
    local.ownerId = remote.ownerId;
    local.ownerName = remote.ownerName;
    local.ownerEmail = remote.ownerEmail;
    local.createdAt = remote.createdAt || local.createdAt;

    if (!local.updatedAt || remote.updatedAt >= local.updatedAt || local.sharedRole !== "owner") {
      local.name = remote.name;
      local.updatedAt = remote.updatedAt;
      local.data = normalizeProject(cloneProjectData(remote.data));
    }
    return local;
  }

  async function fetchSharedProjects() {
    if (!cloudState.user || !cloudState.api || !cloudState.db) return [];
    const results = new Map();
    const email = normalizeShareEmail(cloudState.user.email);

    const ownedQuery = cloudState.api.query(
      cloudState.api.collection(cloudState.db, "sharedProjects"),
      cloudState.api.where("ownerId", "==", cloudState.user.uid)
    );
    const ownedSnapshot = await cloudState.api.getDocs(ownedQuery);
    ownedSnapshot.forEach((docSnapshot) => {
      const remote = sharedRecordFromSnapshot(docSnapshot);
      if (remote) results.set(remote.id, remote);
    });

    if (email) {
      const inviteCollection = cloudState.api.collection(
        cloudState.db,
        "shareInvites",
        email,
        "projects"
      );
      const inviteSnapshot = await cloudState.api.getDocs(inviteCollection);
      for (const inviteDoc of inviteSnapshot.docs) {
        try {
          const projectId = inviteDoc.data().projectId || inviteDoc.id;
          const sharedSnapshot = await cloudState.api.getDoc(sharedProjectRef(projectId));
          if (!sharedSnapshot.exists()) continue;
          const remote = sharedRecordFromSnapshot(sharedSnapshot);
          if (remote) results.set(remote.id, remote);
        } catch (error) {
          console.warn("ProjectFlow: invito non più accessibile.", error);
        }
      }
    }

    return Array.from(results.values());
  }

  function sharedProjectIdFromLocation() {
    try {
      return new URL(window.location.href).searchParams.get("shared") || "";
    } catch (error) {
      return "";
    }
  }

  async function openSharedProjectFromLink() {
    const id = sharedProjectIdFromLocation();
    if (!id || !cloudState.user || !cloudState.api || !cloudState.db) return false;

    try {
      const snapshot = await cloudState.api.getDoc(sharedProjectRef(id));
      if (!snapshot.exists()) return false;
      const remote = sharedRecordFromSnapshot(snapshot);
      if (!remote) return false;
      mergeSharedRecord(remote);
      persistProjectLibrary();
      renderProjectLibrary();
      await activateProject(remote.id, true);
      return true;
    } catch (error) {
      console.warn("ProjectFlow: link condiviso non accessibile.", error);
      showToast("Questo account non ha accesso al progetto condiviso");
      return false;
    }
  }

  function loadPanelWidths() {
    let widths = { inspector: 390 };
    try {
      const saved = JSON.parse(localStorage.getItem(PANELS_KEY) || "null");
      if (saved && typeof saved.inspector === "number") widths.inspector = saved.inspector;
    } catch (error) {}

    if (widths.inspector === 305) widths.inspector = 350;
    widths.inspector = Math.max(300, Math.min(620, widths.inspector));
    document.documentElement.style.setProperty("--inspector-width", widths.inspector + "px");
    return widths;
  }

  let panelWidths = loadPanelWidths();

  function reconcileWorkspacePanels() {
    const workspace = document.querySelector(".workspace");
    if (!workspace) return;

    if (window.innerWidth <= 850) return;

    const minCanvas = 520;
    let available = window.innerWidth - (inspectorVisible ? panelWidths.inspector : 0);

    if (inspectorVisible && available < minCanvas) {
      const shortage = minCanvas - available;
      const reducibleInspector = Math.max(0, panelWidths.inspector - 300);
      panelWidths.inspector -= Math.min(shortage, reducibleInspector);
      available = window.innerWidth - panelWidths.inspector;

      if (available < 430) {
        inspectorVisible = false;
        workspace.classList.add("inspector-collapsed");
        $("inspectorPanel").classList.add("manual-hidden");
      }
    }

    document.documentElement.style.setProperty("--inspector-width", panelWidths.inspector + "px");
  }

  function setPanelWidths() {
    reconcileWorkspacePanels();
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

    reconcileWorkspacePanels();

    requestAnimationFrame(() => {
      renderEdges();
      renderMinimap();
    });
  }

  function refreshZoomSharpness() {
    world.classList.add("is-transforming");
    clearTimeout(zoomSharpTimer);
    zoomSharpTimer = setTimeout(() => {
      world.classList.remove("is-transforming");
      void world.offsetWidth;
      nodeLayer.classList.add("raster-refresh");
      requestAnimationFrame(() => {
        nodeLayer.classList.remove("raster-refresh");
        renderEdges();
      });
    }, 90);
  }

  function scheduleMinimapRender(delay) {
    if (minimapRenderTimer) return;
    minimapRenderTimer = setTimeout(() => {
      minimapRenderTimer = null;
      renderMinimap();
    }, Math.max(0, Number(delay) || 0));
  }

  function scheduleViewPersist() {
    clearTimeout(viewSaveTimer);
    viewSaveTimer = setTimeout(() => {
      viewSaveTimer = null;
      localStorage.setItem(VIEW_KEY, JSON.stringify(view));
    }, 180);
  }

  function scheduleInteractionRender(includeGroups, includeMinimap) {
    interactionNeedsGroups = interactionNeedsGroups || !!includeGroups;
    interactionNeedsMinimap = interactionNeedsMinimap || !!includeMinimap;
    if (interactionFrame) return;

    interactionFrame = requestAnimationFrame(() => {
      interactionFrame = null;
      const groups = interactionNeedsGroups;
      const minimap = interactionNeedsMinimap;
      interactionNeedsGroups = false;
      interactionNeedsMinimap = false;

      if (groups) renderGroups();
      renderEdges();
      if (minimap) scheduleMinimapRender(55);
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
    scheduleViewPersist();
    scheduleMinimapRender(45);
    refreshZoomSharpness();
  }

  function markDirty() {
    if (!cloudState.applyingRemote && cloudState.sharedProjectId) broadcastActivity("Modifica il progetto");
    $("saveStatus").textContent = "Salvataggio automatico…";
    setAutosaveState("saving", "Salvataggio…");
    scheduleHistoryCheckpoint();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProject, 350);
  }

  function saveProject(showMessage) {
    const documentProject = rootProject || project;
    if (canRenameCurrentProject()) {
      documentProject.name = $("projectName").value.trim() || "Untitled Flow";
    } else {
      $("projectName").value = documentProject.name || "Untitled Flow";
    }
    saveCurrentGraphView();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documentProject));

    const record = upsertLocalProject(documentProject, currentProjectId || uid("project"));
    setActiveProjectId(record.id);
    queueCloudSave(record);

    const cloud = !!cloudState.user;
    $("saveStatus").textContent = cloud ? "Autosave · cloud" : "Autosave · locale";
    setAutosaveState(cloud ? "cloud" : "saved", cloud ? "Autosave · Cloud" : "Autosave");
    if ($("projectHome") && !$("projectHome").classList.contains("hidden")) renderProjectLibrary();

    if (showMessage) {
      showToast(cloud ? "Progetto sincronizzato" : "Progetto salvato automaticamente");
    }
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

  function collectionTypeLabel(kind, valueType, keyType, length) {
    const base = normalizedType(valueType);
    if (base === "void") return "void";
    const mode = kind || "single";
    if (mode === "array") {
      const size = Number(length) > 0 ? Number(length) : "";
      return base + "[" + size + "]";
    }
    if (mode === "list") return "List<" + base + ">";
    if (mode === "dictionary") return "Dictionary<" + normalizedType(keyType || "string") + ", " + base + ">";
    if (mode === "nativeArray") return "NativeArray<" + base + ">";
    if (mode === "nativeList") return "NativeList<" + base + ">";
    if (mode === "nativeReference") return "NativeReference<" + base + ">";
    return base;
  }

  function collectionTypeKey(kind, valueType, keyType) {
    const base = normalizedType(valueType);
    if (base === "void") return "void";
    const mode = kind || "single";
    if (mode === "array") return base + "[]";
    if (mode === "list") return "List<" + base + ">";
    if (mode === "dictionary") return "Dictionary<" + normalizedType(keyType || "string") + ", " + base + ">";
    if (mode === "nativeArray") return "NativeArray<" + base + ">";
    if (mode === "nativeList") return "NativeList<" + base + ">";
    if (mode === "nativeReference") return "NativeReference<" + base + ">";
    return base;
  }

  function variableTypeLabel(item) {
    return collectionTypeLabel(item.collectionKind, item.dataType, item.dictionaryKeyType, item.arrayLength);
  }

  function variableTypeKey(item) {
    return collectionTypeKey(item.collectionKind, item.dataType, item.dictionaryKeyType);
  }

  function methodReturnTypeLabel(item) {
    return collectionTypeLabel(item.returnCollectionKind, item.returnType, item.returnDictionaryKeyType, item.returnArrayLength);
  }

  function methodReturnTypeKey(item) {
    return collectionTypeKey(item.returnCollectionKind, item.returnType, item.returnDictionaryKeyType);
  }

  function nodeReturnTypeLabel(node) {
    return collectionTypeLabel(node.returnCollectionKind, node.returnType, node.returnDictionaryKeyType, node.returnArrayLength);
  }

  function nodeReturnTypeKey(node) {
    return collectionTypeKey(node.returnCollectionKind, node.returnType, node.returnDictionaryKeyType);
  }

  function collectionWarning(item) {
    if (
      (item.kind === "variable" || item.kind === "property") &&
      item.collectionKind === "dictionary" &&
      item.serialized
    ) {
      return "Unity non serializza Dictionary direttamente.";
    }
    return "";
  }

  function csharpParameterText(parameter) {
    const mode = parameter.mode && parameter.mode !== "value" ? parameter.mode + " " : "";
    return mode + parameterTypeKey(parameter) + " " + (parameter.name || parameter.label || "value");
  }

  function csharpMethodSignature(item) {
    ensureFunctionSignature(item, item.access);
    const returnType = methodReturnTypeKey(item);
    const params = item.methodParameters.map(csharpParameterText).join(", ");
    const prefix = item.methodKind === "coroutine" && returnType === "void" ? "IEnumerator" : returnType;
    return (item.access || "private") + " " + prefix + " " + (item.label || "Method") + "(" + params + ")";
  }

  function csharpVariableSignature(item) {
    const nativeCollection = ["nativeArray", "nativeList", "nativeReference"].includes(item.collectionKind);
    const jobAttribute = nativeCollection && item.jobAccess === "readonly"
      ? "[ReadOnly] "
      : nativeCollection && item.jobAccess === "writeonly"
        ? "[WriteOnly] "
        : "";
    const serializeAttribute = !nativeCollection && item.serialized && item.access !== "public" && item.collectionKind !== "dictionary"
      ? "[SerializeField] "
      : "";
    const value = item.defaultValue && !nativeCollection ? " = " + item.defaultValue : "";
    return jobAttribute + serializeAttribute + (item.access || "private") + " " + variableTypeKey(item) + " " + (item.label || "value") + value + ";";
  }

  function csharpEventSignature(item) {
    const payload = item.payloadType && item.payloadType !== "void" ? "<" + item.payloadType + ">" : "";
    return (item.access || "public") + " UnityEvent" + payload + " " + (item.label || "OnEvent") + ";";
  }

  function memberCompactSignature(item) {
    if (currentSchemaId() === "classic") {
      if (item.kind === "function") {
        ensureFunctionSignature(item, item.access);
        const args = item.methodParameters.map((parameter) =>
          parameterTypeKey(parameter) + " " + (parameter.name || "value")
        ).join(", ");
        return (item.label || "Function") + "(" + args + ")" +
          (item.returnType && item.returnType !== "void" ? " → " + methodReturnTypeKey(item) : "");
      }
      if (item.kind === "variable" || item.kind === "property") {
        const value = item.defaultValue ? " = " + item.defaultValue : "";
        return variableTypeKey(item) + " " + (item.label || "value") + value;
      }
    }
    if (item.kind === "function") return csharpMethodSignature(item);
    if (item.kind === "variable" || item.kind === "property") return csharpVariableSignature(item);
    if (item.kind === "unityEvent") return csharpEventSignature(item);
    if (item.kind === "component") {
      return item.componentSource === "script"
        ? item.componentType + " : MonoBehaviour"
        : item.componentType;
    }
    return (item.label || item.kind || "member") + (item.value ? " : " + item.value : "");
  }

  function memberCompactComment(item) {
    if (item.kind === "function") return item.methodDescription || "";
    if (item.memberComment) return item.memberComment;
    if (item.kind === "component") {
      return (item.componentSource === "script" ? "Custom script" : "Unity component") +
        " · " + componentCategoryLabel(item.componentCategory);
    }
    if (item.kind === "variable" || item.kind === "property") {
      const parts = [];
      if (item.referenceMode && item.referenceMode !== "value") {
        parts.push(REFERENCE_MODE_LABELS[item.referenceMode] || item.referenceMode);
      }
      if (item.collectionKind === "list" && item.listInitialCount > 0) parts.push("initial " + item.listInitialCount);
      if (item.collectionKind === "array" && item.arrayLength > 0) parts.push("length " + item.arrayLength);
      return parts.join(" · ");
    }
    return "";
  }

  function memberSummary(item) {
    if (item.kind === "function") {
      const kind = METHOD_KIND_LABELS[item.methodKind] || "Custom";
      ensureFunctionSignature(item, item.access);
      return item.access + " " + methodReturnTypeLabel(item) + " (" +
        item.methodParameters.map((parameter) => parameterTypeKey(parameter) + " " + parameter.name).join(", ") +
        ") · " + kind;
    }
    if (item.kind === "unityEvent") {
      return item.access + " UnityEvent" + (item.payloadType && item.payloadType !== "void" ? "<" + item.payloadType + ">" : "");
    }
    if (item.kind === "component") {
      const category = componentCategoryLabel(item.componentCategory);
      const source = item.componentSource === "script" ? "Script" : "Unity";
      return source + " · " + category + (item.enabled === false ? " · Disabled" : "");
    }
    if (item.kind === "variable" || item.kind === "property") {
      const reference = item.referenceMode && item.referenceMode !== "value" ? " · " + (REFERENCE_MODE_LABELS[item.referenceMode] || item.referenceMode) : "";
      const inspector = item.serialized ? " · Inspector" : "";
      const sizeInfo = item.collectionKind === "list" && item.listInitialCount > 0 ? " · initial " + item.listInitialCount : "";
      return item.access + " " + variableTypeLabel(item) + inspector + reference + sizeInfo;
    }
    return item.value || "";
  }

  function nodeSubtitle(node) {
    if (node.type === "class") {
      return node.classVisibility + " " + node.baseType + (node.instanceAccess === "instance" ? " · Instance" : "");
    }
    if (node.type === "function") {
      if (currentSchemaId() !== "unity") return "FUNCTION · " + nodeReturnTypeLabel(node);
      const owner = ownerClassName(node);
      return (owner ? owner + " · " : "") + node.methodAccess + " " + nodeReturnTypeLabel(node);
    }
    if (node.type === "emptyGraph") {
      const inputs = node.rows.filter((item) => item.kind === "input" || item.kind === "flowIn").length;
      const outputs = node.rows.filter((item) => item.kind === "output" || item.kind === "flowOut").length;
      return "NESTED GRAPH · " + inputs + " IN · " + outputs + " OUT";
    }
    if (node.type === "graphInput") return "NESTED GRAPH · INPUT BOUNDARY";
    if (node.type === "graphOutput") return "NESTED GRAPH · OUTPUT BOUNDARY";
    if (node.type === "struct") {
      return node.structVisibility + " " + (node.structReadonly ? "readonly struct" : "struct") + (node.structSerializable ? " · Serializable" : "");
    }
    if (node.type === "jobStruct") {
      return node.structVisibility + " struct · " + (node.jobInterface || "IJob") + (node.jobBurst ? " · Burst" : "");
    }
    if (node.type === "component") {
      return componentCategoryLabel(node.componentCategory) + " · Unity Component";
    }
    if (node.type === "enum") {
      return (node.enumFlags ? "[Flags] · " : "") + node.enumUnderlyingType + " · " + node.enumValues.length + " values";
    }
    if (node.type === "switch") {
      return currentSchemaId() === "classic"
        ? "FLOW CHART · MULTI DECISION · " + (node.switchValueType || "int")
        : "CONTROL FLOW · " + (node.switchValueType || "int");
    }
    if (node.type === "ifElse") return currentSchemaId() === "classic" ? "FLOW CHART · DECISION" : "CONTROL FLOW · IF / ELSE";
    if (node.type === "whileLoop") return currentSchemaId() === "classic" ? "FLOW CHART · WHILE LOOP" : "CONTROL FLOW · WHILE";
    if (node.type === "doWhileLoop") return currentSchemaId() === "classic" ? "FLOW CHART · DO WHILE LOOP" : "CONTROL FLOW · DO WHILE";
    if (node.type === "forLoop") return currentSchemaId() === "classic" ? "FLOW CHART · COUNTED LOOP" : "CONTROL FLOW · FOR";
    if (node.type === "foreachLoop") return currentSchemaId() === "classic"
      ? "FLOW CHART · FOR EACH · " + (node.foreachItemType || "any")
      : "CONTROL FLOW · FOREACH " + (node.foreachItemType || "any");
    if (node.type === "returnFlow") {
      return currentSchemaId() === "classic"
        ? "FUNCTION · RETURN " + String(node.returnFlowType || "void").toUpperCase()
        : "CONTROL FLOW · RETURN " + String(node.returnFlowType || "void").toUpperCase();
    }
    if (node.type === "flowStart") return "FLOW CHART · START";
    if (node.type === "flowEnd") return "FLOW CHART · END";
    if (node.type === "flowIO") return "FLOW CHART · " + (node.flowIoMode === "output" ? "OUTPUT" : "INPUT") + " · " + (node.flowChartDataType || "any");
    if (node.type === "flowProcess") return "FLOW CHART · PROCESS";
    if (node.type === "breakFlow") return "CONTROL FLOW · BREAK";
    if (node.type === "continueFlow") return "CONTROL FLOW · CONTINUE";
    if (node.type === "constant") {
      return "VALUE · " + (node.constantType || "int");
    }
    if (node.type === "adapter") {
      return (node.adapterInputType || "int") + " → " + (node.adapterOutputType || "float");
    }
    if (node.type === "math") return "MATH · " + mathOperationLabel(node.mathOperation) + " · " + (node.mathDataType || "float");
    if (node.type === "logic") return "LOGIC · " + logicOperationLabel(node.logicOperation);
    if (node.type === "compare") return "COMPARE · " + compareOperationLabel(node.compareOperation) + " · " + (node.compareDataType || "float");
    if (node.type === "event") {
      if (currentSchemaId() === "classic") return "FLOW CHART · " + classicEventLabel(node.eventKind);
      return "FLOW EVENT · " + String(node.eventKind || "custom").toUpperCase();
    }
    if (node.type === "action") {
      if (currentSchemaId() === "classic") return "FLOW CHART · " + classicActionLabel(node.actionKind);
      return "FLOW ACTION · " + String(node.actionKind || "custom").toUpperCase();
    }
    if (LEGACY_BLOCK_TYPES.has(node.type)) {
      return "LEGACY · " + typeMeta(node.type).label.toUpperCase();
    }
    return typeMeta(node.type).label;
  }

  function methodReturnProxy(target, access) {
    return {
      id: target.returnPortId,
      kind: "methodReturn",
      label: target.returnName || "result",
      access: access || target.access || target.methodAccess || "public",
      returnType: target.returnType || "void",
      returnCollectionKind: target.returnCollectionKind || "single",
      returnArrayLength: target.returnArrayLength || 0,
      returnDictionaryKeyType: target.returnDictionaryKeyType || "string"
    };
  }

  function parameterProxy(parameter, access) {
    return Object.assign({}, parameter, {
      kind: "parameter",
      label: parameter.name || parameter.label || "value",
      access: access || parameter.access || "public"
    });
  }

  function memberByRef(ref) {
    if (!ref || ref.rowId === "__node__") return null;
    const node = nodeById(ref.nodeId);
    if (!node) return null;

    const direct = node.rows.find((item) => item.id === ref.rowId);
    if (direct) return direct;

    if (node.type === "function") {
      ensureFunctionSignature(node, node.methodAccess);
      const parameter = node.methodParameters.find((item) => item.id === ref.rowId);
      if (parameter) return parameterProxy(parameter, node.methodAccess);
      if (ref.rowId === node.returnPortId) return methodReturnProxy(node, node.methodAccess);
    }

    for (const item of node.rows) {
      if (item.kind !== "function") continue;
      ensureFunctionSignature(item, item.access);
      const parameter = item.methodParameters.find((entry) => entry.id === ref.rowId);
      if (parameter) return parameterProxy(parameter, item.access);
      if (ref.rowId === item.returnPortId) return methodReturnProxy(item, item.access);
    }

    return null;
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
    if (item.kind === "variable" || item.kind === "property") return variableTypeKey(item);
    if (item.kind === "function") return firstParameterType(item.parameters);
    if (item.kind === "parameter") return parameterTypeKey(item);
    if (item.kind === "methodReturn") return methodReturnTypeKey(item);
    if (item.kind === "unityEvent") return normalizedType(item.payloadType);
    if (item.kind === "component") return normalizedType(item.componentType);
    if (item.kind === "input") return normalizedType(item.value);
    if (item.kind === "flowIn" || item.kind === "flowOut") return "__flow__";
    if (item.kind === "condition") return "any";
    return "any";
  }

  function memberOutputType(item) {
    if (!item) return "any";
    if (item.kind === "variable" || item.kind === "property") return variableTypeKey(item);
    if (item.kind === "function") return methodReturnTypeKey(item);
    if (item.kind === "parameter") return parameterTypeKey(item);
    if (item.kind === "methodReturn") return methodReturnTypeKey(item);
    if (item.kind === "unityEvent") return normalizedType(item.payloadType);
    if (item.kind === "component") return normalizedType(item.componentType);
    if (item.kind === "output") return normalizedType(item.value);
    if (item.kind === "flowIn" || item.kind === "flowOut") return "__flow__";
    if (item.kind === "condition") return normalizedType(item.value || "bool");
    return "any";
  }

  function sameType(a, b) {
    a = normalizedType(a);
    b = normalizedType(b);
    if (a === "any" || b === "any" || a === "value" || b === "value") return true;
    return a === b;
  }

  function connectionScopeId(ref) {
    if (!ref) return "";
    const node = nodeById(ref.nodeId);
    if (!node) return "__graph__";
    if (node.type === "class") return node.id;
    if (node.type === "function" && node.ownerClassId) return node.ownerClassId;
    // Standalone visual nodes live in the same graph scope. Treating each node
    // as its own scope made private variables impossible to use across blocks.
    return "__graph__";
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

    if (connectionScopeId(pair.from) !== connectionScopeId(pair.to)) {
      if (fromItem && fromItem.access === "private") {
        return { ok: false, reason: "Un membro private può uscire solo all’interno della propria classe." };
      }
      if (toItem && toItem.access === "private") {
        return { ok: false, reason: "Un membro private può ricevere dati solo all’interno della propria classe." };
      }
    }

    const outputType = memberOutputType(fromItem);
    const inputType = memberInputType(toItem);
    if ((outputType === "__flow__") !== (inputType === "__flow__")) {
      return { ok: false, reason: "Le connessioni FLOW e DATA sono separate." };
    }
    if (!sameType(outputType, inputType)) {
      return { ok: false, reason: "Tipo incompatibile: " + outputType + " → " + inputType + "." };
    }

    return { ok: true, from: pair.from, to: pair.to, outputType, inputType };
  }

  function dataTypeColor(type) {
    const raw = normalizedType(type);
    const dictionaryMatch = raw.match(/^Dictionary<[^,]+,\s*(.+)>$/);
    const listMatch = raw.match(/^List<(.+)>$/);
    const arrayMatch = raw.match(/^(.+)\[[0-9]*\]$/);
    const value = dictionaryMatch ? dictionaryMatch[1] : listMatch ? listMatch[1] : arrayMatch ? arrayMatch[1] : raw;
    if (value === "bool") return "#ff966d";
    if (["int", "float", "double"].includes(value)) return "#f3bd59";
    if (value === "string") return "#e979c6";
    if (["Vector2", "Vector3", "Quaternion", "Color"].includes(value)) return "#42d4df";
    if ([
      "GameObject", "Transform", "Rigidbody", "Rigidbody2D", "Collider", "Collider2D",
      "BoxCollider", "SphereCollider", "CapsuleCollider", "Animator", "Animation",
      "AudioSource", "AudioListener", "Camera", "Light", "SpriteRenderer",
      "MeshRenderer", "SkinnedMeshRenderer", "ParticleSystem", "TrailRenderer",
      "LineRenderer", "Canvas", "CanvasGroup", "RectTransform",
      "NavMeshAgent", "NavMeshObstacle"
    ].includes(value)) return "#55d69e";
    if (value === "__flow__") return "#a99fff";
    if (value === "void") return "#68748a";
    if (enumByName(value)) return "#c58cff";
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
    const item = memberByRef({ nodeId: nodeId, rowId: rowId, side: side });
    const flowPort = item && (item.kind === "flowIn" || item.kind === "flowOut");
    port.className = "port " + side + (flowPort ? " flow-port" : "");
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
    } else if (!pendingPort && selectedNodeIds.size === 1 && selectedNodeId && selectedNodeId !== nodeId) {
      const selectedNode = nodeById(selectedNodeId);
      const wantedSide = side === "in" ? "out" : "in";
      const targetRef = { nodeId: nodeId, rowId: rowId, side: side };
      const canAutoConnect = selectedNode && nodeSemanticPortRefs(selectedNode, wantedSide)
        .some((entry) => connectionCheck(entry.ref, targetRef).ok);
      port.classList.add(canAutoConnect ? "compatible" : "incompatible");
      if (canAutoConnect) port.title = "Collega automaticamente il nodo selezionato";
    }
    port.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlePortClick({ nodeId: nodeId, rowId: rowId, side: side, kind: flowPort ? "flow" : "data" });
    });
    return port;
  }

  function refLabel(ref) {
    const node = nodeById(ref.nodeId);
    if (!node) return "Unknown";
    if (ref.rowId === "__node__") return node.title;
    const item = memberByRef(ref);
    return item ? (item.label || item.name || node.title) : node.title;
  }

  function projectTypeNodeMap() {
    const map = new Map();
    project.nodes.forEach((node) => {
      if ((node.type === "class" || node.type === "enum") && node.title) {
        map.set(node.title, node);
      }
    });
    return map;
  }

  function buildTypeRelations() {
    const typeMap = projectTypeNodeMap();
    const relations = [];
    const seen = new Set();

    const addRelation = (sourceNode, targetType, sourceLabel, sourceKind, typeLabel) => {
      if (!sourceNode || !targetType) return;
      const targetNode = typeMap.get(targetType);
      if (!targetNode || targetNode.id === sourceNode.id) return;

      const key = [sourceNode.id, targetNode.id, sourceKind, sourceLabel, targetType].join("|");
      if (seen.has(key)) return;
      seen.add(key);

      relations.push({
        id: "type_rel_" + sourceNode.id + "_" + targetNode.id + "_" + relations.length,
        relationKind: "type",
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourceLabel: sourceLabel || targetType,
        sourceKind: sourceKind || "type",
        targetType: targetType,
        targetNodeType: targetNode.type,
        typeLabel: typeLabel || targetType
      });
    };

    const scanFunction = (sourceNode, method, prefix) => {
      ensureFunctionSignature(method, method.access || method.methodAccess || "public");

      method.methodParameters.forEach((parameter) => {
        addRelation(
          sourceNode,
          parameter.dataType,
          (prefix ? prefix + "." : "") + parameter.name,
          "parameter",
          parameterTypeLabel(parameter)
        );
        if (parameter.collectionKind === "dictionary") {
          addRelation(
            sourceNode,
            parameter.dictionaryKeyType,
            (prefix ? prefix + "." : "") + parameter.name + " · key",
            "dictionaryKey",
            parameter.dictionaryKeyType
          );
        }
      });

      if (method.returnType && method.returnType !== "void") {
        addRelation(
          sourceNode,
          method.returnType,
          (prefix ? prefix + " → " : "return → ") + (method.returnName || "result"),
          "return",
          methodReturnTypeLabel(method)
        );
      }

      if (method.returnCollectionKind === "dictionary") {
        addRelation(
          sourceNode,
          method.returnDictionaryKeyType,
          (prefix ? prefix + " → " : "return → ") + "key",
          "dictionaryKey",
          method.returnDictionaryKeyType
        );
      }
    };

    project.nodes.forEach((node) => {
      if (node.type === "switch" && node.switchValueType) {
        addRelation(node, node.switchValueType, "Switch " + node.switchValueType, "switch", node.switchValueType);
      }

      if (node.type === "adapter") {
        addRelation(node, node.adapterInputType, "Adapter input", "adapterInput", node.adapterInputType);
        addRelation(node, node.adapterOutputType, "Adapter output", "adapterOutput", node.adapterOutputType);
      }

      if (node.type === "function") {
        scanFunction(node, node, node.title);
      }

      node.rows.forEach((item) => {
        if (item.kind === "variable" || item.kind === "property") {
          addRelation(node, item.dataType, item.label, "variable", variableTypeLabel(item));
          if (item.collectionKind === "dictionary") {
            addRelation(node, item.dictionaryKeyType, item.label + " · key", "dictionaryKey", item.dictionaryKeyType);
          }
        }

        if (item.kind === "function") {
          scanFunction(node, item, item.label);
        }

        if (item.kind === "component" && item.componentSource === "script" && item.componentClassId) {
          const scriptClass = nodeById(item.componentClassId);
          if (scriptClass) {
            addRelation(node, scriptClass.title, item.componentType, "componentScript", scriptClass.title);
          }
        }
      });
    });

    return relations;
  }

  function getNodeWorldRect(nodeId) {
    const node = nodeById(nodeId);
    if (!node) return null;
    const element = nodeLayer.querySelector('[data-node-id="' + nodeId + '"]');
    const width = element ? element.offsetWidth : nodeWidthFor(node);
    const height = element ? element.offsetHeight : 180;
    return {
      x: node.x,
      y: node.y,
      width: width,
      height: height,
      cx: node.x + width / 2,
      cy: node.y + height / 2
    };
  }

  function autoTypeRelationAnchors(relation) {
    const source = getNodeWorldRect(relation.sourceNodeId);
    const target = getNodeWorldRect(relation.targetNodeId);
    if (!source || !target) return null;

    const left = source.cx <= target.cx ? source : target;
    const right = source.cx <= target.cx ? target : source;

    return {
      a: { x: left.x + left.width, y: left.cy },
      b: { x: right.x, y: right.cy }
    };
  }

  function connectionRelationsForNode(nodeId) {
    const manual = project.connections
      .filter((edge) => edge.from.nodeId === nodeId || edge.to.nodeId === nodeId)
      .map((edge) => {
        const internal = edge.from.nodeId === nodeId && edge.to.nodeId === nodeId;
        const direction = edge.from.nodeId === nodeId ? "out" : "in";
        const otherNodeId = direction === "out" ? edge.to.nodeId : edge.from.nodeId;
        const otherNode = nodeById(otherNodeId);
        return {
          relationKind: "manual",
          edgeId: edge.id,
          internal,
          direction,
          sourceNodeId: edge.from.nodeId,
          targetNodeId: edge.to.nodeId,
          fromLabel: refLabel(edge.from),
          toLabel: refLabel(edge.to),
          otherNodeTitle: internal ? "Internal" : (otherNode ? otherNode.title : "External"),
          dataType: edge.dataType || memberOutputType(memberByRef(edge.from))
        };
      });

    const automatic = buildTypeRelations()
      .filter((relation) => relation.sourceNodeId === nodeId || relation.targetNodeId === nodeId)
      .map((relation) => {
        const outgoing = relation.sourceNodeId === nodeId;
        const otherNode = nodeById(outgoing ? relation.targetNodeId : relation.sourceNodeId);
        return {
          relationKind: "type",
          edgeId: null,
          typeRelationId: relation.id,
          internal: false,
          direction: outgoing ? "out" : "in",
          sourceNodeId: relation.sourceNodeId,
          targetNodeId: relation.targetNodeId,
          fromLabel: outgoing ? relation.sourceLabel : (otherNode ? otherNode.title : "Source"),
          toLabel: outgoing ? relation.targetType : relation.sourceLabel,
          otherNodeTitle: otherNode ? otherNode.title : relation.targetType,
          dataType: relation.targetType,
          targetNodeType: relation.targetNodeType,
          sourceKind: relation.sourceKind,
          typeLabel: relation.typeLabel
        };
      });

    return manual.concat(automatic);
  }

  function createNodeBackbone(node) {
    const relations = connectionRelationsForNode(node.id);
    if (!relations.length) return null;

    const backbone = document.createElement("aside");
    backbone.className = "node-backbone" + (node.uiBackboneCollapsed ? " collapsed" : "");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "backbone-toggle";
    toggle.title = node.uiBackboneCollapsed ? "Espandi backbone" : "Comprimi backbone";
    toggle.addEventListener("pointerdown", (event) => event.stopPropagation());
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      node.uiBackboneCollapsed = !node.uiBackboneCollapsed;
      renderNodes();
      renderEdges();
      markDirty();
    });

    const railDot = document.createElement("span");
    railDot.className = "backbone-main-dot";
    const label = document.createElement("span");
    label.className = "backbone-title";
    label.textContent = node.uiBackboneCollapsed ? String(relations.length) : "LINKS";
    toggle.append(railDot, label);
    backbone.appendChild(toggle);

    if (!node.uiBackboneCollapsed) {
      const list = document.createElement("div");
      list.className = "backbone-list";
      const visibleRelations = relations.slice(0, 8);

      visibleRelations.forEach((relation) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "backbone-relation " +
          (relation.internal ? "internal" : "external") +
          (relation.relationKind === "type" ? " type-link" : "");
        item.title = relation.fromLabel + " → " + relation.toLabel;
        item.style.setProperty("--relation-color", dataTypeColor(relation.dataType));

        const dot = document.createElement("span");
        dot.className = "backbone-dot";

        const copy = document.createElement("span");
        copy.className = "backbone-copy";
        const path = document.createElement("strong");
        path.textContent = relation.fromLabel + " → " + relation.toLabel;
        const meta = document.createElement("small");
        const relationType = relation.dataType === "__flow__" ? "FLOW" : (relation.dataType || "DATA");
        meta.textContent = relation.relationKind === "type"
          ? "TYPE · " + String(relation.targetNodeType || "reference").toUpperCase() + " · " + (relation.typeLabel || relationType)
          : relation.internal
            ? "INTERNAL · " + relationType
            : (relation.direction === "out" ? "OUT → " : "IN ← ") + relation.otherNodeTitle + " · " + relationType;

        copy.append(path, meta);
        item.append(dot, copy);
        item.addEventListener("pointerdown", (event) => event.stopPropagation());
        item.addEventListener("click", (event) => {
          event.stopPropagation();

          if (relation.relationKind === "type") {
            selectedEdgeId = null;
            selectedTypeRelationId = relation.typeRelationId;
            selectedNodeIds = new Set([relation.sourceNodeId, relation.targetNodeId]);
            syncPrimarySelection();
          } else {
            selectedEdgeId = relation.edgeId;
            selectedTypeRelationId = null;
            selectedNodeIds.clear();
            selectedNodeId = null;
          }

          renderNodes();
          renderEdges();
          renderInspector();
          renderMinimap();
        });
        list.appendChild(item);
      });

      if (relations.length > visibleRelations.length) {
        const more = document.createElement("div");
        more.className = "backbone-more";
        more.textContent = "+" + (relations.length - visibleRelations.length) + " relazioni";
        list.appendChild(more);
      }

      backbone.appendChild(list);
    }

    return backbone;
  }

  function renameDataTypeEverywhere(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;

    project.nodes.forEach((target) => {
      if (target.type === "switch" && target.switchValueType === oldName) {
        target.switchValueType = newName;
        syncSwitchNode(target);
      }
      if (target.type === "adapter") {
        if (target.adapterInputType === oldName) target.adapterInputType = newName;
        if (target.adapterOutputType === oldName) target.adapterOutputType = newName;
        syncAdapterNode(target);
      }
      if (target.type === "foreachLoop" && target.foreachItemType === oldName) {
        target.foreachItemType = newName;
        const itemRow = target.rows.find((item) => item && item.id === "foreach_item");
        if (itemRow) itemRow.value = newName;
      }

      if (target.type === "function") {
        ensureFunctionSignature(target, target.methodAccess);
        if (target.returnType === oldName) target.returnType = newName;
        if (target.returnDictionaryKeyType === oldName) target.returnDictionaryKeyType = newName;
        target.methodParameters.forEach((parameter) => {
          if (parameter.dataType === oldName) parameter.dataType = newName;
          if (parameter.dictionaryKeyType === oldName) parameter.dictionaryKeyType = newName;
        });
        syncLegacyParameters(target);
      }

      target.rows.forEach((item) => {
        if ((item.kind === "variable" || item.kind === "property") && item.dataType === oldName) item.dataType = newName;
        if ((item.kind === "variable" || item.kind === "property") && item.dictionaryKeyType === oldName) item.dictionaryKeyType = newName;

        if (item.kind === "function") {
          ensureFunctionSignature(item, item.access);
          if (item.returnType === oldName) item.returnType = newName;
          if (item.returnDictionaryKeyType === oldName) item.returnDictionaryKeyType = newName;
          item.methodParameters.forEach((parameter) => {
            if (parameter.dataType === oldName) parameter.dataType = newName;
            if (parameter.dictionaryKeyType === oldName) parameter.dictionaryKeyType = newName;
          });
          syncLegacyParameters(item);
        }
      });
    });
  }

  function applySketchStrokeStyle(ctx, stroke, pixelRatio) {
    ctx.globalCompositeOperation = stroke && stroke.mode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke && stroke.color ? stroke.color : "#52677c";
    ctx.lineWidth = (Number(stroke && stroke.size) || 3) * pixelRatio;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function drawSketchNodeSegment(canvas, stroke, from, to) {
    if (!canvas || !stroke || !from || !to) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const clientWidth = Math.max(1, canvas.clientWidth || canvas.width);
    const clientHeight = Math.max(1, canvas.clientHeight || canvas.height);
    const ratioX = canvas.width / clientWidth;
    const ratioY = canvas.height / clientHeight;
    const ratio = Math.max(1, (ratioX + ratioY) / 2);
    const spaceWidth = Math.max(1, Number(stroke.spaceWidth) || clientWidth);
    const spaceHeight = Math.max(1, Number(stroke.spaceHeight) || clientHeight);
    ctx.save();
    applySketchStrokeStyle(ctx, stroke, ratio);
    ctx.beginPath();
    ctx.moveTo(from.x * spaceWidth * ratioX, from.y * spaceHeight * ratioY);
    ctx.lineTo(to.x * spaceWidth * ratioX, to.y * spaceHeight * ratioY);
    ctx.stroke();
    ctx.restore();
  }

  function renderSketchNodeCanvas(canvas, node, draftStroke) {
    if (!canvas || !node) return;
    const widthCss = Math.max(1, canvas.clientWidth);
    const heightCss = Math.max(1, canvas.clientHeight);
    if (!widthCss || !heightCss) return;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(widthCss * ratio));
    const height = Math.max(1, Math.round(heightCss * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (stroke) => {
      if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) return;
      const spaceWidth = Math.max(1, Number(stroke.spaceWidth) || widthCss);
      const spaceHeight = Math.max(1, Number(stroke.spaceHeight) || heightCss);
      ctx.save();
      applySketchStrokeStyle(ctx, stroke, ratio);
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * spaceWidth * ratio;
        const y = point.y * spaceHeight * ratio;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    (node.sketchStrokes || []).forEach(drawStroke);
    if (draftStroke) drawStroke(draftStroke);
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
    element.style.width = nodeWidthFor(node) + "px";

    const header = document.createElement("div");
    header.className = "node-header";

    const typeDot = document.createElement("span");
    typeDot.className = "node-type-dot";
    typeDot.textContent = meta.icon;

    const heading = document.createElement("div");
    heading.className = "node-heading inline-heading";

    const titleInput = document.createElement("input");
    const titleBeforeEdit = node.title;
    titleInput.className = "node-title-inline";
    titleInput.value = node.title;
    titleInput.setAttribute("aria-label", "Nome blocco");
    titleInput.addEventListener("pointerdown", (event) => event.stopPropagation());
    titleInput.addEventListener("input", () => {
      node.title = titleInput.value;
      markDirty();
    });
    titleInput.addEventListener("change", () => {
      if ((node.type === "enum" || node.type === "class") && titleBeforeEdit !== node.title) {
        renameDataTypeEverywhere(titleBeforeEdit, node.title);
      }
      renderInspector();
      renderNodes();
      renderEdges();
      markDirty();
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
    if (node.boundaryLocked) {
      removeNodeButton.hidden = true;
      more.hidden = true;
    }

    removeNodeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (node.boundaryLocked) return;
      project.nodes = project.nodes.filter((item) => item.id !== node.id);
      project.connections = project.connections.filter((edge) => edge.from.nodeId !== node.id && edge.to.nodeId !== node.id);
      selectedNodeIds.delete(node.id);
      syncPrimarySelection();
      render();
      markDirty();
      showToast("Blocco eliminato");
    });

    header.append(typeDot, heading, more, removeNodeButton);

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

    const typePicker = (value, onChange, className) => {
      const wrap = document.createElement("div");
      wrap.className = "type-picker";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = className || "inline-type-picker";
      trigger.textContent = value || "Type";
      trigger.title = "Scegli tipo";
      trigger.addEventListener("pointerdown", (event) => event.stopPropagation());

      const popup = document.createElement("div");
      popup.className = "type-picker-popup";

      const homeView = document.createElement("div");
      homeView.className = "type-picker-home";

      const detailView = document.createElement("div");
      detailView.className = "type-picker-detail";

      const detailHeader = document.createElement("div");
      detailHeader.className = "type-picker-detail-header";

      const back = document.createElement("button");
      back.type = "button";
      back.className = "type-picker-back";
      back.innerHTML = '<span>←</span><span>Indietro</span>';
      back.addEventListener("pointerdown", (event) => event.stopPropagation());

      const detailTitle = document.createElement("strong");
      detailTitle.className = "type-picker-detail-title";
      detailHeader.append(back, detailTitle);

      const detailOptions = document.createElement("div");
      detailOptions.className = "type-picker-detail-options";
      detailView.append(detailHeader, detailOptions);

      const resetTypePicker = () => {
        popup.classList.remove("detail-mode");
        detailTitle.textContent = "";
        detailOptions.innerHTML = "";
        popup.scrollTop = 0;
      };

      back.addEventListener("click", (event) => {
        event.stopPropagation();
        resetTypePicker();
      });

      dataTypeCategories().forEach((category) => {
        const categoryButton = document.createElement("button");
        categoryButton.type = "button";
        categoryButton.className = "type-picker-category";
        categoryButton.innerHTML =
          '<span class="type-category-copy"><strong>' + category.label + '</strong><small>' +
          category.values.length + ' tipi</small></span><span class="type-category-arrow">›</span>';
        categoryButton.addEventListener("pointerdown", (event) => event.stopPropagation());
        categoryButton.addEventListener("click", (event) => {
          event.stopPropagation();
          detailTitle.textContent = category.label;
          detailOptions.innerHTML = "";

          category.values.forEach((typeValue) => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "type-picker-option" + (typeValue === value ? " active" : "");
            option.textContent = typeValue;
            option.addEventListener("pointerdown", (pointerEvent) => pointerEvent.stopPropagation());
            option.addEventListener("click", (clickEvent) => {
              clickEvent.stopPropagation();
              onChange(typeValue);
            });
            detailOptions.appendChild(option);
          });

          popup.classList.add("detail-mode");
          popup.scrollTop = 0;
        });

        homeView.appendChild(categoryButton);
      });

      popup._resetTypePicker = resetTypePicker;
      popup.append(homeView, detailView);

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = !popup.classList.contains("open");
        closeInterfaceSurfaces(willOpen ? popup : null);

        if (willOpen) resetTypePicker();
        popup.classList.toggle("open", willOpen);
        popup.setAttribute("aria-hidden", willOpen ? "false" : "true");
        if (willOpen) keepSurfaceInViewport(popup, 12);
      });

      wrap.append(trigger, popup);
      return wrap;
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

    if (node.type === "sketch") {
      const tools = document.createElement("div");
      tools.className = "node-sketch-tools";

      const modeGroup = document.createElement("div");
      modeGroup.className = "node-sketch-mode-group";

      const drawMode = document.createElement("button");
      drawMode.type = "button";
      drawMode.className = "node-sketch-mode-button";
      drawMode.innerHTML = '<span>✎</span><span>Penna</span>';
      drawMode.title = "Disegna";

      const eraseMode = document.createElement("button");
      eraseMode.type = "button";
      eraseMode.className = "node-sketch-mode-button";
      eraseMode.innerHTML = '<span>⌫</span><span>Gomma</span>';
      eraseMode.title = "Gomma";

      const syncModeUI = () => {
        drawMode.classList.toggle("active", node.sketchMode !== "erase");
        eraseMode.classList.toggle("active", node.sketchMode === "erase");
        canvas.classList.toggle("erase-mode", node.sketchMode === "erase");
      };

      drawMode.addEventListener("pointerdown", (event) => event.stopPropagation());
      eraseMode.addEventListener("pointerdown", (event) => event.stopPropagation());
      drawMode.addEventListener("click", (event) => {
        event.stopPropagation();
        node.sketchMode = "draw";
        syncModeUI();
        markDirty();
      });
      eraseMode.addEventListener("click", (event) => {
        event.stopPropagation();
        node.sketchMode = "erase";
        syncModeUI();
        markDirty();
      });
      modeGroup.append(drawMode, eraseMode);

      const colorWrap = document.createElement("label");
      colorWrap.className = "node-sketch-color-wrap";
      colorWrap.title = "Colore penna";
      const color = document.createElement("input");
      color.type = "color";
      color.className = "node-sketch-color";
      color.value = node.sketchColor || "#52677c";
      color.addEventListener("pointerdown", (event) => event.stopPropagation());
      color.addEventListener("input", () => {
        node.sketchColor = color.value;
        markDirty();
      });
      const colorLabel = document.createElement("span");
      colorLabel.textContent = "Colore";
      colorWrap.append(color, colorLabel);

      const sizeWrap = document.createElement("label");
      sizeWrap.className = "node-sketch-size-wrap";
      const size = document.createElement("input");
      size.type = "range";
      size.className = "node-sketch-size";
      size.min = "1";
      size.max = "16";
      size.value = String(node.sketchSize || 3);
      size.title = "Spessore tratto";
      size.addEventListener("pointerdown", (event) => event.stopPropagation());
      const sizeValue = document.createElement("span");
      sizeValue.className = "node-sketch-size-value";
      sizeValue.textContent = String(node.sketchSize || 3) + " px";
      size.addEventListener("input", () => {
        node.sketchSize = Number(size.value) || 3;
        sizeValue.textContent = node.sketchSize + " px";
        markDirty();
      });
      sizeWrap.append(size, sizeValue);

      const toolSpacer = document.createElement("span");
      toolSpacer.className = "node-sketch-tool-spacer";

      const undoStroke = document.createElement("button");
      undoStroke.type = "button";
      undoStroke.className = "node-sketch-action";
      undoStroke.innerHTML = '<span>↶</span><span>Ultimo</span>';
      undoStroke.title = "Rimuovi ultimo tratto";
      undoStroke.addEventListener("pointerdown", (event) => event.stopPropagation());

      const clearSketch = document.createElement("button");
      clearSketch.type = "button";
      clearSketch.className = "node-sketch-action danger";
      clearSketch.innerHTML = '<span>⌫</span><span>Pulisci</span>';
      clearSketch.title = "Pulisci Sketch";
      clearSketch.addEventListener("pointerdown", (event) => event.stopPropagation());

      tools.append(modeGroup, colorWrap, sizeWrap, toolSpacer, undoStroke, clearSketch);

      const canvasWrap = document.createElement("div");
      canvasWrap.className = "node-sketch-paper";
      canvasWrap.style.height = Math.round(node.sketchHeight || 320) + "px";

      const canvas = document.createElement("canvas");
      canvas.className = "node-sketch-canvas";
      canvas.setAttribute("aria-label", "Area disegno Sketch");

      const resizeHandle = document.createElement("button");
      resizeHandle.type = "button";
      resizeHandle.className = "node-sketch-resize";
      resizeHandle.innerHTML = "↘";
      resizeHandle.title = "Trascina per ridimensionare lo Sketch";
      resizeHandle.setAttribute("aria-label", "Ridimensiona Sketch");
      resizeHandle.addEventListener("pointerdown", (event) => event.stopPropagation());

      canvasWrap.append(canvas, resizeHandle);

      const footer = document.createElement("div");
      footer.className = "node-sketch-footer";
      const hint = document.createElement("span");
      hint.textContent = "Disegna direttamente nel riquadro";
      const dimensions = document.createElement("span");
      dimensions.className = "node-sketch-dimensions";
      const updateDimensions = () => {
        dimensions.textContent = Math.round(node.sketchWidth || nodeWidthFor(node)) + " × " + Math.round(node.sketchHeight || 320) + " · trascina ↘";
      };
      updateDimensions();
      footer.append(hint, dimensions);

      let draft = null;
      let pointerId = null;
      let drawRect = null;

      const pointFromEvent = (event) => {
        const rect = drawRect || canvas.getBoundingClientRect();
        return {
          x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
          y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))
        };
      };

      canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 && event.pointerType !== "pen" && event.pointerType !== "touch") return;
        event.preventDefault();
        event.stopPropagation();
        if (!isNodeSelected(node.id)) {
          selectedNodeIds = new Set([node.id]);
          syncPrimarySelection();
          selectedEdgeId = null;
          selectedJunctionIds.clear();
          selectedGroupId = null;
          element.classList.add("selected");
          renderEdges();
          renderInspector();
          scheduleMinimapRender(0);
          updateGroupActionUI();
        }
        pointerId = event.pointerId;
        drawRect = canvas.getBoundingClientRect();
        if (canvas.setPointerCapture) canvas.setPointerCapture(pointerId);
        draft = {
          id: uid("stroke"),
          color: node.sketchColor || "#52677c",
          size: Number(node.sketchSize) || 3,
          mode: node.sketchMode === "erase" ? "erase" : "draw",
          spaceWidth: Math.max(1, canvas.clientWidth),
          spaceHeight: Math.max(1, canvas.clientHeight),
          points: [pointFromEvent(event)]
        };
        broadcastActivity((draft.mode === "erase" ? "Cancella" : "Disegna") + " nello Sketch " + (node.title || ""));
      });

      canvas.addEventListener("pointermove", (event) => {
        if (!draft || event.pointerId !== pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const point = pointFromEvent(event);
        const previous = draft.points[draft.points.length - 1];
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        if (dx * dx + dy * dy < 0.000008) return;
        draft.points.push(point);
        drawSketchNodeSegment(canvas, draft, previous, point);
        broadcastSketchPreview(node, draft);
      });

      const finishStroke = (event) => {
        if (!draft || event.pointerId !== pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        if (canvas.releasePointerCapture) {
          try { canvas.releasePointerCapture(pointerId); } catch (error) {}
        }
        if (draft.points.length > 1) {
          node.sketchStrokes.push(draft);
          markDirty();
          finishSketchPreview();
        }
        draft = null;
        pointerId = null;
        drawRect = null;
        renderSketchNodeCanvas(canvas, node, null);
      };
      canvas.addEventListener("pointerup", finishStroke);
      canvas.addEventListener("pointercancel", finishStroke);

      undoStroke.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!node.sketchStrokes.length) return;
        node.sketchStrokes.pop();
        renderSketchNodeCanvas(canvas, node, null);
        markDirty();
      });

      clearSketch.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!node.sketchStrokes.length) return;
        if (!confirm("Pulire questo Sketch?")) return;
        node.sketchStrokes = [];
        renderSketchNodeCanvas(canvas, node, null);
        markDirty();
      });

      resizeHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = nodeWidthFor(node);
        const startHeight = Number(node.sketchHeight) || 320;
        const pointer = event.pointerId;
        if (resizeHandle.setPointerCapture) resizeHandle.setPointerCapture(pointer);
        element.classList.add("sketch-resizing");
        broadcastActivity("Ridimensiona Sketch " + (node.title || ""));

        const moveResize = (moveEvent) => {
          if (moveEvent.pointerId !== pointer) return;
          const dx = (moveEvent.clientX - startX) / Math.max(.01, view.scale);
          const dy = (moveEvent.clientY - startY) / Math.max(.01, view.scale);
          node.sketchWidth = Math.max(360, Math.min(2400, Math.round(startWidth + dx)));
          node.sketchHeight = Math.max(220, Math.min(1600, Math.round(startHeight + dy)));
          element.style.width = node.sketchWidth + "px";
          canvasWrap.style.height = node.sketchHeight + "px";
          updateDimensions();
          renderSketchNodeCanvas(canvas, node, null);
          scheduleInteractionRender(true, true);
        };

        const endResize = (upEvent) => {
          if (upEvent.pointerId !== pointer) return;
          resizeHandle.removeEventListener("pointermove", moveResize);
          resizeHandle.removeEventListener("pointerup", endResize);
          resizeHandle.removeEventListener("pointercancel", endResize);
          element.classList.remove("sketch-resizing");
          if (resizeHandle.releasePointerCapture) {
            try { resizeHandle.releasePointerCapture(pointer); } catch (error) {}
          }
          renderGroups();
          renderEdges();
          renderMinimap();
          markDirty();
        };

        resizeHandle.addEventListener("pointermove", moveResize);
        resizeHandle.addEventListener("pointerup", endResize);
        resizeHandle.addEventListener("pointercancel", endResize);
      });

      body.append(tools, canvasWrap, footer);
      syncModeUI();
      requestAnimationFrame(() => renderSketchNodeCanvas(canvas, node, null));
    } else if (node.type === "note") {
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

      if (node.type === "switch") {
        syncSwitchNode(node);
        const meta = document.createElement("div");
        meta.className = "node-meta-inline gameplay-meta-inline switch-meta-inline";

        const typeControl = typePicker(node.switchValueType, (value) => {
          node.switchValueType = value;
          if (!enumByName(value) && (!node.switchCases || !node.switchCases.length)) {
            node.switchCases = [{ id: uid("switch_case"), value: "0" }];
          }
          syncSwitchNode(node);
          rerenderNode();
        }, "inline-type-picker");

        const addCase = document.createElement("button");
        addCase.type = "button";
        addCase.className = "switch-case-action";
        addCase.textContent = "＋";
        addCase.title = "Aggiungi case";
        addCase.disabled = !!enumByName(node.switchValueType);
        addCase.addEventListener("pointerdown", (event) => event.stopPropagation());
        addCase.addEventListener("click", (event) => {
          event.stopPropagation();
          if (enumByName(node.switchValueType)) return;
          node.switchCases.push({
            id: uid("switch_case"),
            value: String(node.switchCases.length)
          });
          syncSwitchNode(node);
          rerenderNode();
        });

        const removeCase = document.createElement("button");
        removeCase.type = "button";
        removeCase.className = "switch-case-action";
        removeCase.textContent = "−";
        removeCase.title = "Rimuovi ultimo case";
        removeCase.disabled = !!enumByName(node.switchValueType) || node.switchCases.length <= 1;
        removeCase.addEventListener("pointerdown", (event) => event.stopPropagation());
        removeCase.addEventListener("click", (event) => {
          event.stopPropagation();
          if (enumByName(node.switchValueType) || node.switchCases.length <= 1) return;
          const removed = node.switchCases.pop();
          project.connections = project.connections.filter((edge) =>
            edge.from.rowId !== removed.id && edge.to.rowId !== removed.id
          );
          syncSwitchNode(node);
          rerenderNode();
        });

        meta.append(typeControl, addCase, removeCase);
        body.appendChild(meta);

        if (!enumByName(node.switchValueType)) {
          const caseEditor = document.createElement("div");
          caseEditor.className = "switch-case-editor";
          node.switchCases.forEach((entry, index) => {
            const input = inlineInput(entry.value, "case " + index, (value) => {
              entry.value = value;
              const out = node.rows.find((rowItem) => rowItem.id === entry.id);
              if (out) out.label = "Case " + value;
            }, "switch-case-input");
            caseEditor.appendChild(input);
          });
          body.appendChild(caseEditor);
        }
      }

      if (node.type === "returnFlow") {
        syncReturnFlowNode(node);
        const meta = document.createElement("div");
        meta.className = "node-meta-inline gameplay-meta-inline";
        const returnTypes = [["void", "void"]].concat(availableDataTypes().map((value) => [value, value]));
        meta.appendChild(compactSelect(node.returnFlowType, returnTypes, (value) => {
          node.returnFlowType = value;
          syncReturnFlowNode(node);
          rerenderNode();
        }, "inline-type-picker"));
        body.appendChild(meta);
      }

      if (node.type === "constant") {
        syncConstantNode(node);
        const meta = document.createElement("div");
        meta.className = "node-meta-inline math-meta-inline";

        const valueControl = (() => {
          const enumType = enumByName(node.constantType);
          if (node.constantType === "bool") {
            if (!["true", "false"].includes(String(node.constantValue).toLowerCase())) node.constantValue = "false";
            return compactSelect(String(node.constantValue).toLowerCase(), [
              ["false", "false"],
              ["true", "true"]
            ], (value) => {
              node.constantValue = value;
              syncConstantNode(node);
              rerenderNode();
            }, "node-meta-select");
          }
          if (enumType && !enumType.enumFlags) {
            const options = enumType.enumValues.map((entry) => [entry.name, entry.name]);
            if (options.length && !options.some((entry) => entry[0] === node.constantValue)) {
              node.constantValue = options[0][0];
            }
            return compactSelect(node.constantValue, options, (value) => {
              node.constantValue = value;
              syncConstantNode(node);
              rerenderNode();
            }, "node-meta-select");
          }
          const placeholders = {
            int: "0",
            float: "0.0",
            double: "0.0",
            string: "text",
            Vector2: "(0, 0)",
            Vector3: "(0, 0, 0)",
            Color: "(1, 1, 1, 1)"
          };
          return inlineInput(
            node.constantValue,
            placeholders[node.constantType] || "value",
            (value) => {
              node.constantValue = value;
              syncConstantNode(node);
            },
            "inline-default-input"
          );
        })();

        meta.append(
          typePicker(node.constantType, (value) => {
            node.constantType = value;
            if (value === "bool") node.constantValue = "false";
            else if (["int", "float", "double"].includes(value)) node.constantValue = "0";
            else if (value === "string") node.constantValue = "";
            syncConstantNode(node);
            rerenderNode();
          }, "inline-type-picker"),
          valueControl
        );
        body.appendChild(meta);
      }

      if (node.type === "adapter") {
        syncAdapterNode(node);
        const meta = document.createElement("div");
        meta.className = "adapter-meta-inline";

        const inputType = typePicker(node.adapterInputType, (value) => {
          node.adapterInputType = value;
          syncAdapterNode(node);
          rerenderNode();
        }, "adapter-type-picker");

        const arrow = document.createElement("span");
        arrow.className = "adapter-arrow";
        arrow.textContent = "→";

        const outputType = typePicker(node.adapterOutputType, (value) => {
          node.adapterOutputType = value;
          syncAdapterNode(node);
          rerenderNode();
        }, "adapter-type-picker");

        const swap = document.createElement("button");
        swap.type = "button";
        swap.className = "adapter-swap";
        swap.textContent = "⇄";
        swap.title = "Inverti tipi";
        swap.addEventListener("pointerdown", (event) => event.stopPropagation());
        swap.addEventListener("click", (event) => {
          event.stopPropagation();
          const previous = node.adapterInputType;
          node.adapterInputType = node.adapterOutputType;
          node.adapterOutputType = previous;
          syncAdapterNode(node);
          rerenderNode();
        });

        meta.append(inputType, arrow, outputType, swap);
        const hint = document.createElement("div");
        hint.className = "adapter-hint";
        hint.textContent = adapterConversionHint(node.adapterInputType, node.adapterOutputType);
        body.append(meta, hint);
      }

      if (node.type === "math") {
        syncMathNode(node);
        const meta = document.createElement("div");
        meta.className = "node-meta-inline math-meta-inline";
        meta.append(
          compactSelect(node.mathOperation, [
            ["add", "Add"], ["subtract", "Subtract"], ["multiply", "Multiply"], ["divide", "Divide"],
            ["modulo", "Modulo"], ["power", "Power"], ["min", "Min"], ["max", "Max"],
            ["clamp", "Clamp"], ["lerp", "Lerp"], ["abs", "Absolute"], ["sqrt", "Square Root"]
          ], (value) => {
            node.mathOperation = value;
            syncMathNode(node);
            rerenderNode();
          }, "node-meta-select"),
          typePicker(node.mathDataType, (value) => {
            node.mathDataType = value;
            syncMathNode(node);
            rerenderNode();
          }, "inline-type-picker")
        );
        body.appendChild(meta);
      }

      if (node.type === "logic") {
        syncLogicNode(node);
        const meta = document.createElement("div");
        meta.className = "node-meta-inline math-meta-inline";
        meta.appendChild(compactSelect(node.logicOperation, [
          ["and", "AND"], ["or", "OR"], ["xor", "XOR"], ["not", "NOT"]
        ], (value) => {
          node.logicOperation = value;
          syncLogicNode(node);
          rerenderNode();
        }, "node-meta-select"));
        body.appendChild(meta);
      }

      if (node.type === "compare") {
        syncCompareNode(node);
        const meta = document.createElement("div");
        meta.className = "node-meta-inline math-meta-inline";
        meta.append(
          compactSelect(node.compareOperation, [
            ["equal", "Equal"], ["notEqual", "Not Equal"], ["greater", "Greater Than"],
            ["greaterEqual", "Greater / Equal"], ["less", "Less Than"], ["lessEqual", "Less / Equal"]
          ], (value) => {
            node.compareOperation = value;
            syncCompareNode(node);
            rerenderNode();
          }, "node-meta-select"),
          typePicker(node.compareDataType, (value) => {
            node.compareDataType = value;
            syncCompareNode(node);
            rerenderNode();
          }, "inline-type-picker")
        );
        body.appendChild(meta);
      }

      if (node.type === "foreachLoop") {
        const meta = document.createElement("div");
        meta.className = "node-meta-inline gameplay-meta-inline";
        const itemType = typePicker(node.foreachItemType || "any", (value) => {
          node.foreachItemType = value;
          const itemRow = node.rows.find((item) => item.id === "foreach_item");
          if (itemRow) itemRow.value = value;
          rerenderNode();
        }, "inline-type-picker");
        meta.appendChild(itemType);
        body.appendChild(meta);
      }

      if (node.type === "event") {
        const meta = document.createElement("div");
        meta.className = "node-meta-inline gameplay-meta-inline";
        meta.appendChild(compactSelect(node.eventKind, eventKindOptionsForSchema(), (value) => {
          node.eventKind = value;
          rerenderNode();
        }, "node-meta-select"));

        if (currentSchemaId() === "classic" && node.eventKind === "input") {
          meta.appendChild(typePicker(node.flowChartDataType || "any", (value) => {
            node.flowChartDataType = value;
            syncClassicEventNode(node);
            rerenderNode();
          }, "inline-type-picker"));
        }
        body.appendChild(meta);
      }

      if (node.type === "action") {
        const meta = document.createElement("div");
        meta.className = "node-meta-inline gameplay-meta-inline";
        meta.appendChild(compactSelect(node.actionKind, actionKindOptionsForSchema(), (value) => {
          node.actionKind = value;
          rerenderNode();
        }, "node-meta-select"));

        if (currentSchemaId() === "classic" && ["callFunction", "setVariable", "readInput", "writeOutput"].includes(node.actionKind)) {
          meta.appendChild(typePicker(node.flowChartDataType || "any", (value) => {
            node.flowChartDataType = value;
            syncClassicActionNode(node);
            rerenderNode();
          }, "inline-type-picker"));
        }
        body.appendChild(meta);
      }

      if (node.type === "state") {
        const meta = document.createElement("div");
        meta.className = "node-meta-inline gameplay-meta-inline";
        meta.appendChild(compactSelect(node.stateKind, [
          ["normal", "Normal State"],
          ["start", "Start State"],
          ["any", "Any State"],
          ["super", "Super State"]
        ], (value) => {
          node.stateKind = value;
          rerenderNode();
        }, "node-meta-select"));
        body.appendChild(meta);
      }

      const removeConnectionsForRef = (refId) => {
        project.connections = project.connections.filter((edge) => edge.from.rowId !== refId && edge.to.rowId !== refId);
      };

      const makeMethodMiniHeading = (labelText, countText) => {
        const heading = document.createElement("div");
        heading.className = "method-subsection-title";
        const label = document.createElement("span");
        label.textContent = labelText;
        heading.appendChild(label);
        if (countText !== undefined && countText !== null) {
          const count = document.createElement("span");
          count.className = "method-subsection-count";
          count.textContent = String(countText);
          heading.appendChild(count);
        }
        return heading;
      };

      const makeParameterEditor = (target, parameter, access) => {
        ensureFunctionSignature(target, access);
        parameter.access = access || target.access || target.methodAccess || "public";

        const row = document.createElement("div");
        row.className = "method-parameter-row";
        row.dataset.parameterId = parameter.id;

        const mode = parameter.mode || "value";
        if (mode !== "out") {
          row.appendChild(decoratePort(makePort(node.id, parameter.id, "in", connectedPorts), parameterTypeKey(parameter)));
        }

        const modeSelect = compactSelect(mode, [
          ["value", "value"],
          ["in", "in"],
          ["ref", "ref"],
          ["out", "out"]
        ], (value) => {
          parameter.mode = value;
          syncLegacyParameters(target);
          rerenderNode();
        }, "parameter-mode-select");

        const type = typePicker(parameter.dataType, (value) => {
          parameter.dataType = value;
          syncLegacyParameters(target);
          rerenderNode();
        }, "inline-type-picker");

        const name = inlineInput(parameter.name, "nome parametro", (value) => {
          parameter.name = value;
          parameter.label = value;
          syncLegacyParameters(target);
        }, "parameter-name-input");

        const collection = compactSelect(parameter.collectionKind, [
          ["single", "Single"],
          ["array", "Array"],
          ["list", "List"],
          ["dictionary", "Dictionary"]
        ], (value) => {
          parameter.collectionKind = value;
          syncLegacyParameters(target);
          rerenderNode();
        }, "parameter-collection-select");

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "parameter-remove";
        remove.textContent = "×";
        remove.title = "Rimuovi parametro";
        remove.addEventListener("pointerdown", (event) => event.stopPropagation());
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          target.methodParameters = target.methodParameters.filter((item) => item.id !== parameter.id);
          removeConnectionsForRef(parameter.id);
          syncLegacyParameters(target);
          rerenderNode();
        });

        const main = document.createElement("div");
        main.className = "method-parameter-main";
        main.append(modeSelect, type, name, remove);

        const detail = document.createElement("div");
        detail.className = "method-parameter-detail";
        detail.appendChild(collection);

        if (parameter.collectionKind === "array") {
          const length = document.createElement("input");
          length.type = "number";
          length.min = "0";
          length.className = "inline-size-input";
          length.value = parameter.arrayLength || "";
          length.placeholder = "Length";
          length.addEventListener("pointerdown", (event) => event.stopPropagation());
          length.addEventListener("input", () => {
            parameter.arrayLength = Math.max(0, Number(length.value) || 0);
            markDirty();
          });
          detail.appendChild(length);
        } else if (parameter.collectionKind === "list") {
          const initial = document.createElement("input");
          initial.type = "number";
          initial.min = "0";
          initial.className = "inline-size-input";
          initial.value = parameter.listInitialCount || "";
          initial.placeholder = "Initial";
          initial.addEventListener("pointerdown", (event) => event.stopPropagation());
          initial.addEventListener("input", () => {
            parameter.listInitialCount = Math.max(0, Number(initial.value) || 0);
            markDirty();
          });
          detail.appendChild(initial);
        } else if (parameter.collectionKind === "dictionary") {
          detail.appendChild(typePicker(parameter.dictionaryKeyType, (value) => {
            parameter.dictionaryKeyType = value;
            syncLegacyParameters(target);
            rerenderNode();
          }, "inline-key-type-picker"));
        }

        const preview = document.createElement("code");
        preview.className = "method-type-preview";
        preview.textContent = parameterTypeLabel(parameter);
        detail.appendChild(preview);

        const content = document.createElement("div");
        content.className = "method-parameter-content";
        content.append(main, detail);
        row.appendChild(content);

        if (mode === "ref" || mode === "out") {
          row.appendChild(decoratePort(makePort(node.id, parameter.id, "out", connectedPorts), parameterTypeKey(parameter)));
        }

        return row;
      };

      const makeReturnEditor = (target, access) => {
        ensureFunctionSignature(target, access);
        const wrap = document.createElement("div");
        wrap.className = "method-return-row" + (target.returnType === "void" ? " is-void" : "");

        const typeControl = document.createElement("div");
        typeControl.className = "return-type-control";

        const voidButton = document.createElement("button");
        voidButton.type = "button";
        voidButton.className = "return-void-button" + (target.returnType === "void" ? " active" : "");
        voidButton.textContent = "void";
        voidButton.addEventListener("pointerdown", (event) => event.stopPropagation());
        voidButton.addEventListener("click", (event) => {
          event.stopPropagation();
          if (target.returnPortId) removeConnectionsForRef(target.returnPortId);
          target.returnType = "void";
          target.returnCollectionKind = "single";
          rerenderNode();
        });

        const picker = typePicker(target.returnType === "void" ? "Type" : target.returnType, (value) => {
          target.returnType = value;
          rerenderNode();
        }, "return-type-picker");

        typeControl.append(voidButton, picker);

        const name = inlineInput(target.returnName || "result", "nome risultato", (value) => {
          target.returnName = value;
        }, "return-name-input");

        const collection = compactSelect(target.returnCollectionKind || "single", [
          ["single", "Single"],
          ["array", "Array"],
          ["list", "List"],
          ["dictionary", "Dictionary"]
        ], (value) => {
          target.returnCollectionKind = value;
          rerenderNode();
        }, "return-collection-select");

        const content = document.createElement("div");
        content.className = "method-return-content";
        content.append(typeControl);

        if (target.returnType !== "void") {
          content.append(name, collection);

          if (target.returnCollectionKind === "array") {
            const length = document.createElement("input");
            length.type = "number";
            length.min = "0";
            length.className = "inline-size-input";
            length.value = target.returnArrayLength || "";
            length.placeholder = "Length";
            length.addEventListener("pointerdown", (event) => event.stopPropagation());
            length.addEventListener("input", () => {
              target.returnArrayLength = Math.max(0, Number(length.value) || 0);
              markDirty();
            });
            content.appendChild(length);
          } else if (target.returnCollectionKind === "dictionary") {
            content.appendChild(typePicker(target.returnDictionaryKeyType, (value) => {
              target.returnDictionaryKeyType = value;
              rerenderNode();
            }, "inline-key-type-picker"));
          }

          const preview = document.createElement("code");
          preview.className = "method-type-preview return-preview";
          preview.textContent = collectionTypeLabel(
            target.returnCollectionKind,
            target.returnType,
            target.returnDictionaryKeyType,
            target.returnArrayLength
          );
          content.appendChild(preview);
        } else {
          const message = document.createElement("span");
          message.className = "void-return-message";
          message.textContent = "Nessun valore restituito";
          content.appendChild(message);
        }

        wrap.appendChild(content);

        if (target.returnType !== "void") {
          wrap.appendChild(decoratePort(makePort(node.id, target.returnPortId, "out", connectedPorts), collectionTypeKey(
            target.returnCollectionKind,
            target.returnType,
            target.returnDictionaryKeyType
          )));
        }

        return wrap;
      };

      const makeParameterSection = (target, access) => {
        ensureFunctionSignature(target, access);
        const section = document.createElement("div");
        section.className = "method-parameters-section";
        section.appendChild(makeMethodMiniHeading("PARAMETERS", target.methodParameters.length));

        const list = document.createElement("div");
        list.className = "method-parameter-list";
        target.methodParameters.forEach((parameter) => list.appendChild(makeParameterEditor(target, parameter, access)));

        const add = document.createElement("button");
        add.type = "button";
        add.className = "method-add-parameter";
        add.textContent = "＋ Parameter";
        add.addEventListener("pointerdown", (event) => event.stopPropagation());
        add.addEventListener("click", (event) => {
          event.stopPropagation();
          const parameter = functionParameter("value" + (target.methodParameters.length + 1), "int", {
            access: access || target.access || target.methodAccess || "public"
          });
          target.methodParameters.push(parameter);
          syncLegacyParameters(target);
          rerenderNode();
        });

        section.append(list, add);
        return section;
      };

      const makeMethodModeToggle = (target) => {
        ensureFunctionSignature(target, target.access || target.methodAccess);
        const wrap = document.createElement("div");
        wrap.className = "method-mode-switch";
        [["basic", "Basic"], ["advanced", "Advanced"]].forEach(([value, label]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "method-mode-button" + (target.methodEditorMode === value ? " active" : "");
          button.textContent = label;
          button.addEventListener("pointerdown", (event) => event.stopPropagation());
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            target.methodEditorMode = value;
            rerenderNode();
          });
          wrap.appendChild(button);
        });
        return wrap;
      };

      const makeMethodBodyWorkspace = (target) => {
        ensureFunctionSignature(target, target.access || target.methodAccess);

        const section = document.createElement("section");
        section.className = "method-body-section nested-graph-section";
        section.appendChild(makeMethodMiniHeading("FUNCTION BODY", "sub graph"));

        const portal = document.createElement("button");
        portal.type = "button";
        portal.className = "nested-graph-portal";
        portal.addEventListener("pointerdown", (event) => event.stopPropagation());
        portal.addEventListener("click", (event) => {
          event.stopPropagation();
          openNestedGraph(
            target,
            "function",
            (target.title || target.label || "Function") + " · Function Body"
          );
        });

        const icon = document.createElement("span");
        icon.className = "nested-graph-portal-icon";
        icon.textContent = "◇";

        const copy = document.createElement("span");
        copy.className = "nested-graph-portal-copy";
        const title = document.createElement("strong");
        title.textContent = "Apri Function Body";
        const detail = document.createElement("small");
        const count = target.methodBody && Array.isArray(target.methodBody.nodes)
          ? target.methodBody.nodes.filter((entry) => entry.id !== "__graph_input__" && entry.id !== "__graph_output__").length
          : 0;
        detail.textContent = count
          ? count + (count === 1 ? " blocco nel sotto-grafo" : " blocchi nel sotto-grafo")
          : "Canvas annidato · input e output vengono creati automaticamente";

        copy.append(title, detail);
        const arrow = document.createElement("span");
        arrow.className = "nested-graph-portal-arrow";
        arrow.textContent = "→";
        portal.append(icon, copy, arrow);
        section.appendChild(portal);
        return section;
      };

      if (node.type === "function") {
        ensureFunctionSignature(node, node.methodAccess);

        if (currentSchemaId() === "unity") {
          const functionMeta = document.createElement("div");
          functionMeta.className = "node-function-inline redesigned-function-meta";

          const ownerOptions = [["", "No owner"]].concat(allClassNodes().map((item) => [item.id, item.title]));
          functionMeta.append(
            compactSelect(node.methodAccess, ["public", "private", "protected", "internal"], (value) => {
              node.methodAccess = value;
              node.methodParameters.forEach((parameter) => { parameter.access = value; });
              rerenderNode();
            }, "inline-access-select"),
            compactSelect(node.methodKind, [
              ["custom", "Custom"],
              ["lifecycle", "Unity"],
              ["eventHandler", "Handler"],
              ["unityEventListener", "Listener"],
              ["coroutine", "Coroutine"]
            ], (value) => {
              node.methodKind = value;
              if (value === "lifecycle") applyLifecyclePreset(node, UNITY_LIFECYCLE[0]);
              rerenderNode();
            }, "inline-method-kind"),
            compactSelect(node.ownerClassId, ownerOptions, (value) => {
              node.ownerClassId = value;
              rerenderNode();
            }, "function-owner-select")
          );

          if (node.methodKind === "lifecycle") {
            functionMeta.appendChild(compactSelect(node.title, UNITY_LIFECYCLE.map((preset) => [preset.name, preset.name + "()"]), (value) => {
              const preset = UNITY_LIFECYCLE.find((entry) => entry.name === value);
              if (preset) {
                applyLifecyclePreset(node, preset);
                rerenderNode();
              }
            }, "lifecycle-callback-select"));
          }

          body.appendChild(functionMeta);
        } else {
          node.ownerClassId = "";
          node.methodKind = "custom";
        }

        body.appendChild(makeMethodModeToggle(node));

        body.appendChild(makeParameterSection(node, node.methodAccess));

        body.appendChild(makeMethodMiniHeading("COMMENT", "summary"));

        const methodNotes = document.createElement("textarea");
        methodNotes.className = "method-description-inline standalone-method-description";
        methodNotes.value = node.methodDescription || "";
        methodNotes.placeholder = "Cosa fa questa funzione? Spiega regole, effetti e risultato…";
        methodNotes.spellcheck = true;
        methodNotes.addEventListener("pointerdown", (event) => event.stopPropagation());
        methodNotes.addEventListener("input", () => {
          node.methodDescription = methodNotes.value;
          markDirty();
        });
        body.appendChild(methodNotes);

        if (node.methodEditorMode === "advanced") {
          body.appendChild(makeMethodBodyWorkspace(node));
        } else {
          const logicSection = document.createElement("div");
          logicSection.className = "method-logic-section";
          logicSection.appendChild(makeMethodMiniHeading("PSEUDOCODE", "optional"));

          const logic = document.createElement("textarea");
          logic.className = "node-pseudo-inline method-logic-editor";
          logic.value = node.methodLogic || node.pseudo || "";
          logic.placeholder = "Passaggi interni, formule, condizioni o chiamate…";
          logic.spellcheck = false;
          logic.addEventListener("pointerdown", (event) => event.stopPropagation());
          logic.addEventListener("input", () => {
            node.methodLogic = logic.value;
            node.pseudo = logic.value;
            markDirty();
          });
          logicSection.appendChild(logic);
          body.appendChild(logicSection);

          const returnSection = document.createElement("div");
          returnSection.className = "method-return-section";
          returnSection.append(
            makeMethodMiniHeading("RETURN", node.returnType === "void" ? "void" : 1),
            makeReturnEditor(node, node.methodAccess)
          );
          body.appendChild(returnSection);
        }
      }

      const removeMember = (item) => {
        if (node.type === "jobStruct" && item.jobExecute) {
          showToast("Execute è obbligatorio per un Unity Job.");
          return;
        }
        if (item.kind === "component" && item.locked) {
          showToast("Transform è obbligatorio su ogni GameObject.");
          return;
        }

        const nestedRefs = new Set([item.id]);
        if (item.kind === "function") {
          ensureFunctionSignature(item, item.access);
          item.methodParameters.forEach((parameter) => nestedRefs.add(parameter.id));
          nestedRefs.add(item.returnPortId);
        }

        node.rows = node.rows.filter((rowItem) => rowItem.id !== item.id);
        project.connections = project.connections.filter((edge) =>
          !nestedRefs.has(edge.from.rowId) && !nestedRefs.has(edge.to.rowId)
        );
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

      const makeCompactMethodIO = (item) => {
        ensureFunctionSignature(item, item.access);
        const lane = document.createElement("div");
        lane.className = "compact-method-io";

        item.methodParameters.forEach((parameter) => {
          const chip = document.createElement("div");
          chip.className = "compact-io-chip parameter-chip";

          if (parameter.mode !== "out") {
            chip.appendChild(decoratePort(
              makePort(node.id, parameter.id, "in", connectedPorts),
              parameterTypeKey(parameter)
            ));
          }

          const copy = document.createElement("span");
          copy.textContent = csharpParameterText(parameter);
          chip.appendChild(copy);

          if (parameter.mode === "ref" || parameter.mode === "out") {
            chip.appendChild(decoratePort(
              makePort(node.id, parameter.id, "out", connectedPorts),
              parameterTypeKey(parameter)
            ));
          }

          lane.appendChild(chip);
        });

        if (item.returnType && item.returnType !== "void") {
          const result = document.createElement("div");
          result.className = "compact-io-chip return-chip";

          const copy = document.createElement("span");
          copy.textContent = methodReturnTypeKey(item) + " " + (item.returnName || "result");
          result.append(copy, decoratePort(
            makePort(node.id, item.returnPortId, "out", connectedPorts),
            methodReturnTypeKey(item)
          ));
          lane.appendChild(result);
        }

        return lane;
      };

      const makeMemberSummaryToggle = (item, expanded) => {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "member-summary-toggle" + (expanded ? " expanded" : "");
        toggle.title = expanded ? "Comprimi membro" : "Modifica membro";
        toggle.addEventListener("pointerdown", (event) => event.stopPropagation());
        toggle.addEventListener("click", (event) => {
          event.stopPropagation();
          item.uiExpanded = !item.uiExpanded;
          rerenderNode();
        });

        const chevron = document.createElement("span");
        chevron.className = "member-summary-chevron";
        chevron.textContent = expanded ? "▾" : "▸";

        const copy = document.createElement("span");
        copy.className = "member-summary-copy";

        const signature = document.createElement("code");
        signature.className = "member-code-signature";
        signature.textContent = memberCompactSignature(item);
        copy.appendChild(signature);

        const commentText = memberCompactComment(item);
        if (commentText) {
          const comment = document.createElement("span");
          comment.className = "member-code-comment";
          comment.textContent = "// " + commentText.replace(/\s+/g, " ").trim();
          copy.appendChild(comment);
        }

        toggle.append(chevron, copy);
        return toggle;
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
          item.kind === "flowIn" ||
          item.kind === "condition" ||
          item.kind === "input";
        const allowOutput =
          item.kind === "variable" ||
          item.kind === "property" ||
          item.kind === "unityEvent" ||
          item.kind === "component" ||
          item.kind === "flowOut" ||
          item.kind === "condition" ||
          item.kind === "output";

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

        const collapsibleKinds = new Set(["variable", "property", "function", "unityEvent", "component"]);
        const collapsible = collapsibleKinds.has(item.kind);
        const expanded = !collapsible || !!item.uiExpanded;
        if (collapsible) {
          rowElement.classList.add("member-collapsible");
          rowElement.classList.toggle("member-expanded", expanded);
          rowElement.classList.toggle("member-collapsed", !expanded);
          editor.appendChild(makeMemberSummaryToggle(item, expanded));
        }

        if (collapsible && !expanded) {
          if (item.kind === "function") {
            editor.appendChild(makeCompactMethodIO(item));
          }

          const remove = document.createElement("button");
          remove.className = "inline-remove-member" + (item.kind === "component" && item.locked ? " locked" : "");
          remove.type = "button";
          remove.textContent = item.kind === "component" && item.locked ? "•" : "×";
          remove.title = item.kind === "component" && item.locked ? "Componente obbligatorio" : "Rimuovi membro";
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
        }

        const topLine = document.createElement("div");
        topLine.className = "inline-member-top";

        if (item.kind === "variable" || item.kind === "property") {
          const access = currentSchemaId() === "unity"
            ? compactSelect(item.access, ["public", "private", "protected", "internal"], (value) => {
                item.access = value;
                if (value === "public" && item.collectionKind !== "dictionary") item.serialized = true;
                rerenderNode();
              }, "inline-access-select")
            : null;

          const type = typePicker(item.dataType, (value) => {
            item.dataType = value;
            if (currentSchemaId() === "unity" &&
                publicClassNodes().some((classNode) => classNode.title === value) &&
                item.referenceMode === "value") {
              item.referenceMode = "inspector";
            }
            rerenderNode();
          }, "inline-type-picker");

          const name = inlineInput(item.label, "nome", (value) => {
            item.label = value;
          }, "inline-name-input");

          if (access) topLine.appendChild(access);
          topLine.append(type, name);

          const collectionLine = document.createElement("div");
          collectionLine.className = "inline-collection-row";

          const inlineCollectionOptions = node.type === "jobStruct"
            ? [
                ["single", "Single"],
                ["nativeArray", "NativeArray"],
                ["nativeList", "NativeList"],
                ["nativeReference", "NativeReference"]
              ]
            : [
                ["single", "Single"],
                ["array", "Array"],
                ["list", "List"],
                ["dictionary", "Dictionary"]
              ];
          const collection = compactSelect(item.collectionKind, inlineCollectionOptions, (value) => {
            item.collectionKind = value;
            if (value === "dictionary") item.serialized = false;
            rerenderNode();
          }, "inline-collection-select");
          collectionLine.appendChild(collection);

          if (item.collectionKind === "array") {
            const length = document.createElement("input");
            length.type = "number";
            length.min = "0";
            length.className = "inline-size-input";
            length.value = item.arrayLength || "";
            length.placeholder = "Length";
            length.title = "Lunghezza prevista dell'array";
            length.addEventListener("pointerdown", (event) => event.stopPropagation());
            length.addEventListener("input", () => {
              item.arrayLength = Math.max(0, Number(length.value) || 0);
              markDirty();
            });
            collectionLine.appendChild(length);
          } else if (item.collectionKind === "list") {
            const count = document.createElement("input");
            count.type = "number";
            count.min = "0";
            count.className = "inline-size-input";
            count.value = item.listInitialCount || "";
            count.placeholder = "Initial";
            count.title = "Numero iniziale previsto di elementi";
            count.addEventListener("pointerdown", (event) => event.stopPropagation());
            count.addEventListener("input", () => {
              item.listInitialCount = Math.max(0, Number(count.value) || 0);
              markDirty();
            });
            collectionLine.appendChild(count);
          } else if (item.collectionKind === "dictionary") {
            const keyType = typePicker(item.dictionaryKeyType, (value) => {
              item.dictionaryKeyType = value;
              rerenderNode();
            }, "inline-key-type-picker");
            keyType.title = "Tipo della chiave";
            collectionLine.appendChild(keyType);
          }

          const collectionPreview = document.createElement("span");
          collectionPreview.className = "collection-preview";
          collectionPreview.textContent = variableTypeLabel(item);
          collectionLine.appendChild(collectionPreview);

          const second = document.createElement("div");
          second.className = "inline-member-bottom";

          if (node.type === "jobStruct") {
            item.referenceMode = "value";
            item.serialized = false;
            const jobAccess = compactSelect(item.jobAccess || "readwrite", [
              ["readwrite", "Read / Write"],
              ["readonly", "[ReadOnly]"],
              ["writeonly", "[WriteOnly]"]
            ], (value) => {
              item.jobAccess = value;
              rerenderNode();
            }, "inline-reference-select");
            const jobType = document.createElement("span");
            jobType.className = "collection-preview";
            jobType.textContent = variableTypeLabel(item);
            second.append(jobAccess, jobType);
          } else {
            const enumType = enumByName(item.dataType);
            let defaultValue;
            if (enumType && item.collectionKind === "single" && !enumType.enumFlags) {
              const enumOptions = enumType.enumValues.map((entry) => [entry.name, entry.name]);
              if (!item.defaultValue && enumOptions.length) item.defaultValue = enumOptions[0][0];
              defaultValue = compactSelect(item.defaultValue, enumOptions, (value) => {
                item.defaultValue = value;
                markDirty();
              }, "inline-default-select");
            } else {
              defaultValue = inlineInput(
                item.defaultValue,
                enumType && enumType.enumFlags ? "None | FlagA | FlagB" : "default",
                (value) => { item.defaultValue = value; },
                "inline-default-input"
              );
            }

            if (currentSchemaId() === "unity") {
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

              const serialized = document.createElement("button");
              serialized.type = "button";
              serialized.className = "inline-flag" + (item.serialized ? " active" : "") + (item.collectionKind === "dictionary" ? " disabled" : "");
              serialized.textContent = "S";
              serialized.title = item.collectionKind === "dictionary"
                ? "Unity non serializza Dictionary direttamente"
                : "SerializeField / Inspector";
              serialized.addEventListener("pointerdown", (event) => event.stopPropagation());
              serialized.addEventListener("click", (event) => {
                event.stopPropagation();
                if (item.collectionKind === "dictionary") {
                  showToast("Unity non serializza Dictionary direttamente: usa gestione custom.");
                  return;
                }
                item.serialized = !item.serialized;
                rerenderNode();
              });
              second.append(reference, defaultValue, serialized);
            } else {
              item.referenceMode = "value";
              item.serialized = false;
              second.appendChild(defaultValue);
            }
          }

          editor.append(topLine, collectionLine, second);
        } else if (item.kind === "function") {
          ensureFunctionSignature(item, item.access);
          rowElement.classList.add("method-member-row");

          const access = compactSelect(item.access, ["public", "private", "protected", "internal"], (value) => {
            item.access = value;
            item.methodParameters.forEach((parameter) => { parameter.access = value; });
            rerenderNode();
          }, "inline-access-select");

          const methodKind = compactSelect(item.methodKind, [
            ["custom", "Custom"],
            ["lifecycle", "Unity"],
            ["eventHandler", "Handler"],
            ["unityEventListener", "Listener"],
            ["coroutine", "Coroutine"]
          ], (value) => {
            item.methodKind = value;
            if (value === "lifecycle") applyLifecyclePreset(item, UNITY_LIFECYCLE[0]);
            rerenderNode();
          }, "inline-method-kind");

          const name = inlineInput(item.label, "Metodo", (value) => {
            item.label = value;
          }, "inline-name-input");

          topLine.append(access, methodKind, name);
          editor.appendChild(topLine);

          if (item.methodKind === "lifecycle") {
            const callbackLine = document.createElement("div");
            callbackLine.className = "method-callback-line";
            callbackLine.appendChild(compactSelect(item.label, UNITY_LIFECYCLE.map((preset) => [preset.name, preset.name + "()"]), (value) => {
              const preset = UNITY_LIFECYCLE.find((entry) => entry.name === value);
              if (preset) {
                applyLifecyclePreset(item, preset);
                rerenderNode();
              }
            }, "lifecycle-callback-select"));
            editor.appendChild(callbackLine);
          }

          editor.appendChild(makeMethodModeToggle(item));
          editor.appendChild(makeParameterSection(item, item.access));

          editor.appendChild(makeMethodMiniHeading("COMMENT", "summary"));

          const description = document.createElement("textarea");
          description.className = "method-description-inline";
          description.value = item.methodDescription || "";
          description.placeholder = "Cosa fa questo metodo? Regole, effetti e risultato…";
          description.spellcheck = true;
          description.addEventListener("pointerdown", (event) => event.stopPropagation());
          description.addEventListener("input", () => {
            item.methodDescription = description.value;
            markDirty();
          });
          editor.appendChild(description);

          if (item.methodEditorMode === "advanced") {
            editor.appendChild(makeMethodBodyWorkspace(item));
          } else {
            const logicSection = document.createElement("div");
            logicSection.className = "method-logic-section";
            logicSection.appendChild(makeMethodMiniHeading("PSEUDOCODE", "optional"));

            const logic = document.createElement("textarea");
            logic.className = "method-logic-inline";
            logic.value = item.methodLogic || "";
            logic.placeholder = "Passaggi interni, formule, condizioni o chiamate…";
            logic.spellcheck = false;
            logic.addEventListener("pointerdown", (event) => event.stopPropagation());
            logic.addEventListener("input", () => {
              item.methodLogic = logic.value;
              markDirty();
            });
            logicSection.appendChild(logic);
            editor.appendChild(logicSection);

            const returnSection = document.createElement("div");
            returnSection.className = "method-return-section";
            returnSection.append(
              makeMethodMiniHeading("RETURN", item.returnType === "void" ? "void" : 1),
              makeReturnEditor(item, item.access)
            );
            editor.appendChild(returnSection);
          }
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
        } else if (item.kind === "flowIn" || item.kind === "flowOut") {
          rowElement.classList.add("flow-member-row");
          const flowLabel = document.createElement("div");
          flowLabel.className = "flow-member-label";
          const strong = document.createElement("strong");
          strong.textContent = item.label || (item.kind === "flowIn" ? "Enter" : "Next");
          const small = document.createElement("small");
          small.textContent = item.kind === "flowIn" ? "FLOW INPUT" : "FLOW OUTPUT";
          flowLabel.append(strong, small);
          editor.appendChild(flowLabel);
        } else if (item.kind === "component") {
          rowElement.classList.add("unity-component-row");
          rowElement.dataset.componentCategory = item.componentCategory;

          const componentName = document.createElement("div");
          componentName.className = "component-inline-name";
          const strong = document.createElement("strong");
          strong.textContent = item.componentType;
          const source = document.createElement("small");
          source.textContent = item.componentSource === "script"
            ? "Script · " + componentCategoryLabel(item.componentCategory)
            : "Unity · " + componentCategoryLabel(item.componentCategory);
          componentName.append(strong, source);

          const enabled = document.createElement("button");
          enabled.type = "button";
          enabled.className = "component-enabled" + (item.enabled ? " active" : "");
          enabled.textContent = item.enabled ? "ON" : "OFF";
          enabled.title = item.locked ? "Transform è sempre presente" : "Abilita / disabilita componente";
          enabled.disabled = !!item.locked;
          enabled.addEventListener("pointerdown", (event) => event.stopPropagation());
          enabled.addEventListener("click", (event) => {
            event.stopPropagation();
            if (item.locked) return;
            item.enabled = !item.enabled;
            rerenderNode();
          });

          topLine.classList.add("component-member-top");
          topLine.append(componentName, enabled);
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
        remove.className = "inline-remove-member" + (item.kind === "component" && item.locked ? " locked" : "");
        remove.type = "button";
        remove.textContent = item.kind === "component" && item.locked ? "•" : "×";
        remove.title = item.kind === "component" && item.locked ? "Componente obbligatorio" : "Rimuovi membro";
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
        const pushOpenMember = (member) => {
          member.uiExpanded = true;
          node.rows.push(member);
          return member;
        };

        if (action === "variable") pushOpenMember(variableRow("newVariable", "int", "private"));
        if (action === "arrayVariable") {
          const variable = variableRow("newArray", "int", "private");
          variable.collectionKind = "array";
          pushOpenMember(variable);
        }
        if (action === "listVariable") {
          const variable = variableRow("newList", "int", "private");
          variable.collectionKind = "list";
          pushOpenMember(variable);
        }
        if (action === "dictionaryVariable") {
          const variable = variableRow("newDictionary", "int", "private");
          variable.collectionKind = "dictionary";
          variable.serialized = false;
          pushOpenMember(variable);
        }
        if (action === "method") pushOpenMember(methodRow("NewMethod", "void", "custom"));
        if (action === "lifecycle") pushOpenMember(methodRow("Start", "void", "lifecycle"));
        if (action === "coroutine") {
          const method = methodRow("NewCoroutine", "IEnumerator", "coroutine");
          pushOpenMember(method);
        }
        if (action === "event") pushOpenMember(eventRow("OnEvent", "void"));
        if (action === "dataInput") node.rows.push(row("input" + (node.rows.filter((item) => item.kind === "input").length + 1), "int", "input"));
        if (action === "dataOutput") node.rows.push(row("output" + (node.rows.filter((item) => item.kind === "output").length + 1), "int", "output"));
        if (action === "flowInput") node.rows.push(row("Enter", "", "flowIn"));
        if (action === "flowOutput") node.rows.push(row("Next" + (node.rows.filter((item) => item.kind === "flowOut").length + 1), "", "flowOut"));
        if (action.startsWith("component:")) {
          const componentType = action.slice("component:".length);
          if (componentType === "Transform" && node.rows.some((item) => item.kind === "component" && item.componentType === "Transform")) {
            showToast("Il GameObject ha già Transform.");
          } else {
            pushOpenMember(componentRow(componentType, componentCategoryFor(componentType), "unity"));
          }
        }
        if (action.startsWith("script:")) {
          const classId = action.slice("script:".length);
          const scriptClass = nodeById(classId);
          if (scriptClass) {
            pushOpenMember(componentRow(scriptClass.title, "scripts", "script", {
              componentClassId: scriptClass.id,
              locked: false
            }));
          }
        }
        if (action.startsWith("class:")) {
          const className = action.slice(6);
          const variable = variableRow(className.charAt(0).toLowerCase() + className.slice(1), className, "private");
          variable.referenceMode = "inspector";
          variable.serialized = true;
          pushOpenMember(variable);
        }
        rerenderNode();
      };

      const makeCustomScrollRail = (scroller) => {
        const rail = document.createElement("div");
        rail.className = "custom-scroll-rail";
        const thumb = document.createElement("div");
        thumb.className = "custom-scroll-thumb";
        rail.appendChild(thumb);

        const refresh = () => {
          const scrollable = scroller.classList.contains("scrollable") &&
            scroller.scrollHeight > scroller.clientHeight + 1;

          rail.classList.toggle("visible", scrollable);
          if (!scrollable) {
            thumb.style.height = "0px";
            thumb.style.transform = "translateY(0)";
            return;
          }

          const viewportHeight = scroller.clientHeight;
          const contentHeight = scroller.scrollHeight;
          const railHeight = Math.max(1, rail.clientHeight);
          const thumbHeight = Math.max(34, Math.round(railHeight * viewportHeight / contentHeight));
          const maxThumbTop = Math.max(0, railHeight - thumbHeight);
          const maxScroll = Math.max(1, contentHeight - viewportHeight);
          const thumbTop = maxThumbTop * scroller.scrollTop / maxScroll;

          thumb.style.height = thumbHeight + "px";
          thumb.style.transform = "translateY(" + thumbTop + "px)";
        };

        scroller._refreshCustomScroll = refresh;
        scroller.addEventListener("scroll", refresh, { passive: true });

        rail.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.target === thumb) return;

          const rect = rail.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
          scroller.scrollTop = ratio * Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          refresh();
        });

        thumb.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const startY = event.clientY;
          const startScroll = scroller.scrollTop;
          const maxScroll = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
          const railHeight = Math.max(1, rail.clientHeight);
          const thumbHeight = Math.max(34, thumb.offsetHeight);
          const maxThumbTop = Math.max(1, railHeight - thumbHeight);

          const move = (moveEvent) => {
            moveEvent.preventDefault();
            const screenDelta = moveEvent.clientY - startY;
            const localDelta = screenDelta / Math.max(0.01, view.scale);
            scroller.scrollTop = Math.max(0, Math.min(
              maxScroll,
              startScroll + localDelta * (maxScroll / maxThumbTop)
            ));
            refresh();
          };

          const end = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", end);
          };

          window.addEventListener("pointermove", move, { passive: false });
          window.addEventListener("pointerup", end, { once: true });
        });

        requestAnimationFrame(refresh);
        return rail;
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
          if (items.length >= 6 && titleText !== "VARIABLES" && titleText !== "DATA") {
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
              memberList.querySelectorAll(".component-category-group").forEach((group) => {
                const visibleRows = Array.from(group.querySelectorAll(".inline-edit-row")).some((row) => row.style.display !== "none");
                group.style.display = visibleRows ? "" : "none";
              });
              updateMemberScroll();
              renderEdges();
            });

            const density = document.createElement("span");
            density.className = "section-density-label";
            density.textContent = items.length + " elementi";

            tools.append(search, density);
            content.appendChild(tools);
          }

          memberList = document.createElement("div");
          memberList.className = "section-member-list";

          const updateMemberScroll = () => {
            memberList.classList.remove("scrollable");
            requestAnimationFrame(() => {
              const limit = memberScrollLimit(node, titleText);
              memberList.style.setProperty("--member-scroll-limit", limit + "px");
              const needsScroll = memberList.scrollHeight > limit;
              memberList.classList.toggle("scrollable", needsScroll);
              if (!needsScroll) memberList.scrollTop = 0;
              if (typeof memberList._refreshCustomScroll === "function") {
                requestAnimationFrame(memberList._refreshCustomScroll);
              }
              renderEdges();
            });
          };

          memberList.addEventListener("scroll", () => renderEdges(), { passive: true });
          memberList.addEventListener("wheel", (event) => {
            if (memberList.classList.contains("scrollable")) event.stopPropagation();
          }, { passive: true });

          if (titleText === "COMPONENTS") {
            const grouped = new Map();
            items.forEach((item) => {
              const key = item.componentCategory || "other";
              if (!grouped.has(key)) grouped.set(key, []);
              grouped.get(key).push(item);
            });

            grouped.forEach((categoryItems, categoryId) => {
              const group = document.createElement("div");
              const categoryCollapsed = !!node.uiComponentCategories[categoryId];
              group.className = "component-category-group" + (categoryCollapsed ? " collapsed" : "");

              const categoryButton = document.createElement("button");
              categoryButton.type = "button";
              categoryButton.className = "component-category-toggle";
              categoryButton.addEventListener("pointerdown", (event) => event.stopPropagation());
              categoryButton.addEventListener("click", (event) => {
                event.stopPropagation();
                node.uiComponentCategories[categoryId] = !node.uiComponentCategories[categoryId];
                rerenderNode();
              });

              const arrow = document.createElement("span");
              arrow.className = "component-category-chevron";
              arrow.textContent = categoryCollapsed ? "▸" : "▾";

              const title = document.createElement("span");
              title.className = "component-category-name";
              title.textContent = componentCategoryLabel(categoryId);

              const badge = document.createElement("span");
              badge.className = "component-category-count";
              badge.textContent = String(categoryItems.length);

              categoryButton.append(arrow, title, badge);
              group.appendChild(categoryButton);

              const rowsWrap = document.createElement("div");
              rowsWrap.className = "component-category-items";
              categoryItems.forEach((item) => {
                const rowElement = makeRowElement(item);
                rowElement.dataset.search = [
                  item.label,
                  item.componentType,
                  item.componentCategory
                ].filter(Boolean).join(" ").toLowerCase();
                rowsWrap.appendChild(rowElement);
              });
              group.appendChild(rowsWrap);
              memberList.appendChild(group);
            });
          } else {
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
          }
          const scrollShell = document.createElement("div");
          scrollShell.className = "section-scroll-shell";
          scrollShell.append(memberList, makeCustomScrollRail(memberList));
          content.appendChild(scrollShell);
          updateMemberScroll();
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

          if (titleText === "COMPONENTS") {
            popup.classList.add("fan-popup");

            const groups = [];
            let current = null;
            actions.forEach((action) => {
              if (action.header) {
                current = { label: action.label, items: [] };
                groups.push(current);
              } else {
                if (!current) {
                  current = { label: "OTHER", items: [] };
                  groups.push(current);
                }
                current.items.push(action);
              }
            });

            const homeView = document.createElement("div");
            homeView.className = "fan-home-view";

            const detailView = document.createElement("div");
            detailView.className = "fan-detail-view";

            const detailHeader = document.createElement("div");
            detailHeader.className = "fan-detail-header";

            const backButton = document.createElement("button");
            backButton.type = "button";
            backButton.className = "fan-back-button";
            backButton.innerHTML = '<span>←</span><span>Indietro</span>';
            backButton.addEventListener("pointerdown", (event) => event.stopPropagation());

            const detailTitle = document.createElement("strong");
            detailTitle.className = "fan-detail-title";
            detailHeader.append(backButton, detailTitle);

            const detailOptions = document.createElement("div");
            detailOptions.className = "fan-detail-options";
            detailView.append(detailHeader, detailOptions);

            const positionFanPopup = () => {
              const buttonRect = addButton.getBoundingClientRect();
              const viewportRect = viewport.getBoundingClientRect();
              const availableAbove = Math.max(120, buttonRect.top - viewportRect.top - 14);
              const availableBelow = Math.max(120, viewportRect.bottom - buttonRect.bottom - 14);
              const openDown = availableBelow > availableAbove;
              const available = openDown ? availableBelow : availableAbove;
              const maxHeight = Math.max(180, Math.min(560, Math.floor(available)));

              popup.classList.toggle("open-down", openDown);
              popup.style.setProperty("--popup-inverse-scale", String(1 / Math.max(0.01, view.scale)));
              popup.style.setProperty("--popup-max-height", maxHeight + "px");
            };

            const updatePopupOverflow = () => {
              popup.classList.remove("needs-scroll");
              positionFanPopup();
              requestAnimationFrame(() => {
                const maxHeight = parseFloat(getComputedStyle(popup).getPropertyValue("--popup-max-height")) || 560;
                popup.classList.toggle("needs-scroll", popup.scrollHeight > maxHeight + 2);
              });
            };

            const resetFanPopup = () => {
              popup.classList.remove("detail-mode");
              detailTitle.textContent = "";
              detailOptions.innerHTML = "";
              popup.scrollTop = 0;
              updatePopupOverflow();
            };

            backButton.addEventListener("click", (event) => {
              event.stopPropagation();
              resetFanPopup();
              popup.scrollTop = 0;
            });

            groups.forEach((groupData, index) => {
              const categoryButton = document.createElement("button");
              categoryButton.type = "button";
              categoryButton.className = "fan-category";
              categoryButton.style.setProperty("--fan-index", String(index));
              categoryButton.innerHTML =
                '<span class="fan-category-copy"><strong>' + groupData.label + '</strong><small>' +
                groupData.items.length + ' elementi</small></span><span class="fan-category-arrow">›</span>';
              categoryButton.addEventListener("pointerdown", (event) => event.stopPropagation());
              categoryButton.addEventListener("click", (event) => {
                event.stopPropagation();
                detailTitle.textContent = groupData.label;
                detailOptions.innerHTML = "";

                groupData.items.forEach((action) => {
                  const button = document.createElement("button");
                  button.type = "button";
                  button.className = "fan-option";
                  button.textContent = action.label;
                  button.addEventListener("pointerdown", (pointerEvent) => pointerEvent.stopPropagation());
                  button.addEventListener("click", (clickEvent) => {
                    clickEvent.stopPropagation();
                    addMemberFromAction(action.value);
                  });
                  detailOptions.appendChild(button);
                });

                popup.classList.add("detail-mode");
                popup.scrollTop = 0;
                updatePopupOverflow();
              });
              homeView.appendChild(categoryButton);
            });

            popup._resetFanPopup = resetFanPopup;
            popup._updatePopupOverflow = updatePopupOverflow;
            popup.append(homeView, detailView);
          } else {
            actions.forEach((action) => {
              if (action.header) {
                const header = document.createElement("div");
                header.className = "section-add-group";
                header.textContent = action.label;
                popup.appendChild(header);
                return;
              }

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
          }

          addButton.addEventListener("click", (event) => {
            event.stopPropagation();
            const willOpen = !popup.classList.contains("open");
            closeInterfaceSurfaces(willOpen ? popup : null);

            if (willOpen && typeof popup._resetFanPopup === "function") popup._resetFanPopup();
            popup.classList.toggle("open", willOpen);
            popup.setAttribute("aria-hidden", willOpen ? "false" : "true");

            if (willOpen && typeof popup._updatePopupOverflow === "function") {
              popup.scrollTop = 0;
              popup._updatePopupOverflow();
            }
            if (willOpen) keepSurfaceInViewport(popup, 12);
          });

          addWrap.append(addButton, popup);
          content.appendChild(addWrap);
        }

        section.appendChild(content);
        body.appendChild(section);
      };

      if (node.type === "emptyGraph") {
        appendSection("INPUTS", node.rows.filter((item) => item.kind === "flowIn" || item.kind === "input"), [
          { label: "Flow Input", value: "flowInput" },
          { label: "Data Input", value: "dataInput" }
        ]);
        appendSection("OUTPUTS", node.rows.filter((item) => item.kind === "flowOut" || item.kind === "output"), [
          { label: "Flow Output", value: "flowOutput" },
          { label: "Data Output", value: "dataOutput" }
        ]);

        const portalWrap = document.createElement("section");
        portalWrap.className = "method-body-section nested-graph-section empty-graph-portal-section";
        const portal = document.createElement("button");
        portal.type = "button";
        portal.className = "nested-graph-portal";
        portal.addEventListener("pointerdown", (event) => event.stopPropagation());
        portal.addEventListener("click", (event) => {
          event.stopPropagation();
          openNestedGraph(node, "empty", (node.title || "Empty") + " · Body");
        });

        const icon = document.createElement("span");
        icon.className = "nested-graph-portal-icon";
        icon.textContent = "□";
        const copy = document.createElement("span");
        copy.className = "nested-graph-portal-copy";
        const title = document.createElement("strong");
        title.textContent = "Apri Empty Graph";
        const detail = document.createElement("small");
        const count = node.nestedGraph && Array.isArray(node.nestedGraph.nodes)
          ? node.nestedGraph.nodes.filter((entry) => entry.id !== "__graph_input__" && entry.id !== "__graph_output__").length
          : 0;
        detail.textContent = count
          ? count + (count === 1 ? " blocco interno" : " blocchi interni")
          : "Canvas vuoto · le porte esterne vengono istanziate dentro";
        copy.append(title, detail);
        const arrow = document.createElement("span");
        arrow.className = "nested-graph-portal-arrow";
        arrow.textContent = "→";
        portal.append(icon, copy, arrow);
        portalWrap.appendChild(portal);
        body.appendChild(portalWrap);
      } else if (node.type === "switch") {
        syncSwitchNode(node);
        appendSection("FLOW", node.rows.filter((item) => item.kind === "flowIn" || item.kind === "flowOut"), []);
        appendSection("VALUE", node.rows.filter((item) => item.kind === "input"), []);
      } else if (node.type === "adapter") {
        syncAdapterNode(node);
        appendSection("DATA IN", node.rows.filter((item) => item.kind === "input"), []);
        appendSection("DATA OUT", node.rows.filter((item) => item.kind === "output"), []);
      } else if (["math", "logic", "compare"].includes(node.type)) {
        appendSection("INPUT", node.rows.filter((item) => item.kind === "input"), []);
        appendSection("RESULT", node.rows.filter((item) => item.kind === "output"), []);
      } else if (["ifElse", "whileLoop", "doWhileLoop", "forLoop", "foreachLoop"].includes(node.type)) {
        appendSection("FLOW", node.rows.filter((item) => item.kind === "flowIn" || item.kind === "flowOut"), []);
        appendSection("DATA IN", node.rows.filter((item) => item.kind === "input"), []);
        appendSection("DATA OUT", node.rows.filter((item) => item.kind === "output"), []);
      } else if (node.type === "event") {
        appendSection("FLOW", node.rows.filter((item) => item.kind === "flowOut" || item.kind === "flowIn"), []);
        appendSection("DATA OUT", node.rows.filter((item) => item.kind === "output"), [
          { label: "Data Output", value: "dataOutput" }
        ]);
      } else if (node.type === "action") {
        appendSection("FLOW", node.rows.filter((item) => item.kind === "flowIn" || item.kind === "flowOut"), [
          { label: "Flow Output", value: "flowOutput" }
        ]);
        appendSection("DATA IN", node.rows.filter((item) => item.kind === "input"), [
          { label: "Data Input", value: "dataInput" }
        ]);
        appendSection("DATA OUT", node.rows.filter((item) => item.kind === "output"), [
          { label: "Data Output", value: "dataOutput" }
        ]);
      } else if (node.type === "state") {
        appendSection("FLOW", node.rows.filter((item) => item.kind === "flowIn" || item.kind === "flowOut"), [
          { label: "Transition", value: "flowOutput" }
        ]);
        appendSection("DATA", node.rows.filter((item) => item.kind === "input" || item.kind === "output"), [
          { label: "Data Input", value: "dataInput" },
          { label: "Data Output", value: "dataOutput" }
        ]);
      } else if (node.type === "condition") {
        appendSection("FLOW", node.rows.filter((item) => item.kind === "flowIn" || item.kind === "flowOut"), []);
        appendSection("DATA IN", node.rows.filter((item) => item.kind === "input"), [
          { label: "Data Input", value: "dataInput" }
        ]);
        appendSection("RESULT", node.rows.filter((item) => item.kind === "output"), []);
      } else if (node.type === "enum") {
        const enumMeta = document.createElement("div");
        enumMeta.className = "enum-meta-row";
        enumMeta.append(
          compactSelect(node.enumVisibility, [["public", "public"], ["internal", "internal"]], (value) => {
            node.enumVisibility = value;
            rerenderNode();
          }, "enum-meta-select"),
          compactSelect(node.enumUnderlyingType, [
            "byte", "sbyte", "short", "ushort", "int", "uint", "long", "ulong"
          ], (value) => {
            node.enumUnderlyingType = value;
            rerenderNode();
          }, "enum-meta-select")
        );

        const flags = document.createElement("button");
        flags.type = "button";
        flags.className = "enum-flags-button" + (node.enumFlags ? " active" : "");
        flags.textContent = node.enumFlags ? "[Flags] ON" : "[Flags] OFF";
        flags.title = "Permette di combinare più valori dell'enum come bit flags";
        flags.addEventListener("pointerdown", (event) => event.stopPropagation());
        flags.addEventListener("click", (event) => {
          event.stopPropagation();
          node.enumFlags = !node.enumFlags;
          rerenderNode();
        });
        enumMeta.appendChild(flags);
        body.appendChild(enumMeta);

        const enumSection = document.createElement("div");
        enumSection.className = "enum-values-section";

        const heading = document.createElement("div");
        heading.className = "enum-values-heading";
        heading.innerHTML = '<span>VALUES</span><span class="section-count">' + node.enumValues.length + '</span>';
        enumSection.appendChild(heading);

        const list = document.createElement("div");
        list.className = "enum-values-list";

        node.enumValues.forEach((entry, valueIndex) => {
          const valueRow = document.createElement("div");
          valueRow.className = "enum-value-row";

          const indexLabel = document.createElement("span");
          indexLabel.className = "enum-value-index";
          indexLabel.textContent = String(valueIndex);

          const name = inlineInput(entry.name, "Value", (value) => {
            entry.name = value;
          }, "enum-value-name");

          const numeric = document.createElement("input");
          numeric.type = "number";
          numeric.className = "enum-value-number";
          numeric.value = entry.value;
          numeric.addEventListener("pointerdown", (event) => event.stopPropagation());
          numeric.addEventListener("input", () => {
            entry.value = Number(numeric.value) || 0;
            markDirty();
          });

          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "enum-value-remove";
          remove.textContent = "×";
          remove.title = "Rimuovi valore";
          remove.addEventListener("pointerdown", (event) => event.stopPropagation());
          remove.addEventListener("click", (event) => {
            event.stopPropagation();
            const casePortId = "case_" + entry.id;
            project.connections = project.connections.filter((edge) =>
              edge.from.rowId !== casePortId && edge.to.rowId !== casePortId
            );
            node.enumValues = node.enumValues.filter((value) => value.id !== entry.id);
            rerenderNode();
          });

          valueRow.append(indexLabel, name, numeric, remove);
          list.appendChild(valueRow);
        });

        const addValue = document.createElement("button");
        addValue.type = "button";
        addValue.className = "enum-add-value";
        addValue.textContent = "＋ Value";
        addValue.addEventListener("pointerdown", (event) => event.stopPropagation());
        addValue.addEventListener("click", (event) => {
          event.stopPropagation();
          const used = node.enumValues.map((entry) => Number(entry.value) || 0);
          let nextValue = 0;
          if (node.enumFlags) {
            const positives = used.filter((value) => value > 0);
            nextValue = positives.length ? Math.pow(2, Math.floor(Math.log2(Math.max(...positives))) + 1) : 1;
          } else {
            nextValue = used.length ? Math.max(...used) + 1 : 0;
          }
          node.enumValues.push(enumValue("Value" + node.enumValues.length, nextValue));
          rerenderNode();
        });

        enumSection.append(list, addValue);
        body.appendChild(enumSection);
      } else if (node.type === "object") {
        const categoryOrder = UNITY_COMPONENT_CATEGORIES.map((category) => category.id).concat(["scripts", "other"]);
        const components = node.rows
          .filter((item) => item.kind === "component")
          .slice()
          .sort((a, b) => {
            const categoryDelta = categoryOrder.indexOf(a.componentCategory) - categoryOrder.indexOf(b.componentCategory);
            return categoryDelta || a.componentType.localeCompare(b.componentType);
          });

        const componentActions = [];
        UNITY_COMPONENT_CATEGORIES.forEach((category) => {
          const choices = category.components.filter((type) => type !== "Transform");
          if (!choices.length) return;
          componentActions.push({ header: true, label: category.label });
          choices.forEach((type) => componentActions.push({
            label: type,
            value: "component:" + type
          }));
        });

        const scripts = attachableScriptNodes();
        if (scripts.length) {
          componentActions.push({ header: true, label: "SCRIPTS" });
          scripts.forEach((script) => componentActions.push({
            label: script.title,
            value: "script:" + script.id
          }));
        }

        appendSection("COMPONENTS", components, componentActions);

        const dataMembers = node.rows.filter((item) => item.kind === "variable" || item.kind === "property");
        appendSection("DATA", dataMembers, [
          { label: "Single variable", value: "variable" },
          { label: "Array variable", value: "arrayVariable" },
          { label: "List variable", value: "listVariable" },
          { label: "Dictionary variable", value: "dictionaryVariable" }
        ]);

        const methods = node.rows.filter((item) => item.kind === "function");
        if (methods.length) appendSection("LEGACY LOGIC", methods, []);

        const events = node.rows.filter((item) => item.kind === "unityEvent");
        if (events.length) appendSection("EVENTS", events, []);
      } else if (node.type === "class") {
        const classReferences = publicClassNodes()
          .filter((classNode) => classNode.id !== node.id)
          .map((classNode) => ({ label: "Reference · " + classNode.title, value: "class:" + classNode.title }));

        appendSection(
          "VARIABLES",
          node.rows.filter((item) => item.kind === "variable" || item.kind === "property"),
          [
            { label: "Single variable", value: "variable" },
            { label: "Array variable", value: "arrayVariable" },
            { label: "List variable", value: "listVariable" },
            { label: "Dictionary variable", value: "dictionaryVariable" }
          ].concat(classReferences)
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
        const otherItems = node.rows.filter((item) => !["variable", "property", "function", "unityEvent", "component"].includes(item.kind));
        if (otherItems.length) appendSection("OTHER", otherItems, []);
      } else if (node.type === "struct" || node.type === "jobStruct") {
        appendSection(
          node.type === "jobStruct" ? "JOB DATA" : "FIELDS",
          node.rows.filter((item) => item.kind === "variable" || item.kind === "property"),
          [
            { label: "Field", value: "variable" },
            { label: "Array field", value: "arrayVariable" },
            { label: "List field", value: "listVariable" }
          ]
        );
        appendSection(
          node.type === "jobStruct" ? "EXECUTE / METHODS" : "METHODS",
          node.rows.filter((item) => item.kind === "function"),
          node.type === "jobStruct"
            ? [{ label: "Helper method", value: "method" }]
            : [{ label: "Method", value: "method" }]
        );
        const otherItems = node.rows.filter((item) => !["variable", "property", "function"].includes(item.kind));
        if (otherItems.length) appendSection("OTHER", otherItems, []);
      } else {
        node.rows.forEach((item) => body.appendChild(makeRowElement(item)));
      }

      if (node.pseudo && node.type !== "function") {
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

    const backbone = createNodeBackbone(node);
    if (backbone) element.appendChild(backbone);

    return element;
  }

  function renderNodes() {
    nodeLayer.innerHTML = "";
    const connectedPorts = buildConnectedPortSet();
    project.nodes.forEach((node) => nodeLayer.appendChild(createNodeElement(node, connectedPorts)));
    renderGroups();
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
    if (!rect.width && !rect.height) return null;

    const scrollList = port.closest(".section-member-list.scrollable");
    if (scrollList) {
      const listRect = scrollList.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      if (centerY < listRect.top || centerY > listRect.bottom) return null;
    }

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
  function internalConnectionPath(a, b, nodeId) {
    const rect = getNodeWorldRect(nodeId);
    if (!rect) return pathForRoute([a, b]);

    const gutterX = rect.x + rect.width - 22;
    return roundedOrthogonalPath(simplifyRoute([
      { x: a.x, y: a.y },
      { x: gutterX, y: a.y },
      { x: gutterX, y: b.y },
      { x: b.x, y: b.y }
    ]));
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

  function junctionSelectionKey(edgeId, pointId) {
    return edgeId + "::" + pointId;
  }

  function edgeDataType(edge) {
    if (!edge) return "any";
    return edge.dataType || memberOutputType(memberByRef(edge.from));
  }

  function junctionRecord(edgeId, pointId) {
    const edge = project.connections.find((item) => item.id === edgeId);
    if (!edge || !Array.isArray(edge.points)) return null;
    const point = edge.points.find((item) => item.id === pointId);
    return point ? { edge: edge, point: point, type: edgeDataType(edge) } : null;
  }

  function syncLinkedJunctionPoints() {
    const points = new Map();
    project.connections.forEach((edge) => {
      (edge.points || []).forEach((point) => {
        if (!point.junctionLink) points.set(junctionSelectionKey(edge.id, point.id), point);
      });
    });

    project.connections.forEach((edge) => {
      (edge.points || []).forEach((point) => {
        if (!point.junctionLink) return;
        const target = points.get(junctionSelectionKey(point.junctionLink.edgeId, point.junctionLink.pointId));
        if (!target) return;
        point.x = target.x;
        point.y = target.y;
      });
    });
  }

  function makeLinkedJunctionPoint(edgeId, pointId, point, anchor) {
    return {
      id: uid("junction_link"),
      x: point.x,
      y: point.y,
      junctionLink: { edgeId: edgeId, pointId: pointId },
      junctionAnchor: anchor === "to" ? "to" : "from"
    };
  }

  function sameConnectionRef(a, b) {
    return !!a && !!b &&
      a.nodeId === b.nodeId &&
      a.rowId === b.rowId;
  }

  function edgeConnects(edge, from, to) {
    return !!edge && sameConnectionRef(edge.from, from) && sameConnectionRef(edge.to, to);
  }

  function edgeOwnsReferencedJunction(edge) {
    if (!edge || !Array.isArray(edge.points)) return false;
    const ownedPointIds = new Set(
      edge.points
        .filter((point) => point && !point.junctionLink)
        .map((point) => point.id)
    );
    if (!ownedPointIds.size) return false;

    return project.connections.some((otherEdge) =>
      otherEdge.id !== edge.id &&
      (otherEdge.points || []).some((point) =>
        point.junctionLink &&
        point.junctionLink.edgeId === edge.id &&
        ownedPointIds.has(point.junctionLink.pointId)
      )
    );
  }

  function removeRedundantConnections(from, to, keepEdgeId) {
    const removedIds = new Set();
    project.connections = project.connections.filter((edge) => {
      if (edge.id === keepEdgeId || !edgeConnects(edge, from, to)) return true;

      // Never destroy an edge that currently owns a junction used by other
      // branches. It can be normalized later without orphaning those branches.
      if (edgeOwnsReferencedJunction(edge)) return true;

      removedIds.add(edge.id);
      return false;
    });

    if (!removedIds.size) return 0;
    if (selectedEdgeId && removedIds.has(selectedEdgeId)) selectedEdgeId = keepEdgeId;
    selectedJunctionIds = new Set(
      Array.from(selectedJunctionIds).filter((key) => {
        const edgeId = String(key).split("::")[0];
        return !removedIds.has(edgeId);
      })
    );
    return removedIds.size;
  }

  function linkedJunctionAnchor(edge, point) {
    if (!point || !point.junctionLink) return null;
    if (point.junctionAnchor === "from" || point.junctionAnchor === "to") return point.junctionAnchor;

    const owner = junctionRecord(point.junctionLink.edgeId, point.junctionLink.pointId);
    if (!owner) return null;

    const sameFrom = sameConnectionRef(edge.from, owner.edge.from);
    const sameTo = sameConnectionRef(edge.to, owner.edge.to);
    if (sameFrom && !sameTo) return "from";
    if (sameTo && !sameFrom) return "to";
    return null;
  }

  function edgeVisualRoute(edge, startPoint, endPoint) {
    const points = Array.isArray(edge.points) ? edge.points : [];
    const linkedIndex = points.findIndex((point) => point && point.junctionLink);
    if (linkedIndex < 0) return [startPoint].concat(points, [endPoint]);

    const linkedPoint = points[linkedIndex];
    const anchor = linkedJunctionAnchor(edge, linkedPoint);
    if (anchor === "from") {
      return [linkedPoint].concat(points.slice(linkedIndex + 1), [endPoint]);
    }
    if (anchor === "to") {
      return [startPoint].concat(points.slice(0, linkedIndex + 1));
    }
    return [startPoint].concat(points, [endPoint]);
  }

  function finishJunctionConnection(portRef, edgeId, pointId) {
    const junction = junctionRecord(edgeId, pointId);
    if (!junction || !portRef) return false;

    let check = null;
    let from = null;
    let to = null;

    if (portRef.side === "in") {
      check = connectionCheck(junction.edge.from, portRef);
      from = junction.edge.from;
      to = portRef;
    } else {
      check = connectionCheck(portRef, junction.edge.to);
      from = portRef;
      to = junction.edge.to;
    }

    if (!check || !check.ok) {
      showToast(check ? check.reason : "Connessione non compatibile.");
      return false;
    }

    const ownerAlreadyConnects = edgeConnects(junction.edge, from, to);
    const anchor = portRef.side === "in" ? "from" : "to";
    let routedEdge = ownerAlreadyConnects ? junction.edge : project.connections.find((edge) =>
      edgeConnects(edge, from, to) &&
      (edge.points || []).some((point) =>
        point.junctionLink &&
        point.junctionLink.edgeId === edgeId &&
        point.junctionLink.pointId === pointId
      )
    );

    let created = false;
    if (!routedEdge) {
      routedEdge = {
        id: uid("edge"),
        from: { nodeId: from.nodeId, rowId: from.rowId, side: "out", kind: check.outputType === "__flow__" ? "flow" : "data" },
        to: { nodeId: to.nodeId, rowId: to.rowId, side: "in", kind: check.outputType === "__flow__" ? "flow" : "data" },
        points: [makeLinkedJunctionPoint(edgeId, pointId, junction.point, anchor)],
        dataType: check.outputType
      };
      project.connections.push(routedEdge);
      created = true;
    } else if (!ownerAlreadyConnects) {
      const linkedPoint = (routedEdge.points || []).find((point) =>
        point.junctionLink &&
        point.junctionLink.edgeId === edgeId &&
        point.junctionLink.pointId === pointId
      );
      if (linkedPoint) linkedPoint.junctionAnchor = anchor;
    }

    const removed = removeRedundantConnections(from, to, routedEdge.id);
    if (created || removed) markDirty();

    if (ownerAlreadyConnects) {
      showToast(removed
        ? "Connessione diretta rimossa · resta il percorso del junction"
        : "Il collegamento passa già da questo junction");
    } else if (created) {
      showToast(check.outputType === "__flow__" ? "Nuovo ramo FLOW collegato" : "Nuovo ramo DATA collegato");
    } else if (removed) {
      showToast("Connessione duplicata rimossa");
    }

    pendingPort = null;
    pendingJunction = null;
    $("connectionBanner").classList.remove("show");
    renderNodes();
    renderEdges();
    renderMinimap();
    return true;
  }

  function handleJunctionConnectorClick(event, edgeId, pointId) {
    const key = junctionSelectionKey(edgeId, pointId);
    if (junctionClickSuppressKey === key && Date.now() < junctionClickSuppressUntil) return;
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) return;

    if (pendingPort) {
      finishJunctionConnection(pendingPort, edgeId, pointId);
      return;
    }

    if (pendingJunction &&
        pendingJunction.edgeId === edgeId &&
        pendingJunction.pointId === pointId) {
      cancelConnection();
      return;
    }

    const record = junctionRecord(edgeId, pointId);
    if (!record) return;
    pendingJunction = {
      edgeId: edgeId,
      pointId: pointId,
      dataType: record.type
    };
    pendingPort = null;
    $("connectionBanner").classList.add("show");
    selectedEdgeId = edgeId;
    selectedJunctionIds = new Set([key]);
    renderEdges();
    showToast(record.type === "__flow__"
      ? "Junction FLOW attivo · scegli una porta"
      : "Junction " + record.type + " attivo · scegli una porta");
  }

  function selectedJunctionRecords() {
    const result = [];
    project.connections.forEach((edge) => {
      if (!Array.isArray(edge.points)) return;
      edge.points.forEach((point) => {
        if (selectedJunctionIds.has(junctionSelectionKey(edge.id, point.id))) {
          result.push({ edge: edge, point: point });
        }
      });
    });
    return result;
  }

  function selectJunction(event, edgeId, pointId, deferRender) {
    const key = junctionSelectionKey(edgeId, pointId);
    const additive = !!(event && (event.ctrlKey || event.metaKey || event.shiftKey));

    if (additive) {
      if (selectedJunctionIds.has(key)) selectedJunctionIds.delete(key);
      else selectedJunctionIds.add(key);
    } else if (!selectedJunctionIds.has(key) || selectedJunctionIds.size !== 1) {
      selectedJunctionIds = new Set([key]);
    }

    selectedEdgeId = edgeId;
    selectedTypeRelationId = null;
    selectedNodeIds.clear();
    selectedNodeId = null;
    selectedGroupId = null;
    if (!deferRender) {
      renderNodes();
      renderEdges();
      renderInspector();
      renderMinimap();
    }
  }

  function addJunction(edge, event, startPoint, endPoint) {
    const point = screenToWorld(event.clientX, event.clientY);
    if (!Array.isArray(edge.points)) edge.points = [];

    const route = edgeVisualRoute(edge, startPoint, endPoint);
    let bestSegment = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < route.length - 1; i += 1) {
      const distance = distanceToSegmentSquared(point, route[i], route[i + 1]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSegment = i;
      }
    }

    const junction = {
      id: uid("junction"),
      x: Math.round(point.x / 10) * 10,
      y: Math.round(point.y / 10) * 10
    };
    const linkedIndex = edge.points.findIndex((point) => point && point.junctionLink);
    let insertionIndex = bestSegment;
    if (linkedIndex >= 0) {
      const anchor = linkedJunctionAnchor(edge, edge.points[linkedIndex]);
      if (anchor === "from") insertionIndex = linkedIndex + 1 + bestSegment;
      else if (anchor === "to") insertionIndex = bestSegment;
    }
    edge.points.splice(insertionIndex, 0, junction);

    selectedEdgeId = edge.id;
    selectedJunctionIds = new Set([junctionSelectionKey(edge.id, junction.id)]);
    selectedNodeIds.clear();
    selectedNodeId = null;
    selectedGroupId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
    markDirty();
    showToast("Punto di curva creato");
  }

  function startJunctionDrag(event, edgeId, pointId) {
    if (event.button !== 0) return;
    broadcastActivity("Modifica una connessione");
    event.preventDefault();
    event.stopPropagation();

    const key = junctionSelectionKey(edgeId, pointId);
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    if (!selectedJunctionIds.has(key) || additive) {
      selectJunction(event, edgeId, pointId, true);
    }
    if (!selectedJunctionIds.has(key)) return;

    const start = screenToWorld(event.clientX, event.clientY);
    junctionDrag = {
      key: key,
      moved: false,
      startX: start.x,
      startY: start.y,
      starts: selectedJunctionRecords().map((entry) => ({
        edgeId: entry.edge.id,
        pointId: entry.point.id,
        x: entry.point.x,
        y: entry.point.y
      }))
    };
    window.addEventListener("pointermove", moveJunction);
    window.addEventListener("pointerup", endJunctionDrag, { once: true });
  }

  function moveJunction(event) {
    if (!junctionDrag) return;
    const worldPoint = screenToWorld(event.clientX, event.clientY);
    const dx = worldPoint.x - junctionDrag.startX;
    const dy = worldPoint.y - junctionDrag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) junctionDrag.moved = true;

    junctionDrag.starts.forEach((startPoint) => {
      const edge = project.connections.find((item) => item.id === startPoint.edgeId);
      if (!edge || !Array.isArray(edge.points)) return;
      const point = edge.points.find((item) => item.id === startPoint.pointId);
      if (!point) return;
      point.x = Math.round((startPoint.x + dx) / 10) * 10;
      point.y = Math.round((startPoint.y + dy) / 10) * 10;
    });
    // Keep every branch attached to the owner point during the drag itself,
    // not only on the next full render.
    syncLinkedJunctionPoints();
    scheduleInteractionRender(false, false);
  }

  function endJunctionDrag() {
    window.removeEventListener("pointermove", moveJunction);
    if (junctionDrag) {
      if (junctionDrag.moved) {
        junctionClickSuppressKey = junctionDrag.key;
        junctionClickSuppressUntil = Date.now() + 260;
      }
      junctionDrag = null;
      syncLinkedJunctionPoints();
      markDirty();
      renderEdges();
      renderMinimap();
    }
  }

  function removeJunction(edgeId, pointId) {
    const edge = project.connections.find((item) => item.id === edgeId);
    if (!edge || !Array.isArray(edge.points)) return;
    edge.points = edge.points.filter((point) => point.id !== pointId);
    selectedJunctionIds.delete(junctionSelectionKey(edgeId, pointId));
    if (pendingJunction && pendingJunction.edgeId === edgeId && pendingJunction.pointId === pointId) {
      pendingJunction = null;
      $("connectionBanner").classList.remove("show");
    }
    renderEdges();
    renderInspector();
    markDirty();
    showToast("Punto di curva rimosso");
  }

  function updateConnectionVisibilityControl() {
    const button = $("forceConnectionsView");
    if (!button) return;
    button.classList.toggle("active", forceConnectionsVisible);
    button.setAttribute("aria-pressed", forceConnectionsVisible ? "true" : "false");
    button.title = forceConnectionsVisible
      ? "Connessioni forzate · clicca per tornare alla vista normale"
      : "Forza la visione di tutte le connessioni";
  }

  function toggleForcedConnections() {
    forceConnectionsVisible = !forceConnectionsVisible;
    selectedEdgeId = null;
    selectedTypeRelationId = null;
    localStorage.setItem(FORCE_CONNECTIONS_KEY, forceConnectionsVisible ? "1" : "0");
    updateConnectionVisibilityControl();
    renderEdges();
    showToast(forceConnectionsVisible
      ? "Tutte le connessioni sono visibili"
      : "Vista connessioni normale");
  }

  function renderEdges() {
    edgeLayer.innerHTML = "";
    edgeLayer.classList.toggle("force-connections", forceConnectionsVisible);
    project.connections = project.connections.filter((edge) => nodeById(edge.from.nodeId) && nodeById(edge.to.nodeId));
    syncLinkedJunctionPoints();

    const junctionOverlays = [];

    project.connections.forEach((edge) => {
      if (selectedTypeRelationId) return;
      if (selectedEdgeId && edge.id !== selectedEdgeId) return;

      const a = getPortWorldPosition(edge.from);
      const b = getPortWorldPosition(edge.to);
      if (!a || !b) return;
      if (!Array.isArray(edge.points)) edge.points = [];

      const route = edgeVisualRoute(edge, a, b);
      const isInternalEdge = edge.from.nodeId === edge.to.nodeId && edge.points.length === 0;
      const routePath = isInternalEdge
        ? internalConnectionPath(a, b, edge.from.nodeId)
        : pathForRoute(route);
      const sourceNode = nodeById(edge.from.nodeId);
      const sourceMember = memberByRef(edge.from);
      const edgeType = edge.dataType || memberOutputType(sourceMember);
      const edgeColor = edgeType && edgeType !== "any"
        ? dataTypeColor(edgeType)
        : (sourceNode ? typeMeta(sourceNode.type).color : "#7c6cff");

      const isFlowEdge = edgeType === "__flow__";

      const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", routePath);
      glow.setAttribute("class", "edge-glow" + (isFlowEdge ? " flow-edge" : "") + (isInternalEdge ? " internal-edge" : ""));
      edgeLayer.appendChild(glow);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", routePath);
      path.setAttribute("class", "edge" + (isFlowEdge ? " flow-edge" : "") + (isInternalEdge ? " internal-edge" : "") + (selectedEdgeId === edge.id ? " selected" : ""));
      path.dataset.edgeId = edge.id;
      path.style.stroke = edgeColor;
      path.style.opacity = selectedEdgeId === edge.id ? "1" : ".72";
      edgeLayer.appendChild(path);

      const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitPath.setAttribute("d", routePath);
      hitPath.setAttribute("class", "edge-hit");
      let edgeClickTimer = null;

      hitPath.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
      });

      hitPath.addEventListener("click", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (edgeClickTimer) clearTimeout(edgeClickTimer);

        // Delay single-click focus just enough to let a possible dblclick win.
        // Rendering the edge layer immediately would replace this SVG path and
        // prevent the browser from dispatching the double-click event.
        edgeClickTimer = setTimeout(() => {
          edgeClickTimer = null;
          selectedEdgeId = edge.id;
          selectedTypeRelationId = null;
          selectedJunctionIds.clear();
          selectedNodeIds.clear();
          selectedNodeId = null;
          selectedGroupId = null;

          renderNodes();
          renderEdges();
          renderInspector();
          renderMinimap();
          showToast("Connessione isolata");
        }, 220);
      });

      hitPath.addEventListener("dblclick", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (edgeClickTimer) {
          clearTimeout(edgeClickTimer);
          edgeClickTimer = null;
        }
        addJunction(edge, event, a, b);
      });
      edgeLayer.appendChild(hitPath);

      edge.points.forEach((point) => {
        if (point.junctionLink) return;
        const key = junctionSelectionKey(edge.id, point.id);
        const pointSelected = selectedJunctionIds.has(key);
        const pointPending = !!(pendingJunction && pendingJunction.edgeId === edge.id && pendingJunction.pointId === point.id);
        const junction = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        junction.setAttribute("cx", point.x);
        junction.setAttribute("cy", point.y);
        junction.setAttribute("r", pointPending ? "8" : (pointSelected ? "7" : (selectedEdgeId === edge.id ? "6" : "5")));
        junction.setAttribute("class", "edge-junction" + (pointSelected ? " selected" : "") + (pointPending ? " pending-connector" : ""));
        junction.style.setProperty("--junction-color", edgeColor);
        junction.addEventListener("pointerdown", (event) => startJunctionDrag(event, edge.id, point.id));
        junction.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          handleJunctionConnectorClick(event, edge.id, point.id);
        });
        junction.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
          cancelConnection();
          removeJunction(edge.id, point.id);
        });
        // Junctions are appended after every edge hit-area so a newly attached
        // branch can never cover the point and make it impossible to drag.
        junctionOverlays.push(junction);
      });
    });

    junctionOverlays.forEach((junction) => edgeLayer.appendChild(junction));

    if (selectedTypeRelationId || forceConnectionsVisible || selectedNodeIds.size) {
      const groupedTypeRelations = new Map();

      buildTypeRelations().forEach((relation) => {
        if (selectedTypeRelationId && relation.id !== selectedTypeRelationId) return;
        if (!selectedTypeRelationId &&
            !forceConnectionsVisible &&
            !selectedNodeIds.has(relation.sourceNodeId) &&
            !selectedNodeIds.has(relation.targetNodeId)) return;

        const key = relation.sourceNodeId + "|" + relation.targetNodeId;
        if (!groupedTypeRelations.has(key)) {
          groupedTypeRelations.set(key, Object.assign({}, relation, { count: 1 }));
        } else {
          groupedTypeRelations.get(key).count += 1;
        }
      });

      groupedTypeRelations.forEach((relation) => {
        const anchors = autoTypeRelationAnchors(relation);
        if (!anchors) return;

        const pathData = pathForRoute([anchors.a, anchors.b]);
        const targetNode = nodeById(relation.targetNodeId);
        const color = targetNode ? typeMeta(targetNode.type).color : dataTypeColor(relation.targetType);

        const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
        glow.setAttribute("d", pathData);
        glow.setAttribute("class", "auto-type-glow " + (relation.targetNodeType === "enum" ? "enum-link" : "class-link"));
        glow.style.stroke = color;
        edgeLayer.insertBefore(glow, edgeLayer.firstChild);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("class", "auto-type-edge " + (relation.targetNodeType === "enum" ? "enum-link" : "class-link") + (selectedTypeRelationId === relation.id ? " selected" : ""));
        path.style.stroke = color;
        path.style.setProperty("--relation-count", String(relation.count));
        edgeLayer.insertBefore(path, edgeLayer.firstChild);

        const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hitPath.setAttribute("d", pathData);
        hitPath.setAttribute("class", "auto-type-hit");
        hitPath.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          selectedEdgeId = null;
          selectedTypeRelationId = relation.id;
          selectedNodeIds = new Set([relation.sourceNodeId, relation.targetNodeId]);
          syncPrimarySelection();
          selectedJunctionIds.clear();
          selectedGroupId = null;
          renderNodes();
          renderEdges();
          renderInspector();
          renderMinimap();
          showToast("Connessione isolata");
        });
        const firstJunction = edgeLayer.querySelector(".edge-junction");
        edgeLayer.insertBefore(hitPath, firstJunction || null);
      });
    }
  }

  function applyMinimapSize(renderNow) {
    const minimap = $("minimap");
    if (!minimap) return;
    minimap.style.width = Math.round(minimapSize.width) + "px";
    minimap.style.height = Math.round(minimapSize.height) + "px";
    if (renderNow !== false) requestAnimationFrame(renderMinimap);
  }

  function startMinimapResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    minimapResizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: minimapSize.width,
      height: minimapSize.height
    };
    document.body.classList.add("resizing-minimap");
    window.addEventListener("pointermove", moveMinimapResize);
    window.addEventListener("pointerup", endMinimapResize, { once: true });
  }

  function moveMinimapResize(event) {
    if (!minimapResizeState) return;
    const dx = event.clientX - minimapResizeState.startX;
    const dy = event.clientY - minimapResizeState.startY;
    minimapSize.width = Math.max(220, Math.min(520, minimapResizeState.width - dx));
    minimapSize.height = Math.max(160, Math.min(380, minimapResizeState.height - dy));
    applyMinimapSize(false);
    scheduleMinimapRender(35);
  }

  function endMinimapResize() {
    window.removeEventListener("pointermove", moveMinimapResize);
    document.body.classList.remove("resizing-minimap");
    minimapResizeState = null;
    localStorage.setItem(MINIMAP_SIZE_KEY, JSON.stringify(minimapSize));
    renderMinimap();
  }

  function renderMinimap() {
    const svg = $("minimapSvg");
    svg.innerHTML = "";
    if (!project.nodes.length) {
      minimapProjection = null;
      return;
    }

    // Read the real rendered size once per node. The minimap must reflect
    // tall classes, expanded content and freely resized Sketch nodes.
    const nodeBounds = project.nodes.map((node) => {
      const element = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
      const fallbackWidth = nodeWidthFor(node);
      const fallbackHeight = node.type === "sketch"
        ? Math.max(260, Number(node.sketchHeight || 320) + 95)
        : 220;

      return {
        node: node,
        x: node.x,
        y: node.y,
        width: element && element.offsetWidth > 0 ? element.offsetWidth : fallbackWidth,
        height: element && element.offsetHeight > 0 ? element.offsetHeight : fallbackHeight
      };
    });

    const groupBounds = (project.groups || []).map(groupWorldBounds).filter(Boolean);
    const padding = 90;
    const minX = Math.min.apply(null, nodeBounds.map((bounds) => bounds.x).concat(groupBounds.map((bounds) => bounds.x))) - padding;
    const minY = Math.min.apply(null, nodeBounds.map((bounds) => bounds.y).concat(groupBounds.map((bounds) => bounds.y))) - padding;
    const maxX = Math.max.apply(null, nodeBounds.map((bounds) => bounds.x + bounds.width).concat(groupBounds.map((bounds) => bounds.x + bounds.width))) + padding;
    const maxY = Math.max.apply(null, nodeBounds.map((bounds) => bounds.y + bounds.height).concat(groupBounds.map((bounds) => bounds.y + bounds.height))) + padding;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = Math.min(170 / width, 94 / height);
    const offsetX = (180 - width * scale) / 2;
    const offsetY = (100 - height * scale) / 2 + 2;

    minimapProjection = { minX, minY, scale, offsetX, offsetY };

    (project.groups || []).forEach((group) => {
      const bounds = groupWorldBounds(group);
      if (!bounds) return;
      const groupRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      groupRect.setAttribute("x", offsetX + (bounds.x - minX) * scale);
      groupRect.setAttribute("y", offsetY + (bounds.y - minY) * scale);
      groupRect.setAttribute("width", Math.max(2, bounds.width * scale));
      groupRect.setAttribute("height", Math.max(2, bounds.height * scale));
      groupRect.setAttribute("rx", "3");
      groupRect.setAttribute("fill", "rgba(63,127,166,.08)");
      groupRect.setAttribute("stroke", selectedGroupId === group.id ? "#5f9fbe" : "#46556d");
      groupRect.setAttribute("stroke-width", selectedGroupId === group.id ? "1.2" : ".8");
      svg.appendChild(groupRect);
    });

    nodeBounds.forEach((bounds) => {
      const node = bounds.node;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", offsetX + (bounds.x - minX) * scale);
      rect.setAttribute("y", offsetY + (bounds.y - minY) * scale);
      rect.setAttribute("width", Math.max(2, bounds.width * scale));
      rect.setAttribute("height", Math.max(2, bounds.height * scale));
      rect.setAttribute("rx", "2");
      rect.setAttribute("class", "minimap-node" + (isNodeSelected(node.id) ? " selected" : ""));
      svg.appendChild(rect);
    });

    if (cloudState.sharedProjectId && cloudState.user) {
      const now = Date.now();
      Array.from(cloudState.remotePresence.values())
        .filter((entry) =>
          entry &&
          entry.uid !== cloudState.user.uid &&
          entry.cursor &&
          typeof entry.cursor.x === "number" &&
          typeof entry.cursor.y === "number" &&
          now - Number(entry.updatedAt || 0) < 45000
        )
        .forEach((entry) => {
          const rawX = offsetX + (entry.cursor.x - minX) * scale;
          const rawY = offsetY + (entry.cursor.y - minY) * scale;
          const x = Math.max(5, Math.min(175, rawX));
          const y = Math.max(5, Math.min(105, rawY));
          const label = entry.name || entry.email || "Collaboratore";
          const initial = label.trim().charAt(0).toUpperCase() || "?";

          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          group.setAttribute("class", "minimap-collaborator");

          const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          halo.setAttribute("cx", x);
          halo.setAttribute("cy", y);
          halo.setAttribute("r", "5.5");
          halo.setAttribute("class", "minimap-collaborator-halo");

          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("cx", x);
          dot.setAttribute("cy", y);
          dot.setAttribute("r", "3.7");
          dot.setAttribute("class", "minimap-collaborator-dot");

          const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
          text.setAttribute("x", x);
          text.setAttribute("y", y + .2);
          text.setAttribute("class", "minimap-collaborator-initial");
          text.textContent = initial;

          const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = label + " · " + (entry.activity || "Attivo");

          group.append(title, halo, dot, text);
          svg.appendChild(group);
        });
    }

    const viewportBounds = viewport.getBoundingClientRect();
    const worldLeft = -view.x / view.scale;
    const worldTop = -view.y / view.scale;
    const worldWidth = viewportBounds.width / view.scale;
    const worldHeight = viewportBounds.height / view.scale;
    const visible = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    visible.setAttribute("x", offsetX + (worldLeft - minX) * scale);
    visible.setAttribute("y", offsetY + (worldTop - minY) * scale);
    visible.setAttribute("width", worldWidth * scale);
    visible.setAttribute("height", worldHeight * scale);
    visible.setAttribute("class", "minimap-view");
    svg.appendChild(visible);
  }

  function navigateMinimap(event) {
    if (!minimapProjection) return;
    const svg = $("minimapSvg");
    const svgRect = svg.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) return;

    const localX = (event.clientX - svgRect.left) / svgRect.width * 180;
    const localY = (event.clientY - svgRect.top) / svgRect.height * 110;
    const worldX = minimapProjection.minX + (localX - minimapProjection.offsetX) / minimapProjection.scale;
    const worldY = minimapProjection.minY + (localY - minimapProjection.offsetY) / minimapProjection.scale;
    const viewportRect = viewport.getBoundingClientRect();

    view.x = viewportRect.width / 2 - worldX * view.scale;
    view.y = viewportRect.height / 2 - worldY * view.scale;
    setWorldTransform();
  }

  function startMinimapNavigation(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    minimapDrag = true;
    navigateMinimap(event);
    window.addEventListener("pointermove", moveMinimapNavigation);
    window.addEventListener("pointerup", endMinimapNavigation, { once: true });
  }

  function moveMinimapNavigation(event) {
    if (!minimapDrag) return;
    navigateMinimap(event);
  }

  function endMinimapNavigation() {
    minimapDrag = false;
    window.removeEventListener("pointermove", moveMinimapNavigation);
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

    if (currentSchemaId() === "classic" && node.type === "event") {
      const title = document.createElement("div");
      title.className = "dynamic-section-title";
      title.textContent = "FLOW CHART ENTRY";
      container.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "settings-grid";
      grid.appendChild(inspectorField("ENTRY TYPE", selectControl(node.eventKind, eventKindOptionsForSchema(), (value) => {
        node.eventKind = value;
        syncClassicEventNode(node);
        renderNodes();
        renderInspector();
        markDirty();
      })));
      if (node.eventKind === "input") {
        grid.appendChild(inspectorField("DATA TYPE", selectControl(node.flowChartDataType || "any", ["any"].concat(availableDataTypes()), (value) => {
          node.flowChartDataType = value;
          syncClassicEventNode(node);
          renderNodes();
          markDirty();
        })));
      }
      container.appendChild(grid);
    }

    if (currentSchemaId() === "classic" && node.type === "action") {
      const title = document.createElement("div");
      title.className = "dynamic-section-title";
      title.textContent = "FLOW CHART PROCESS";
      container.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "settings-grid";
      grid.appendChild(inspectorField("PROCESS TYPE", selectControl(node.actionKind, actionKindOptionsForSchema(), (value) => {
        node.actionKind = value;
        syncClassicActionNode(node);
        renderNodes();
        renderInspector();
        markDirty();
      })));
      if (["callFunction", "setVariable", "readInput", "writeOutput"].includes(node.actionKind)) {
        grid.appendChild(inspectorField("DATA TYPE", selectControl(node.flowChartDataType || "any", ["any"].concat(availableDataTypes()), (value) => {
          node.flowChartDataType = value;
          syncClassicActionNode(node);
          renderNodes();
          markDirty();
        })));
      }
      container.appendChild(grid);
    }

    if (node.type === "component") {
      const title = document.createElement("div");
      title.className = "dynamic-section-title";
      title.textContent = "UNITY COMPONENT";
      container.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "settings-grid";

      const componentOptions = [];
      UNITY_COMPONENT_CATEGORIES.forEach((category) => {
        category.components.forEach((componentType) => {
          componentOptions.push([componentType, category.label + " · " + componentType]);
        });
      });

      grid.appendChild(inspectorField("COMPONENT TYPE", selectControl(node.componentType, componentOptions, (value) => {
        applyStandaloneComponentType(node, value);
        $("nodeTitle").value = node.title;
        render();
        renderInspector();
        markDirty();
      })));

      grid.appendChild(inspectorField("CATEGORY", textControl(componentCategoryLabel(node.componentCategory), "", () => {})));
      const categoryInput = grid.lastChild && grid.lastChild.querySelector("input");
      if (categoryInput) categoryInput.disabled = true;

      grid.appendChild(inspectorField("SOURCE", selectControl(node.componentSource || "unity", [
        ["unity", "Unity built-in"],
        ["script", "Custom script"]
      ], (value) => {
        node.componentSource = value;
        renderNodes();
        markDirty();
      })));

      container.appendChild(grid);

      const hint = document.createElement("div");
      hint.className = "unity-hint";
      hint.textContent = "Le proprietà visibili nel blocco seguono il tipo di componente selezionato.";
      container.appendChild(hint);
    }

    if (node.type === "struct") {
      const title = document.createElement("div");
      title.className = "dynamic-section-title";
      title.textContent = "C# STRUCT";
      container.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "settings-grid";
      grid.appendChild(inspectorField("VISIBILITÀ", selectControl(node.structVisibility, [
        ["public", "public"],
        ["internal", "internal"]
      ], (value) => {
        node.structVisibility = value;
        renderNodes();
        markDirty();
      })));
      grid.appendChild(checkboxControl(node.structReadonly, "readonly struct", (checked) => {
        node.structReadonly = checked;
        renderNodes();
        markDirty();
      }));
      grid.appendChild(checkboxControl(node.structSerializable, "[Serializable]", (checked) => {
        node.structSerializable = checked;
        renderNodes();
        markDirty();
      }));
      container.appendChild(grid);

      const hint = document.createElement("div");
      hint.className = "unity-hint";
      hint.textContent = "Struct è un value type: usa campi per dati compatti e metodi senza identità di riferimento.";
      container.appendChild(hint);
    }

    if (node.type === "jobStruct") {
      const title = document.createElement("div");
      title.className = "dynamic-section-title";
      title.textContent = "UNITY JOB";
      container.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "settings-grid";
      grid.appendChild(inspectorField("VISIBILITÀ", selectControl(node.structVisibility, [
        ["public", "public"],
        ["internal", "internal"]
      ], (value) => {
        node.structVisibility = value;
        renderNodes();
        markDirty();
      })));

      grid.appendChild(inspectorField("JOB INTERFACE", selectControl(node.jobInterface, [
        ["IJob", "IJob"],
        ["IJobFor", "IJobFor"],
        ["IJobParallelFor", "IJobParallelFor"],
        ["IJobEntity", "IJobEntity"]
      ], (value) => {
        node.jobInterface = value;
        if (value === "IJob" && node.jobScheduleMode === "ScheduleParallel") node.jobScheduleMode = "Schedule";
        syncJobExecuteMethod(node);
        render();
        renderInspector();
        markDirty();
      })));

      const scheduleOptions = node.jobInterface === "IJob"
        ? [["Run", "Run"], ["Schedule", "Schedule"]]
        : [["Run", "Run"], ["Schedule", "Schedule"], ["ScheduleParallel", "Schedule Parallel"]];
      grid.appendChild(inspectorField("SCHEDULING", selectControl(node.jobScheduleMode, scheduleOptions, (value) => {
        node.jobScheduleMode = value;
        renderNodes();
        markDirty();
      })));

      grid.appendChild(checkboxControl(node.jobBurst, "Burst compile", (checked) => {
        node.jobBurst = checked;
        renderNodes();
        markDirty();
      }));

      container.appendChild(grid);

      const hint = document.createElement("div");
      hint.className = "unity-hint";
      hint.textContent = node.jobInterface === "IJobEntity"
        ? "IJobEntity richiede Unity Entities. I parametri di Execute dipendono dai componenti ECS usati."
        : "Execute viene sincronizzato automaticamente con l'interfaccia Job selezionata.";
      container.appendChild(hint);
    }

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

      if (currentSchemaId() === "unity") {
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
            applyLifecyclePreset(node, preset);
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
      } else {
        node.ownerClassId = "";
        node.methodKind = "custom";
      }

      grid.appendChild(inspectorField("RETURN TYPE", selectControl(node.returnType, ["void"].concat(availableDataTypes()), (value) => {
        node.returnType = value;
        if (value === "void") node.returnCollectionKind = "single";
        renderNodes();
        renderInspector();
        markDirty();
      })));

      if (node.returnType !== "void") {
        grid.appendChild(inspectorField("RETURN CONTENITORE", selectControl(node.returnCollectionKind, [
          ["single", "Single"],
          ["array", "Array"],
          ["list", "List"],
          ["dictionary", "Dictionary"]
        ], (value) => {
          node.returnCollectionKind = value;
          renderNodes();
          renderInspector();
          markDirty();
        })));

        if (node.returnCollectionKind === "array") {
          const length = document.createElement("input");
          length.type = "number";
          length.min = "0";
          length.value = node.returnArrayLength || "";
          length.placeholder = "Lunghezza";
          length.addEventListener("input", () => {
            node.returnArrayLength = Math.max(0, Number(length.value) || 0);
            renderNodes();
            markDirty();
          });
          grid.appendChild(inspectorField("RETURN LENGTH", length));
        } else if (node.returnCollectionKind === "dictionary") {
          grid.appendChild(inspectorField("RETURN KEY TYPE", selectControl(node.returnDictionaryKeyType, availableDataTypes(), (value) => {
            node.returnDictionaryKeyType = value;
            renderNodes();
            markDirty();
          })));
        }
      }

      grid.appendChild(inspectorField("PARAMETRI", textControl(node.parameters, "es. int score, Player player", (value) => {
        node.parameters = value;
        node.methodParameters = parseParameterString(value, node.methodAccess);
        syncLegacyParameters(node);
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
      if (node.type === "jobStruct" && item.jobExecute) {
        showToast("Execute è obbligatorio per un Unity Job.");
        return;
      }
      node.rows = node.rows.filter((rowItem) => rowItem.id !== item.id);
      project.connections = project.connections.filter((edge) => edge.from.rowId !== item.id && edge.to.rowId !== item.id);
      render();
      renderInspector();
      markDirty();
    });
    head.append(badge, remove);
    wrapper.appendChild(head);

    if (!["class", "struct", "jobStruct"].includes(node.type)) {
      const memberKinds = currentSchemaId() === "classic"
        ? ["flowIn", "flowOut", "input", "output", "variable", "text"]
        : Object.keys(ROW_META);
      const kindSelect = selectControl(item.kind, memberKinds.map((key) => [key, ROW_META[key].label]), (value) => {
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
      if (currentSchemaId() === "unity") {
        const variableAccessOptions = (node.type === "struct" || node.type === "jobStruct")
          ? ["public", "private", "internal"]
          : ["public", "private", "protected", "internal"];
        grid.appendChild(inspectorField("ACCESSO", selectControl(item.access, variableAccessOptions, (value) => {
          item.access = value;
          if (value === "public") item.serialized = true;
          renderNodes();
          markDirty();
        })));
      }
      grid.appendChild(inspectorField("TIPO", selectControl(item.dataType, availableDataTypes(), (value) => {
        item.dataType = value;
        if (publicClassNodes().some((classNode) => classNode.title === value) && item.referenceMode === "value") {
          item.referenceMode = "inspector";
        }
        renderNodes();
        renderInspector();
        markDirty();
      })));

      const collectionOptions = node.type === "jobStruct"
        ? [
            ["single", "Single / unmanaged"],
            ["nativeArray", "NativeArray"],
            ["nativeList", "NativeList"],
            ["nativeReference", "NativeReference"]
          ]
        : [
            ["single", "Single"],
            ["array", "Array"],
            ["list", "List"],
            ["dictionary", "Dictionary"]
          ];
      grid.appendChild(inspectorField(node.type === "jobStruct" ? "JOB CONTAINER" : "CONTENITORE", selectControl(item.collectionKind, collectionOptions, (value) => {
        item.collectionKind = value;
        if (value === "dictionary") item.serialized = false;
        renderNodes();
        renderInspector();
        markDirty();
      })));

      if (item.collectionKind === "array") {
        const length = document.createElement("input");
        length.type = "number";
        length.min = "0";
        length.value = item.arrayLength || "";
        length.placeholder = "Lunghezza";
        length.addEventListener("input", () => {
          item.arrayLength = Math.max(0, Number(length.value) || 0);
          renderNodes();
          markDirty();
        });
        grid.appendChild(inspectorField("LUNGHEZZA ARRAY", length));
      } else if (item.collectionKind === "list") {
        const initial = document.createElement("input");
        initial.type = "number";
        initial.min = "0";
        initial.value = item.listInitialCount || "";
        initial.placeholder = "Quantità iniziale";
        initial.addEventListener("input", () => {
          item.listInitialCount = Math.max(0, Number(initial.value) || 0);
          renderNodes();
          markDirty();
        });
        grid.appendChild(inspectorField("COUNT INIZIALE", initial));
      } else if (item.collectionKind === "dictionary") {
        grid.appendChild(inspectorField("TIPO CHIAVE", selectControl(item.dictionaryKeyType, availableDataTypes(), (value) => {
          item.dictionaryKeyType = value;
          renderNodes();
          markDirty();
        })));
      }

      if (node.type === "jobStruct") {
        item.referenceMode = "value";
        item.serialized = false;
        grid.appendChild(inspectorField("JOB ACCESS", selectControl(item.jobAccess || "readwrite", [
          ["readwrite", "Read / Write"],
          ["readonly", "[ReadOnly]"],
          ["writeonly", "[WriteOnly]"]
        ], (value) => {
          item.jobAccess = value;
          renderNodes();
          markDirty();
        })));
        wrapper.appendChild(grid);
        const jobHint = document.createElement("div");
        jobHint.className = "unity-hint";
        jobHint.textContent = ["nativeArray", "nativeList", "nativeReference"].includes(item.collectionKind)
          ? "Unity.Collections · dato job-safe"
          : "Per dati condivisi tra thread preferisci un Native container.";
        wrapper.appendChild(jobHint);
      } else {
        if (currentSchemaId() === "unity") {
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
        } else {
          item.referenceMode = "value";
          item.serialized = false;
        }

        grid.appendChild(inspectorField("DEFAULT", textControl(item.defaultValue, "Valore iniziale", (value) => {
          item.defaultValue = value;
          markDirty();
        })));
        wrapper.appendChild(grid);

        if (currentSchemaId() === "unity") {
          wrapper.appendChild(checkboxControl(item.serialized, item.collectionKind === "dictionary"
            ? "Dictionary: serializzazione Unity custom necessaria"
            : "Mostra / serializza nell'Inspector", (checked) => {
            if (item.collectionKind === "dictionary" && checked) {
              item.serialized = false;
              showToast("Unity non serializza Dictionary direttamente.");
              renderInspector();
              return;
            }
            item.serialized = checked;
            renderNodes();
            markDirty();
          }));
        }
      }
    } else if (item.kind === "function") {
      const grid = document.createElement("div");
      grid.className = "settings-grid member-grid";
      const methodAccessOptions = (node.type === "struct" || node.type === "jobStruct")
        ? ["public", "private", "internal"]
        : ["public", "private", "protected", "internal"];
      grid.appendChild(inspectorField("ACCESSO", selectControl(item.access, methodAccessOptions, (value) => {
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
          applyLifecyclePreset(item, preset);
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
        if (value === "void") item.returnCollectionKind = "single";
        renderNodes();
        renderInspector();
        markDirty();
      })));

      if (item.returnType !== "void") {
        grid.appendChild(inspectorField("RETURN CONTENITORE", selectControl(item.returnCollectionKind, [
          ["single", "Single"],
          ["array", "Array"],
          ["list", "List"],
          ["dictionary", "Dictionary"]
        ], (value) => {
          item.returnCollectionKind = value;
          renderNodes();
          renderInspector();
          markDirty();
        })));

        if (item.returnCollectionKind === "array") {
          const returnLength = document.createElement("input");
          returnLength.type = "number";
          returnLength.min = "0";
          returnLength.value = item.returnArrayLength || "";
          returnLength.placeholder = "Lunghezza";
          returnLength.addEventListener("input", () => {
            item.returnArrayLength = Math.max(0, Number(returnLength.value) || 0);
            renderNodes();
            markDirty();
          });
          grid.appendChild(inspectorField("RETURN LENGTH", returnLength));
        } else if (item.returnCollectionKind === "dictionary") {
          grid.appendChild(inspectorField("RETURN KEY TYPE", selectControl(item.returnDictionaryKeyType, availableDataTypes(), (value) => {
            item.returnDictionaryKeyType = value;
            renderNodes();
            markDirty();
          })));
        }
      }

      grid.appendChild(inspectorField("PARAMETRI", textControl(item.parameters, "es. Collider other", (value) => {
        item.parameters = value;
        item.methodParameters = parseParameterString(value, item.access);
        syncLegacyParameters(item);
        renderNodes();
        markDirty();
      })));
      wrapper.appendChild(grid);

      const methodDescription = document.createElement("textarea");
      methodDescription.rows = 4;
      methodDescription.value = item.methodDescription || "";
      methodDescription.placeholder = "Spiega cosa fa il metodo…";
      methodDescription.addEventListener("input", () => {
        item.methodDescription = methodDescription.value;
        renderNodes();
        markDirty();
      });
      wrapper.appendChild(inspectorField("DESCRIZIONE METODO", methodDescription));
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
      if (selectedGroupId) {
        const group = groupById(selectedGroupId);
        emptyTitle.textContent = group ? group.title : "Gruppo selezionato";
        emptyText.textContent = "Trascina l'intestazione per muovere tutti i blocchi. Modifica il nome direttamente nel frame; Canc rimuove solo il gruppo.";
      } else if (selectedJunctionIds.size) {
        emptyTitle.textContent = selectedJunctionIds.size === 1 ? "Punto curva selezionato" : selectedJunctionIds.size + " punti curva selezionati";
        emptyText.textContent = "Trascina i punti per modificare il percorso. Ctrl/Shift aggiunge punti alla selezione; Canc li elimina.";
      } else if (count > 1) {
        emptyTitle.textContent = count + " blocchi selezionati";
        emptyText.textContent = "Trascina un blocco selezionato per muovere tutta la selezione. Ctrl/Cmd + G crea un frame di gruppo.";
      } else {
        emptyTitle.textContent = "Seleziona un blocco";
        emptyText.textContent = "Qui puoi modificarne contenuto, pseudocodice e campi senza imporre una sintassi.";
      }
      return;
    }

    ensureNodeMeta(node);
    $("inspectorTitle").textContent = node.title;
    $("inspectorTypeChip").textContent = typeMeta(node.type).label.toUpperCase();
    $("inspectorTypeChip").style.borderColor = typeMeta(node.type).color;
    $("inspectorTypeChip").style.color = typeMeta(node.type).color;
    $("inspectorSubtitle").textContent = nodeSubtitle(node);
    $("nodeType").value = node.type;
    $("nodeTitle").value = node.title;
    $("nodeDescription").value = node.description;
    $("nodePseudo").value = node.pseudo;

    renderTypeSettings(node);

    const contextSection = $("inspectorContextSection");
    const typeSettings = $("nodeTypeSettings");
    const hasContextSettings = !!(typeSettings && typeSettings.children.length);
    contextSection.style.display = hasContextSettings ? "" : "none";

    const structureLike = ["class", "struct", "jobStruct"].includes(node.type);
    const objectLike = node.type === "object";
    const flowStructured = ["event", "action", "state", "condition", "ifElse", "switch", "whileLoop", "doWhileLoop", "forLoop", "foreachLoop", "breakFlow", "continueFlow", "returnFlow"];
    const directStructured = ["function", "emptyGraph", "graphInput", "graphOutput", "enum", "constant", "adapter", "math", "logic", "compare"].concat(flowStructured).includes(node.type);

    $("addVariable").style.display = (structureLike || objectLike) ? "" : "none";
    $("addMethod").style.display = structureLike ? "" : "none";
    $("addEvent").style.display = node.type === "class" ? "" : "none";
    $("addRow").style.display = (structureLike || objectLike || directStructured || node.type === "component") ? "none" : "";

    const labels = {
      class: ["CLASS MEMBERS", "Variabili, metodi e UnityEvent della classe."],
      struct: ["STRUCT MEMBERS", "Campi e metodi del value type."],
      jobStruct: ["JOB DATA & EXECUTE", "Dati del job e metodo Execute sincronizzato con l'interfaccia."],
      object: ["GAMEOBJECT DATA", "Componenti e dati appartenenti al GameObject."],
      component: ["COMPONENT API", "Riferimento e proprietà principali del componente Unity."],
      function: ["FUNCTION", "Firma e porte della funzione; la logica avanzata vive nel Function Body."],
      emptyGraph: ["EMPTY GRAPH", "Configura input e output sul blocco; verranno istanziati nel canvas interno."],
      graphInput: ["GRAPH INPUT", "Porte generate dal blocco padre."],
      graphOutput: ["GRAPH OUTPUT", "Porte generate dal blocco padre."],
      enum: ["ENUM VALUES", "Valori nominati disponibili come tipo nel progetto."]
    };
    const labelInfo = labels[node.type] || [
      flowStructured.includes(node.type)
        ? (currentSchemaId() === "classic" ? "FLOW CHART PORTS" : "FLOW / DATA PORTS")
        : "CONTENT",
      flowStructured.includes(node.type)
        ? (currentSchemaId() === "classic"
          ? "Il flusso definisce l'ordine del diagramma; i dati trasportano valori tra i passaggi."
          : "FLOW controlla l'esecuzione; DATA trasporta valori tipati.")
        : "Porte e contenuto del blocco."
    ];
    $("contentSectionLabel").textContent = labelInfo[0];
    $("contentSectionHint").textContent = labelInfo[1];

    const pseudoVisible = ["class", "struct", "jobStruct", "object", "event", "action", "note"].includes(node.type);
    $("inspectorPseudoSection").style.display = pseudoVisible ? "" : "none";

    const contextTitles = {
      component: ["UNITY COMPONENT", "Tipo, categoria e origine del componente"],
      class: ["CLASS / UNITY", "Base type, visibilità e accesso"],
      struct: ["STRUCTURE", "Semantica C# della struct"],
      jobStruct: ["UNITY JOB", "Interfaccia Job, scheduling e Burst"],
      function: currentSchemaId() === "classic"
        ? ["FUNCTION", "Parametri, risultato e comportamento del sub-flow"]
        : ["FUNCTION SIGNATURE", "Owner, accesso, tipo e return"],
      event: currentSchemaId() === "classic"
        ? ["FLOW CHART ENTRY", "Configura come inizia questo ramo del diagramma"]
        : ["EVENT", "Impostazioni dell'evento"],
      action: currentSchemaId() === "classic"
        ? ["FLOW CHART PROCESS", "Configura il tipo di operazione del processo"]
        : ["ACTION", "Impostazioni dell'azione"]
    };
    const contextInfo = contextTitles[node.type] || ["SETTINGS", "Impostazioni specifiche del blocco"];
    $("inspectorContextTitle").textContent = contextInfo[0];
    $("inspectorContextHint").textContent = contextInfo[1];

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
    } else if (node.type === "struct" || node.type === "jobStruct") {
      appendGroup(node.type === "jobStruct" ? "JOB DATA" : "FIELDS", node.rows.filter((item) => item.kind === "variable" || item.kind === "property"));
      appendGroup(node.type === "jobStruct" ? "EXECUTE / METHODS" : "METHODS", node.rows.filter((item) => item.kind === "function"));
      appendGroup("OTHER", node.rows.filter((item) => !["variable", "property", "function"].includes(item.kind)));
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
    updateHistoryUI();
    setWorldTransform();
  }

  function selectNode(id, event, forceSingle) {
    const additive = !forceSingle && !!(event && (event.ctrlKey || event.metaKey || event.shiftKey));

    // Selecting a block arms block-to-port auto-connect and cancels any stale
    // half-finished port/junction interaction from a previous gesture.
    pendingPort = null;
    pendingJunction = null;
    $("connectionBanner").classList.remove("show");

    if (additive) {
      if (selectedNodeIds.has(id)) selectedNodeIds.delete(id);
      else selectedNodeIds.add(id);
    } else {
      selectedNodeIds = new Set([id]);
    }

    syncPrimarySelection();
    selectedEdgeId = null;
    selectedTypeRelationId = null;
    selectedJunctionIds.clear();
    selectedGroupId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function clearSelection() {
    selectedNodeIds.clear();
    selectedNodeId = null;
    selectedEdgeId = null;
    selectedTypeRelationId = null;
    selectedJunctionIds.clear();
    selectedGroupId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function renderedNodeBounds(node) {
    const element = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
    const width = element && element.offsetWidth > 0 ? element.offsetWidth : nodeWidthFor(node);
    const fallbackHeight = node.type === "sketch"
      ? Math.max(260, Number(node.sketchHeight || 320) + 95)
      : 220;
    const height = element && element.offsetHeight > 0 ? element.offsetHeight : fallbackHeight;
    return {
      x: node.x,
      y: node.y,
      width: width,
      height: height,
      centerX: node.x + width / 2,
      centerY: node.y + height / 2
    };
  }

  function assignDroppedNodesToGroups(nodeIds) {
    if (!Array.isArray(project.groups) || !project.groups.length || !Array.isArray(nodeIds) || !nodeIds.length) {
      return [];
    }

    // Snapshot target frames before changing membership. This keeps the drop
    // test stable when multiple selected nodes are released together.
    const candidates = project.groups
      .map((group) => ({ group: group, bounds: groupWorldBounds(group) }))
      .filter((entry) => !!entry.bounds);

    const assignments = [];

    nodeIds.forEach((nodeId) => {
      const node = nodeById(nodeId);
      if (!node) return;
      const nodeBounds = renderedNodeBounds(node);

      const targets = candidates
        .filter((entry) => !entry.group.nodeIds.includes(node.id))
        .filter((entry) => {
          const bounds = entry.bounds;
          return nodeBounds.centerX >= bounds.x &&
            nodeBounds.centerX <= bounds.x + bounds.width &&
            nodeBounds.centerY >= bounds.y &&
            nodeBounds.centerY <= bounds.y + bounds.height;
        })
        .sort((a, b) => (a.bounds.width * a.bounds.height) - (b.bounds.width * b.bounds.height));

      const target = targets[0];
      if (!target) return;

      // A block belongs to at most one group. Dropping it into a different
      // group transfers it there.
      project.groups.forEach((group) => {
        group.nodeIds = group.nodeIds.filter((id) => id !== node.id);
      });
      if (!target.group.nodeIds.includes(node.id)) target.group.nodeIds.push(node.id);
      assignments.push({ nodeId: node.id, groupId: target.group.id });
    });

    project.groups = project.groups.filter((group) => Array.isArray(group.nodeIds) && group.nodeIds.length);
    return assignments;
  }

  function startNodeDrag(event, node) {
    broadcastActivity("Sposta " + (node.title || "un blocco"));
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

    broadcastDragPreview(selectedNodes(), "Sposta blocchi");
    scheduleInteractionRender(true, true);
  }

  function endNodeDrag() {
    window.removeEventListener("pointermove", moveNode);
    const droppedNodeIds = dragState ? dragState.starts.map((item) => item.id) : [];
    const assignments = assignDroppedNodesToGroups(droppedNodeIds);
    dragState = null;
    if (interactionFrame) {
      cancelAnimationFrame(interactionFrame);
      interactionFrame = null;
      interactionNeedsGroups = false;
      interactionNeedsMinimap = false;
    }
    renderGroups();
    renderEdges();
    renderMinimap();
    markDirty();
    finishDragPreview();

    if (assignments.length === 1) {
      const group = groupById(assignments[0].groupId);
      showToast("Blocco aggiunto a " + (group && group.title ? group.title : "gruppo"));
    } else if (assignments.length > 1) {
      showToast(assignments.length + " blocchi aggiunti ai gruppi");
    }
  }

  function sameOutputConnectionRef(edge, ref) {
    return !!edge && !!ref &&
      edge.from.nodeId === ref.nodeId &&
      edge.from.rowId === ref.rowId;
  }

  function existingFanoutJunction(fromRef) {
    const siblings = project.connections.filter((edge) => sameOutputConnectionRef(edge, fromRef));

    for (const ownerEdge of siblings) {
      const explicit = (ownerEdge.points || []).find((point) => point && !point.junctionLink && point.fanoutJunction);
      if (explicit) return { edge: ownerEdge, point: explicit };
    }

    for (const ownerEdge of siblings) {
      for (const point of ownerEdge.points || []) {
        if (!point || point.junctionLink) continue;
        const referenced = project.connections.some((edge) =>
          edge.id !== ownerEdge.id &&
          (edge.points || []).some((candidate) =>
            candidate && candidate.junctionLink &&
            candidate.junctionLink.edgeId === ownerEdge.id &&
            candidate.junctionLink.pointId === point.id &&
            candidate.junctionAnchor === "from"
          )
        );
        if (referenced) {
          point.fanoutJunction = true;
          return { edge: ownerEdge, point: point };
        }
      }
    }
    return null;
  }

  function ensureOutputFanoutJunction(fromRef) {
    const existing = existingFanoutJunction(fromRef);
    if (existing) return existing;

    const ownerEdge = project.connections.find((edge) => sameOutputConnectionRef(edge, fromRef));
    if (!ownerEdge) return null;

    const start = getPortWorldPosition(fromRef);
    const end = getPortWorldPosition(ownerEdge.to);
    if (!start) return null;

    const horizontalDistance = end ? Math.abs(end.x - start.x) : 260;
    const lead = Math.max(70, Math.min(150, horizontalDistance * 0.28));
    const direction = end && end.x < start.x ? -1 : 1;
    const junction = {
      id: uid("junction"),
      x: Math.round((start.x + direction * lead) / 10) * 10,
      y: Math.round(start.y / 10) * 10,
      fanoutJunction: true
    };

    if (!Array.isArray(ownerEdge.points)) ownerEdge.points = [];
    ownerEdge.points.unshift(junction);
    return { edge: ownerEdge, point: junction };
  }

  function createConnectionFromCheck(check) {
    if (!check || !check.ok) return false;
    const duplicate = project.connections.some((edge) =>
      edge.from.nodeId === check.from.nodeId &&
      edge.from.rowId === check.from.rowId &&
      edge.to.nodeId === check.to.nodeId &&
      edge.to.rowId === check.to.rowId
    );

    if (!duplicate) {
      const hasSibling = project.connections.some((edge) => sameOutputConnectionRef(edge, check.from));
      const fanout = hasSibling ? ensureOutputFanoutJunction(check.from) : null;
      const points = fanout
        ? [makeLinkedJunctionPoint(fanout.edge.id, fanout.point.id, fanout.point, "from")]
        : [];

      project.connections.push({
        id: uid("edge"),
        from: {
          nodeId: check.from.nodeId,
          rowId: check.from.rowId,
          side: "out",
          kind: check.outputType === "__flow__" ? "flow" : "data"
        },
        to: {
          nodeId: check.to.nodeId,
          rowId: check.to.rowId,
          side: "in",
          kind: check.outputType === "__flow__" ? "flow" : "data"
        },
        points: points,
        dataType: check.outputType
      });
      markDirty();

      if (fanout) {
        selectedEdgeId = fanout.edge.id;
        selectedJunctionIds = new Set([junctionSelectionKey(fanout.edge.id, fanout.point.id)]);
      }
    }

    showToast(duplicate
      ? "Collegamento già esistente"
      : (project.connections.filter((edge) => sameOutputConnectionRef(edge, check.from)).length > 1
        ? (check.outputType === "__flow__" ? "Ramo FLOW creato" : "Ramo DATA creato")
        : (check.outputType === "__flow__"
          ? "Flusso collegato"
          : (check.outputType === "any"
            ? "Collegamento creato"
            : "Collegamento " + check.outputType + " creato"))));
    return !duplicate;
  }

  function nodeSemanticPortRefs(node, side) {
    if (!node || (side !== "in" && side !== "out")) return [];
    ensureNodeMeta(node);
    const refs = [];
    const seen = new Set();

    const add = (rowId, item, label) => {
      if (!rowId || !item) return;
      const key = rowId + "|" + side;
      if (seen.has(key)) return;

      const allowIn = ["variable", "property", "unityEvent", "flowIn", "condition", "input", "parameter"].includes(item.kind) &&
        !(item.kind === "parameter" && item.mode === "out");
      const allowOut = ["variable", "property", "unityEvent", "component", "flowOut", "condition", "output", "methodReturn", "parameter"].includes(item.kind) &&
        !(item.kind === "parameter" && !["ref", "out"].includes(item.mode));

      if ((side === "in" && !allowIn) || (side === "out" && !allowOut)) return;
      seen.add(key);
      refs.push({
        ref: {
          nodeId: node.id,
          rowId: rowId,
          side: side,
          kind: (item.kind === "flowIn" || item.kind === "flowOut") ? "flow" : "data"
        },
        item: item,
        label: String(label || item.label || item.name || "").trim()
      });
    };

    (node.rows || []).forEach((item) => {
      if (!item) return;
      if (item.kind === "function") {
        ensureFunctionSignature(item, item.access);
        (item.methodParameters || []).forEach((parameter) => {
          add(parameter.id, parameterProxy(parameter, item.access), parameter.name || parameter.label);
        });
        if (item.returnType && item.returnType !== "void") {
          add(item.returnPortId, methodReturnProxy(item, item.access), item.returnName || "result");
        }
        return;
      }
      add(item.id, item, item.label);
    });

    if (node.type === "function") {
      ensureFunctionSignature(node, node.methodAccess);
      (node.methodParameters || []).forEach((parameter) => {
        add(parameter.id, parameterProxy(parameter, node.methodAccess), parameter.name || parameter.label);
      });
      if (node.returnType && node.returnType !== "void") {
        add(node.returnPortId, methodReturnProxy(node, node.methodAccess), node.returnName || "result");
      }
    }

    return refs;
  }

  function autoConnectSelectedNodeToPort(ref) {
    if (!ref || selectedNodeIds.size !== 1) return { handled: false };
    const selectedId = selectedNodeId || Array.from(selectedNodeIds)[0];
    if (!selectedId || selectedId === ref.nodeId) return { handled: false };

    const selectedNode = nodeById(selectedId);
    if (!selectedNode) return { handled: false };

    const wantedSide = ref.side === "in" ? "out" : "in";
    const targetItem = memberByRef(ref);
    const targetType = ref.side === "in" ? memberInputType(targetItem) : memberOutputType(targetItem);
    const targetPos = getPortWorldPosition(ref);
    const candidates = [];

    nodeSemanticPortRefs(selectedNode, wantedSide).forEach((entry, index) => {
      const candidate = entry.ref;
      const check = connectionCheck(candidate, ref);
      if (!check.ok) return;

      const candidateType = wantedSide === "out"
        ? memberOutputType(entry.item)
        : memberInputType(entry.item);
      const exactType = normalizedType(candidateType) === normalizedType(targetType) &&
        !["any", "value"].includes(normalizedType(candidateType));
      const candidatePos = getPortWorldPosition(candidate);
      const verticalDistance = targetPos && candidatePos
        ? Math.abs(targetPos.y - candidatePos.y)
        : index * 12;

      const alreadyUsed = project.connections.some((edge) =>
        (wantedSide === "out" &&
          edge.from.nodeId === candidate.nodeId &&
          edge.from.rowId === candidate.rowId) ||
        (wantedSide === "in" &&
          edge.to.nodeId === candidate.nodeId &&
          edge.to.rowId === candidate.rowId)
      );

      const exactLabel = entry.label &&
        String(entry.label).toLowerCase() === String(targetItem && (targetItem.label || targetItem.name) || "").toLowerCase();

      candidates.push({
        check: check,
        score:
          (exactType ? 1200 : 0) +
          (exactLabel ? 250 : 0) +
          (check.outputType === "__flow__" ? 350 : 0) +
          (!alreadyUsed ? 150 : 0) -
          Math.min(120, verticalDistance / 4) -
          index * 0.01
      });
    });

    if (!candidates.length) {
      showToast("Nessuna porta compatibile nel nodo selezionato.");
      return { handled: true, connected: false };
    }

    candidates.sort((a, b) => b.score - a.score);
    createConnectionFromCheck(candidates[0].check);

    pendingPort = null;
    pendingJunction = null;
    $("connectionBanner").classList.remove("show");
    renderNodes();
    renderEdges();
    renderMinimap();
    renderInspector();

    return { handled: true, connected: true };
  }

  function handlePortClick(ref) {
    if (pendingJunction && !pendingPort) {
      finishJunctionConnection(ref, pendingJunction.edgeId, pendingJunction.pointId);
      return;
    }

    if (!pendingPort) {
      const autoResult = autoConnectSelectedNodeToPort(ref);
      if (autoResult.handled) return;
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

    createConnectionFromCheck(check);

    pendingPort = null;
    $("connectionBanner").classList.remove("show");
    renderNodes();
    renderEdges();
    renderMinimap();
  }

  function cancelConnection() {
    pendingPort = null;
    pendingJunction = null;
    $("connectionBanner").classList.remove("show");
    renderNodes();
    renderEdges();
  }

  function removeEdge(id) {
    project.connections = project.connections.filter((edge) => edge.id !== id);
    selectedEdgeId = null;
    selectedJunctionIds = new Set(Array.from(selectedJunctionIds).filter((key) => !key.startsWith(id + "::")));
    renderEdges();
    renderInspector();
    markDirty();
    showToast("Collegamento rimosso");
  }

  function removeSelected() {
    if (selectedJunctionIds.size) {
      const keys = new Set(selectedJunctionIds);
      let removed = 0;
      project.connections.forEach((edge) => {
        if (!Array.isArray(edge.points)) return;
        edge.points = edge.points.filter((point) => {
          const selected = keys.has(junctionSelectionKey(edge.id, point.id));
          if (selected) removed += 1;
          return !selected;
        });
      });
      selectedJunctionIds.clear();
      selectedEdgeId = null;
      renderEdges();
      renderInspector();
      markDirty();
      showToast(removed === 1 ? "Punto curva eliminato" : removed + " punti curva eliminati");
      return;
    }

    if (selectedGroupId) {
      removeGroup(selectedGroupId);
      return;
    }

    if (selectedEdgeId) {
      removeEdge(selectedEdgeId);
      return;
    }
    if (!selectedNodeIds.size) return;

    const protectedIds = new Set(
      project.nodes
        .filter((item) => item && item.boundaryLocked && selectedNodeIds.has(item.id))
        .map((item) => item.id)
    );
    if (protectedIds.size) {
      protectedIds.forEach((id) => selectedNodeIds.delete(id));
      syncPrimarySelection();
      if (!selectedNodeIds.size) {
        render();
        showToast("Graph Input e Graph Output sono generati dal nodo padre.");
        return;
      }
    }

    const ids = new Set(selectedNodeIds);
    const count = ids.size;
    project.nodes = project.nodes.filter((item) => !ids.has(item.id));
    project.connections = project.connections.filter((edge) =>
      !ids.has(edge.from.nodeId) && !ids.has(edge.to.nodeId)
    );
    (project.groups || []).forEach((group) => {
      group.nodeIds = group.nodeIds.filter((id) => !ids.has(id));
    });
    project.groups = project.groups.filter((group) => group.nodeIds.length);

    selectedNodeIds.clear();
    selectedNodeId = null;
    selectedGroupId = null;
    render();
    markDirty();
    showToast(count === 1 ? "Blocco eliminato" : count + " blocchi eliminati");
  }

  function defaultNode(type, x, y, presetComponent, preset) {
    const componentType = presetComponent || "Animator";
    const nodePreset = preset && typeof preset === "object" ? preset : {};
    const templates = {
      object: {
        title: "New GameObject",
        description: "GameObject Unity: contenitore di componenti, script e dati concettuali.",
        rows: [
          row("GameObject", "GameObject", "output"),
          componentRow("Transform", "core", "unity", { locked: true })
        ],
        pseudo: ""
      },
      component: {
        title: componentType,
        description: "Componente Unity standalone: il riferimento del componente e le sue proprietà possono essere collegati.",
        rows: [row(componentType, componentType, "output")].concat(componentPresetRows(componentType)),
        pseudo: "",
        extra: {
          componentType: componentType,
          componentCategory: componentCategoryFor(componentType),
          componentSource: "unity"
        }
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
      struct: {
        title: "NewStruct",
        description: "Struttura dati C# compatta con campi e metodi.",
        rows: [
          variableRow("value", "float", "public")
        ],
        pseudo: "",
        extra: {
          structVisibility: "public",
          structReadonly: false,
          structSerializable: true
        }
      },
      jobStruct: {
        title: "NewJob",
        description: "Unity Job struct: dati di input/output e metodo Execute.",
        rows: [
          variableRow("deltaTime", "float", "public")
        ],
        pseudo: "",
        extra: {
          structVisibility: "public",
          structReadonly: false,
          structSerializable: false,
          jobInterface: "IJob",
          jobScheduleMode: "Schedule",
          jobBurst: true
        }
      },
      function: {
        title: "NewMethod",
        description: "Metodo concettuale con firma C#/Unity.",
        rows: [],
        pseudo: "",
        extra: {
          ownerClassId: "",
          methodAccess: "public",
          methodKind: "custom",
          returnType: "void",
          returnCollectionKind: "single",
          returnArrayLength: 0,
          returnDictionaryKeyType: "string",
          parameters: "",
          methodParameters: [],
          returnPortId: uid("return"),
          returnName: "result",
          methodDescription: "",
          methodLogic: "",
          methodEditorMode: "basic",
          methodBody: { version: 1, name: "Function Body", nodes: [], connections: [], groups: [] }
        }
      },
      emptyGraph: {
        title: "Empty",
        description: "Nodo contenitore con un canvas interno completamente libero.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Next", "", "flowOut")
        ],
        pseudo: "",
        extra: {
          nestedGraph: { version: 1, name: "Empty Body", nodes: [], connections: [], groups: [] }
        }
      },
      enum: {
        title: "GameState",
        description: "Tipo enumerato per stati, modalità e scelte di gameplay.",
        rows: [],
        pseudo: "",
        extra: {
          enumVisibility: "public",
          enumUnderlyingType: "int",
          enumFlags: false,
          enumValues: [
            enumValue("None", 0),
            enumValue("Idle", 1),
            enumValue("Active", 2)
          ]
        }
      },
      switch: {
        title: "Switch",
        description: "Dirama il FLOW in base a un valore: int, string, bool, enum o altro tipo.",
        rows: [],
        pseudo: "",
        extra: {
          switchValueType: "int",
          switchCases: [
            { id: uid("switch_case"), value: "0" },
            { id: uid("switch_case"), value: "1" }
          ],
          switchDefaultRowId: uid("switch_default")
        }
      },
      ifElse: {
        title: "If / Else",
        description: "Dirama il flusso in base a una condizione booleana.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Condition", "bool", "input"),
          row("True", "", "flowOut"),
          row("False", "", "flowOut")
        ],
        pseudo: "if (Condition)"
      },
      whileLoop: {
        title: "While",
        description: "Ripete il corpo finché la condizione rimane vera.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Condition", "bool", "input"),
          row("Loop", "", "flowOut"),
          row("Done", "", "flowOut")
        ],
        pseudo: "while (Condition)"
      },
      doWhileLoop: {
        title: "Do While",
        description: "Esegue il corpo almeno una volta, poi verifica la condizione.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Loop", "", "flowOut"),
          row("Condition", "bool", "input"),
          row("Done", "", "flowOut")
        ],
        pseudo: "do { ... } while (Condition)"
      },
      forLoop: {
        title: "For",
        description: "Ciclo indicizzato con start, end e step.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Start", "int", "input"),
          row("End", "int", "input"),
          row("Step", "int", "input"),
          { id: "for_index", label: "Index", value: "int", kind: "output" },
          row("Loop", "", "flowOut"),
          row("Done", "", "flowOut")
        ],
        pseudo: "for (int i = Start; i < End; i += Step)"
      },
      foreachLoop: {
        title: "Foreach",
        description: "Itera gli elementi di una collezione e restituisce Item + Index.",
        rows: [
          row("Enter", "", "flowIn"),
          { id: "foreach_collection", label: "Collection", value: "any", kind: "input" },
          { id: "foreach_item", label: "Item", value: "any", kind: "output" },
          { id: "foreach_index", label: "Index", value: "int", kind: "output" },
          row("Loop", "", "flowOut"),
          row("Done", "", "flowOut")
        ],
        pseudo: "foreach (Item item in Collection)",
        extra: { foreachItemType: "any" }
      },
      breakFlow: {
        title: "Break",
        description: "Interrompe il loop più vicino.",
        rows: [row("Enter", "", "flowIn")],
        pseudo: "break;"
      },
      continueFlow: {
        title: "Continue",
        description: "Salta alla prossima iterazione del loop più vicino.",
        rows: [row("Enter", "", "flowIn")],
        pseudo: "continue;"
      },
      returnFlow: {
        title: "Return",
        description: "Termina la funzione corrente e restituisce opzionalmente un valore.",
        rows: [],
        pseudo: "return;",
        extra: {
          returnFlowType: "void",
          returnFlowInId: uid("return_flow_in"),
          returnValueRowId: uid("return_value")
        }
      },
      flowStart: {
        title: "Start",
        description: "Punto iniziale del flow chart.",
        rows: [row("Next", "", "flowOut")],
        pseudo: "",
        extra: { flowStartOutId: "" }
      },
      flowEnd: {
        title: "End",
        description: "Termina il ramo corrente del flow chart.",
        rows: [row("Enter", "", "flowIn")],
        pseudo: "",
        extra: { flowEndInId: "" }
      },
      flowIO: {
        title: "Input",
        description: "Legge un valore in ingresso o invia un valore in uscita mantenendo la sequenza del flow chart.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Next", "", "flowOut"),
          row("Value", "any", "output")
        ],
        pseudo: "",
        extra: {
          flowIoMode: "input",
          flowChartDataType: "any",
          flowIoFlowInId: "",
          flowIoFlowOutId: "",
          flowIoDataInId: "",
          flowIoDataOutId: ""
        }
      },
      flowProcess: {
        title: "Process",
        description: "Operazione generica del flow chart. Può esporre dati e contenere un body annidato.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Next", "", "flowOut")
        ],
        pseudo: "",
        extra: {
          flowProcessInId: "",
          flowProcessOutId: "",
          nestedGraph: { version: 1, name: "Process Body", nodes: [], connections: [], groups: [] }
        }
      },
      constant: {
        title: "Value",
        description: "Valore letterale tipato: numero, bool, string, vector, enum o riferimento nullo.",
        rows: [],
        pseudo: "0",
        extra: {
          constantType: "int",
          constantValue: "0",
          constantOutputRowId: uid("constant_out")
        }
      },
      adapter: {
        title: "Adapter",
        description: "Converte esplicitamente un tipo dati in un altro, come nei graph editor.",
        rows: [],
        pseudo: "",
        extra: {
          adapterInputType: "int",
          adapterOutputType: "float",
          adapterInputRowId: uid("adapter_in"),
          adapterOutputRowId: uid("adapter_out")
        }
      },
      math: {
        title: "Math",
        description: "Operazione matematica tipata e collegabile.",
        rows: [],
        pseudo: "",
        extra: {
          mathOperation: "add",
          mathDataType: "float",
          mathInputAId: uid("math_a"),
          mathInputBId: uid("math_b"),
          mathInputCId: uid("math_c"),
          mathOutputId: uid("math_out")
        }
      },
      logic: {
        title: "Logic",
        description: "Operazione booleana AND, OR, XOR o NOT.",
        rows: [],
        pseudo: "",
        extra: {
          logicOperation: "and",
          logicInputAId: uid("logic_a"),
          logicInputBId: uid("logic_b"),
          logicOutputId: uid("logic_out")
        }
      },
      compare: {
        title: "Compare",
        description: "Confronta due valori tipati e restituisce bool.",
        rows: [],
        pseudo: "",
        extra: {
          compareOperation: "equal",
          compareDataType: "float",
          compareInputAId: uid("compare_a"),
          compareInputBId: uid("compare_b"),
          compareOutputId: uid("compare_out")
        }
      },
      event: {
        title: "Gameplay Event",
        description: "Punto di ingresso del flusso: evento Unity, input o evento custom.",
        rows: [
          row("Next", "", "flowOut"),
          row("payload", "value", "output")
        ],
        pseudo: "",
        extra: { eventKind: "custom" }
      },
      action: {
        title: "Gameplay Action",
        description: "Azione eseguita nel flow: chiama un metodo, cambia un dato o attiva un sistema.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Next", "", "flowOut")
        ],
        pseudo: "",
        extra: { actionKind: "custom" }
      },
      state: {
        title: "Gameplay State",
        description: "Stato di gameplay con entrata, permanenza e uscita.",
        rows: [
          row("Enter", "", "flowIn"),
          row("Transition", "", "flowOut")
        ],
        pseudo: "",
        extra: { stateKind: "normal" }
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
        rows: [
          row("Enter", "", "flowIn"),
          row("A", "value", "input"),
          row("B", "value", "input"),
          row("True", "", "flowOut"),
          row("False", "", "flowOut"),
          row("result", "bool", "output")
        ],
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
      },
      sketch: {
        title: "Sketch",
        description: "",
        rows: [],
        pseudo: "",
        extra: {
          sketchStrokes: [],
          sketchColor: "#52677c",
          sketchSize: 3,
          sketchMode: "draw",
          sketchWidth: 520,
          sketchHeight: 320
        }
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
    Object.assign(node, source.extra || {}, nodePreset);

    if (currentSchemaId() === "classic") {
      if (type === "function") {
        node.title = "Function";
        node.description = "Funzione generica con parametri, risultato e sotto-grafo.";
      } else if (type === "emptyGraph") {
        node.title = "Sub Flow";
        node.description = "Sotto-diagramma con input e output configurabili.";
      } else if (type === "returnFlow") {
        node.title = "Return";
        node.description = "Restituisce un valore e termina la Function corrente.";
      } else if (type === "ifElse") {
        node.title = "Decision";
        node.description = "Valuta una condizione e separa il flusso nei rami True e False.";
      } else if (type === "switch") {
        node.title = "Multi Decision";
        node.description = "Dirama il flusso in più percorsi in base a un valore.";
      } else if (type === "forLoop") {
        node.title = "Counted Loop";
        node.description = "Ripete un blocco usando indice, limite e incremento.";
      } else if (type === "foreachLoop") {
        node.title = "For Each";
        node.description = "Ripete il flusso per ogni elemento di una collezione.";
      } else if (type === "whileLoop") {
        node.title = "While Loop";
        node.description = "Ripete il flusso finché la condizione è vera.";
      } else if (type === "doWhileLoop") {
        node.title = "Do While Loop";
        node.description = "Esegue il flusso almeno una volta e poi verifica la condizione.";
      } else if (type === "adapter") {
        node.title = "Convert";
        node.description = "Converte un valore da un tipo compatibile a un altro.";
      }
    }

    if (type === "math") node.title = mathOperationLabel(node.mathOperation);
    if (type === "logic") node.title = logicOperationLabel(node.logicOperation);
    if (type === "compare") node.title = compareOperationLabel(node.compareOperation);
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

  function blockPaletteItems() {
    const schema = currentSchemaId();
    const common = [
      { type: "function", category: "STRUTTURA", label: "Funzione", description: "Funzione con parametri, return e sotto-grafo", icon: "ƒ" },
      { type: "emptyGraph", category: "STRUTTURA", label: "Empty", description: "Sotto-grafo annidato con input e output configurabili", icon: "□" },
      { type: "enum", category: "STRUTTURA", label: "Enum", description: "Valori nominati per stati e modalità", icon: "E" },

      { type: "event", category: "FLOW", label: "Evento", description: "Punto di ingresso del flusso", icon: "⚡" },
      { type: "action", category: "FLOW", label: "Azione", description: "Esegue un'operazione nel flusso", icon: "▶" },
      { type: "ifElse", category: "FLOW", label: "If / Else", description: "Decisione booleana con due rami", icon: "if" },
      { type: "switch", category: "FLOW", label: "Switch", description: "Dirama il flusso usando un valore", icon: "⇆" },
      { type: "forLoop", category: "FLOW", label: "For", description: "Ciclo indicizzato Start / End / Step", icon: "i" },
      { type: "foreachLoop", category: "FLOW", label: "Foreach", description: "Itera una collezione", icon: "∀" },
      { type: "whileLoop", category: "FLOW", label: "While", description: "Ripete finché una condizione è vera", icon: "↻" },
      { type: "doWhileLoop", category: "FLOW", label: "Do While", description: "Esegue una volta e poi verifica la condizione", icon: "⟳" },
      { type: "breakFlow", category: "FLOW", label: "Break", description: "Interrompe il ciclo corrente", icon: "■" },
      { type: "continueFlow", category: "FLOW", label: "Continue", description: "Passa all'iterazione successiva", icon: "↪" },
      { type: "returnFlow", category: "FLOW", label: "Return", description: "Termina il flusso o restituisce un valore", icon: "↩" },

      { type: "constant", category: "DATI", label: "Valore", description: "Costante tipata", icon: "•" },
      { type: "variable", category: "DATI", label: "Variabile", description: "Dato o valore condiviso", icon: "x" },
      { type: "adapter", category: "DATI", label: "Converti tipo", description: "Conversione esplicita tra tipi compatibili", icon: "↔" },

      { type: "math", category: "OPERATORI", label: "Math", description: "Add, Subtract, Multiply, Divide, Clamp, Lerp…", icon: "±" },
      { type: "logic", category: "OPERATORI", label: "Logic", description: "AND, OR, XOR, NOT", icon: "∧" },
      { type: "compare", category: "OPERATORI", label: "Compare", description: "==, !=, >, >=, <, <= → bool", icon: "≶" }
    ];

    if (schema === "classic") {
      return [
        { type: "flowStart", category: "FLOW CHART", label: "Start", description: "Punto iniziale del diagramma", icon: "▶" },
        { type: "flowEnd", category: "FLOW CHART", label: "End", description: "Termina il ramo corrente", icon: "■" },
        { type: "flowIO", category: "FLOW CHART", label: "Input / Output", description: "Legge o scrive un valore nel flusso", icon: "⇄" },
        { type: "flowProcess", category: "FLOW CHART", label: "Process", description: "Operazione generica con dati, pseudocodice e body", icon: "▭" },

        { type: "ifElse", category: "CONTROL", label: "Decision", description: "Condizione con ramo True e False", icon: "◇" },
        { type: "switch", category: "CONTROL", label: "Multi Decision", description: "Decisione con più percorsi", icon: "⇆" },
        { type: "forLoop", category: "CONTROL", label: "Counted Loop", description: "Ciclo con indice, limite e incremento", icon: "i" },
        { type: "foreachLoop", category: "CONTROL", label: "For Each", description: "Ripete il flusso per ogni elemento", icon: "∀" },
        { type: "whileLoop", category: "CONTROL", label: "While Loop", description: "Ripete finché la condizione è vera", icon: "↻" },
        { type: "doWhileLoop", category: "CONTROL", label: "Do While Loop", description: "Esegue una volta e poi verifica la condizione", icon: "⟳" },
        { type: "breakFlow", category: "CONTROL", label: "Break", description: "Interrompe il loop corrente", icon: "■" },
        { type: "continueFlow", category: "CONTROL", label: "Continue", description: "Passa all'iterazione successiva", icon: "↪" },

        { type: "function", category: "SUB FLOW", label: "Function", description: "Funzione con parametri, return e body annidato", icon: "ƒ" },
        { type: "emptyGraph", category: "SUB FLOW", label: "Sub Flow", description: "Diagramma annidato con input e output configurabili", icon: "□" },
        { type: "returnFlow", category: "SUB FLOW", label: "Return", description: "Termina una Function e restituisce un valore opzionale", icon: "↩" },

        { type: "constant", category: "DATA", label: "Value", description: "Valore costante tipato", icon: "•" },
        { type: "variable", category: "DATA", label: "Variable", description: "Dato memorizzato o condiviso", icon: "x" },
        { type: "adapter", category: "DATA", label: "Convert", description: "Converte un valore tra tipi compatibili", icon: "↔" },

        { type: "math", category: "MATH & LOGIC", label: "Math", description: "Operazioni matematiche", icon: "±" },
        { type: "compare", category: "MATH & LOGIC", label: "Compare", description: "Confronta due valori e produce bool", icon: "≶" },
        { type: "logic", category: "MATH & LOGIC", label: "Logic", description: "AND, OR, XOR e NOT", icon: "∧" }
      ];
    }

    const items = common.slice();

    if (schema === "unity") {
      items.unshift(
        { type: "object", category: "STRUTTURA", label: "GameObject", description: "Riferimento a un oggetto Unity e ai suoi componenti", icon: "◇" },
        { type: "class", category: "STRUTTURA", label: "Classe", description: "Contenitore C# / MonoBehaviour per stato, metodi ed eventi", icon: "C" },
        { type: "struct", category: "STRUTTURA", label: "Struct", description: "Value type C# con campi e metodi", icon: "{}" },
        { type: "jobStruct", category: "STRUTTURA", label: "Unity Job Struct", description: "IJob / IJobFor / IJobParallelFor / IJobEntity", icon: "J" }
      );

      UNITY_COMPONENT_CATEGORIES.forEach((componentCategory) => {
        componentCategory.components.forEach((componentName) => {
          items.push({
            type: "component",
            component: componentName,
            category: "UNITY COMPONENTS · " + componentCategory.label,
            label: componentName,
            description: "Componente Unity · " + componentCategory.label.toLowerCase(),
            icon: componentName.charAt(0).toUpperCase()
          });
        });
      });
    }

    // Unreal e Godot usano per ora il core engine-neutral. I blocchi specifici
    // verranno aggiunti quando implementeremo le rispettive librerie.
    return items;
  }

  function createNewBlockResultButton(item, onPick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "new-block-result";

    const icon = document.createElement("span");
    icon.className = "new-block-result-icon";
    icon.textContent = item.icon || "◇";

    const copy = document.createElement("span");
    copy.className = "new-block-result-copy";
    const name = document.createElement("strong");
    name.textContent = item.label;
    const description = document.createElement("small");
    description.textContent = item.description || (item.component ? "Componente Unity" : item.category);
    copy.append(name, description);

    const category = document.createElement("span");
    category.className = "new-block-result-category";
    category.textContent = item.component || "";

    button.append(icon, copy, category);
    button.addEventListener("click", () => {
      if (typeof onPick === "function") onPick(item);
    });
    return button;
  }

  function closeNewBlockFan() {
    const fan = $("newBlockFan");
    if (!fan) return;
    fan._positionToken = (fan._positionToken || 0) + 1;
    fan.classList.remove("open", "positioning");
    fan.setAttribute("aria-hidden", "true");
    fan.style.left = "";
    fan.style.top = "";
    fan.style.width = "";
    fan.innerHTML = "";
    activeBlockFanCategory = "";
    document.querySelectorAll(".new-block-category.active").forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-expanded", "false");
    });
  }

  function positionNewBlockFan(anchor) {
    const fan = $("newBlockFan");
    if (!fan || !anchor) return;

    const token = (fan._positionToken || 0) + 1;
    fan._positionToken = token;

    const safe = 12;
    const gap = 8;
    const maxAvailable = Math.max(240, window.innerWidth - safe * 2);
    const desiredWidth = Math.min(340, maxAvailable);

    // Measure completely off-screen and invisible. The flyout is made visible
    // only after its final coordinates are known, preventing the 0,0 flash.
    fan.classList.remove("open");
    fan.classList.add("positioning");
    fan.setAttribute("aria-hidden", "true");
    fan.style.width = desiredWidth + "px";
    fan.style.left = "-10000px";
    fan.style.top = "-10000px";

    requestAnimationFrame(() => {
      if (fan._positionToken !== token || !anchor.isConnected) return;

      const anchorRect = anchor.getBoundingClientRect();
      const measured = fan.getBoundingClientRect();

      let left = anchorRect.right + gap;
      if (left + measured.width > window.innerWidth - safe) {
        left = Math.max(safe, window.innerWidth - measured.width - safe);
      }

      let top = anchorRect.top;
      if (top + measured.height > window.innerHeight - safe) {
        top = Math.max(safe, window.innerHeight - measured.height - safe);
      }
      if (top < safe) top = safe;

      fan.style.left = Math.round(left) + "px";
      fan.style.top = Math.round(top) + "px";

      requestAnimationFrame(() => {
        if (fan._positionToken !== token || !anchor.isConnected) return;
        fan.classList.remove("positioning");
        fan.classList.add("open");
        fan.setAttribute("aria-hidden", "false");
      });
    });
  }

  function openNewBlockFan(group, anchor) {
    const fan = $("newBlockFan");
    if (!fan || !group || !anchor) return;

    if (activeBlockFanCategory === group.category && fan.classList.contains("open")) {
      closeNewBlockFan();
      return;
    }

    activeBlockFanCategory = group.category;
    document.querySelectorAll(".new-block-category.active").forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-expanded", "false");
    });
    anchor.classList.add("active");
    anchor.setAttribute("aria-expanded", "true");

    fan.innerHTML = "";

    const head = document.createElement("div");
    head.className = "new-block-fan-head";
    const titleWrap = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "CATEGORIA";
    const title = document.createElement("strong");
    title.textContent = group.category;
    titleWrap.append(eyebrow, title);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "new-block-fan-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Chiudi categoria");
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeNewBlockFan();
    });
    head.append(titleWrap, close);

    const list = document.createElement("div");
    list.className = "new-block-fan-list";
    group.items.forEach((item) => {
      list.appendChild(createNewBlockResultButton(item, (picked) => {
        addNode(picked.type, picked.component, picked.preset);
        closeNewBlockFan();
        closeNewBlockPalette();
      }));
    });

    fan.append(head, list);
    positionNewBlockFan(anchor);
  }

  function renderNewBlockPalette(query) {
    const container = $("newBlockResults");
    if (!container) return;
    container.innerHTML = "";
    closeNewBlockFan();

    const term = String(query || "").trim().toLowerCase();
    const allItems = blockPaletteItems();
    const items = allItems.filter((item) => {
      const haystack = [item.label, item.description, item.category, item.type, item.component].join(" ").toLowerCase();
      return !term || haystack.includes(term);
    });

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "new-block-empty";
      empty.textContent = "Nessun blocco trovato. Prova con un nome o una categoria diversa.";
      container.appendChild(empty);
      return;
    }

    // Search bypasses categories and shows direct choices.
    if (term) {
      const searchLabel = document.createElement("div");
      searchLabel.className = "new-block-search-results-label";
      searchLabel.textContent = items.length + (items.length === 1 ? " risultato" : " risultati");
      container.appendChild(searchLabel);

      items.forEach((item, index) => {
        const button = createNewBlockResultButton(item, (picked) => {
          addNode(picked.type, picked.component, picked.preset);
          closeNewBlockPalette();
        });
        if (index === 0) button.classList.add("keyboard-active");
        container.appendChild(button);
      });
      return;
    }

    const groups = [];
    const byCategory = new Map();
    allItems.forEach((item) => {
      if (!byCategory.has(item.category)) {
        const group = { category: item.category, items: [] };
        byCategory.set(item.category, group);
        groups.push(group);
      }
      byCategory.get(item.category).items.push(item);
    });

    groups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "new-block-category";
      button.setAttribute("aria-expanded", "false");

      const categoryCopy = document.createElement("span");
      categoryCopy.className = "new-block-category-copy";
      const categoryName = document.createElement("strong");
      categoryName.textContent = group.category;
      const categoryCount = document.createElement("small");
      categoryCount.textContent = String(group.items.length);
      categoryCopy.append(categoryName, categoryCount);

      const chevron = document.createElement("span");
      chevron.className = "new-block-category-chevron";
      chevron.textContent = "›";
      button.append(categoryCopy, chevron);

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openNewBlockFan(group, button);
      });

      container.appendChild(button);
    });
  }

  function openNewBlockPalette() {
    const palette = $("newBlockPalette");
    const search = $("newBlockSearch");
    if (!palette || !search) return;
    closeInterfaceSurfaces(palette);
    palette.classList.add("open");
    palette.setAttribute("aria-hidden", "false");
    $("addObjectTop").setAttribute("aria-expanded", "true");
    search.value = "";
    renderNewBlockPalette("");
    requestAnimationFrame(() => {
      search.focus();
      search.select();
    });
  }

  function closeNewBlockPalette() {
    const palette = $("newBlockPalette");
    if (!palette) return;
    closeNewBlockFan();
    palette.classList.remove("open");
    palette.setAttribute("aria-hidden", "true");
    $("addObjectTop").setAttribute("aria-expanded", "false");
  }

  function aiBuilderAddMessage(role, text) {
    const container = $("aiBuilderMessages");
    if (!container) return;
    const message = document.createElement("div");
    message.className = "ai-message " + (role === "user" ? "user" : "assistant");

    const label = document.createElement("span");
    label.className = "ai-message-role";
    label.textContent = role === "user" ? "Tu" : "ProjectFlow AI";

    const copy = document.createElement("p");
    copy.textContent = text;
    message.append(label, copy);
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  function openAiBuilderPanel() {
    const dock = $("aiBuilderDock");
    const panel = $("aiBuilderPanel");
    const button = $("aiBuilderButton");
    if (!dock || !panel || !button) return;

    const willOpen = !dock.classList.contains("open");
    closeInterfaceSurfaces(willOpen ? panel : null);
    dock.classList.toggle("open", willOpen);
    panel.setAttribute("aria-hidden", willOpen ? "false" : "true");
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");
    button.classList.toggle("active", willOpen);

    if (willOpen) {
      requestAnimationFrame(() => {
        const input = $("aiBuilderPrompt");
        if (input) input.focus();
      });
    }
  }

  function closeAiBuilderPanel() {
    const dock = $("aiBuilderDock");
    const panel = $("aiBuilderPanel");
    const button = $("aiBuilderButton");
    if (!dock || !panel || !button) return;
    dock.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-expanded", "false");
    button.classList.remove("active");
  }

  function aiNormalizePrompt(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function aiConnect(fromNode, fromRow, toNode, toRow, dataType) {
    if (!fromNode || !fromRow || !toNode || !toRow) return null;
    const type = dataType || memberOutputType(fromRow);
    const edge = {
      id: uid("edge"),
      from: {
        nodeId: fromNode.id,
        rowId: fromRow.id,
        side: "out",
        kind: type === "__flow__" ? "flow" : "data"
      },
      to: {
        nodeId: toNode.id,
        rowId: toRow.id,
        side: "in",
        kind: type === "__flow__" ? "flow" : "data"
      },
      points: [],
      dataType: type
    };
    project.connections.push(edge);
    return edge;
  }

  function aiBuilderSetStatus(text, state) {
    const status = $("aiBuilderStatus");
    const copy = $("aiBuilderStatusText");
    if (copy) copy.textContent = text || "Gemini via Firebase";
    if (status) {
      status.classList.remove("loading", "ready", "error");
      if (state) status.classList.add(state);
    }
  }

  function aiPlannerCatalog() {
    return [
      { type: "flowStart", purpose: "Flow Chart start", ports: "OUT Next:flow" },
      { type: "flowEnd", purpose: "Flow Chart terminal", ports: "IN Enter:flow" },
      { type: "flowIO", purpose: "Flow Chart input/output", config: "flowIoMode(input|output), flowChartDataType", ports: "IN Enter:flow, OUT Next:flow, IN or OUT Value:data" },
      { type: "flowProcess", purpose: "generic Flow Chart process", ports: "IN Enter:flow, OUT Next:flow, optional data input/output rows" },
      { type: "object", purpose: "GameObject / target reference", ports: "OUT GameObject:GameObject" },
      { type: "component", purpose: "Unity component reference", config: "componentType", ports: "OUT component reference" },
      { type: "struct", purpose: "C# value type with fields and methods", ports: "member ports" },
      { type: "jobStruct", purpose: "Unity Job struct implementing a job interface", config: "jobInterface, jobScheduleMode, jobBurst", ports: "job data and Execute members" },
      { type: "event", purpose: "flow entry point", ports: "OUT Next:flow, OUT payload:any; may add extra output rows" },
      { type: "action", purpose: "perform a gameplay action", ports: "IN Enter:flow, OUT Next:flow; may add extra input/output rows" },
      { type: "constant", purpose: "typed literal / constant value", config: "constantType, constantValue", ports: "OUT Value:data" },
      { type: "variable", purpose: "state/data value", ports: "IN+OUT value:data; rows can define named variables" },
      { type: "ifElse", purpose: "branch by bool", ports: "IN Enter:flow, IN Condition:bool, OUT True:flow, OUT False:flow" },
      { type: "whileLoop", purpose: "while loop", ports: "IN Enter:flow, IN Condition:bool, OUT Loop:flow, OUT Done:flow" },
      { type: "doWhileLoop", purpose: "do while loop", ports: "IN Enter:flow, OUT Loop:flow, IN Condition:bool, OUT Done:flow" },
      { type: "forLoop", purpose: "indexed loop", ports: "IN Enter:flow, IN Start:int, IN End:int, IN Step:int, OUT Index:int, OUT Loop:flow, OUT Done:flow" },
      { type: "foreachLoop", purpose: "collection loop", config: "foreachItemType", ports: "IN Enter:flow, IN Collection:any, OUT Item:any, OUT Index:int, OUT Loop:flow, OUT Done:flow" },
      { type: "breakFlow", purpose: "exit nearest loop", ports: "IN Enter:flow" },
      { type: "continueFlow", purpose: "continue nearest loop", ports: "IN Enter:flow" },
      { type: "returnFlow", purpose: "return from current function", config: "returnFlowType", ports: "IN Enter:flow, optional IN Value:data" },
      { type: "math", purpose: "numeric expression", config: "mathOperation(add|subtract|multiply|divide|modulo|power|min|max|clamp|lerp|abs|sqrt), mathDataType", ports: "inputs depend on operation: A/B or Value/Min/Max; OUT Result:data" },
      { type: "logic", purpose: "boolean expression", config: "logicOperation(and|or|xor|not)", ports: "IN A:bool, optional IN B:bool, OUT Result:bool" },
      { type: "compare", purpose: "comparison", config: "compareOperation(equal|notEqual|greater|greaterEqual|less|lessEqual), compareDataType", ports: "IN A:data, IN B:data, OUT Result:bool" },
      { type: "adapter", purpose: "explicit data conversion", config: "adapterInputType, adapterOutputType", ports: "IN In:data, OUT Out:data" },
    ];
  }

  function aiCurrentGraphContext() {
    const selected = selectedNodes().slice(0, 16);
    const source = selected.length ? selected : project.nodes.slice(-24);
    return {
      projectName: project.name || "Untitled Flow",
      selected: selected.map((node) => ({ id: node.id, type: node.type, title: node.title })),
      nearbyNodes: source.map((node) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        rows: (node.rows || []).slice(0, 8).map((item) => ({
          label: item.label,
          kind: item.kind,
          dataType: item.dataType || item.value || item.componentType || ""
        }))
      })),
      connectionCount: project.connections.length
    };
  }

  function aiPlannerSystemPrompt() {
    return [
      "You are ProjectFlow Graph Planner, a visual-programming architect for Unity-style gameplay logic.",
      "You do NOT write source code as the primary result. You design a graph using only the provided ProjectFlow node catalog.",
      "Decide autonomously which nodes are needed, how they are configured, and how they connect.",
      "Prefer semantic, reusable logic. Use explicit state variables, comparisons, branches and actions when appropriate.",
      "Return ONLY one JSON object with keys: summary, groupTitle, nodes, connections.",
      "nodes: array of {key,type,title,description,pseudo,config,rows,column,row}. key must be unique.",
      "rows is optional and only adds/customizes data ports. Each row is {label,kind,dataType,defaultValue}. kind is one of input,output,variable,property.",
      "connections: array of {from:{node,port},to:{node,port},dataType}. node references a node key. port is the visible port label.",
      "Use dataType='__flow__' for execution-flow connections. Otherwise use a concrete type such as bool,int,float,string,GameObject,Transform,Rigidbody or any.",
      "Do not invent node types outside the catalog. Do not reference ports that do not exist or that you did not add in rows.",
      "Keep graphs compact but complete. A behavior request should normally have an event/entry, state/data as needed, control flow, and actions.",
      "column and row are small non-negative integers for layout; flow should generally progress left-to-right.",
      "JSON only. No markdown and no commentary outside JSON."
    ].join("\n");
  }

  function aiPlannerUserPrompt(prompt) {
    return JSON.stringify({
      request: prompt,
      catalog: aiPlannerCatalog(),
      currentGraph: aiCurrentGraphContext()
    });
  }

  function aiExtractJson(text) {
    const source = String(text || "").trim();
    if (!source) throw new Error("Il modello non ha restituito un piano.");
    try {
      return JSON.parse(source);
    } catch (error) {
      const first = source.indexOf("{");
      const last = source.lastIndexOf("}");
      if (first >= 0 && last > first) return JSON.parse(source.slice(first, last + 1));
      throw error;
    }
  }

  function aiPlannerResponseSchema(Schema) {
    if (!Schema) throw new Error("Firebase AI Schema helper non disponibile.");

    const configProperties = {
      componentType: Schema.string(),
      flowIoMode: Schema.string(),
      flowChartDataType: Schema.string(),
      eventKind: Schema.string(),
      actionKind: Schema.string(),
      stateKind: Schema.string(),
      foreachItemType: Schema.string(),
      mathOperation: Schema.string(),
      mathDataType: Schema.string(),
      logicOperation: Schema.string(),
      compareOperation: Schema.string(),
      compareDataType: Schema.string(),
      adapterInputType: Schema.string(),
      adapterOutputType: Schema.string()
    };

    const configSchema = Schema.object({
      properties: configProperties,
      optionalProperties: Object.keys(configProperties)
    });

    const rowSchema = Schema.object({
      properties: {
        label: Schema.string(),
        kind: Schema.string(),
        dataType: Schema.string(),
        defaultValue: Schema.string()
      },
      optionalProperties: ["defaultValue"]
    });

    const nodeSchema = Schema.object({
      properties: {
        key: Schema.string(),
        type: Schema.string(),
        title: Schema.string(),
        description: Schema.string(),
        pseudo: Schema.string(),
        config: configSchema,
        rows: Schema.array({
          items: rowSchema,
          maxItems: 12
        }),
        column: Schema.number(),
        row: Schema.number()
      },
      optionalProperties: ["config", "rows"]
    });

    const endpointSchema = Schema.object({
      properties: {
        node: Schema.string(),
        port: Schema.string()
      }
    });

    const connectionSchema = Schema.object({
      properties: {
        from: endpointSchema,
        to: endpointSchema,
        dataType: Schema.string()
      }
    });

    return Schema.object({
      properties: {
        summary: Schema.string(),
        groupTitle: Schema.string(),
        nodes: Schema.array({
          items: nodeSchema,
          maxItems: 28
        }),
        connections: Schema.array({
          items: connectionSchema,
          maxItems: 56
        })
      }
    });
  }

  async function aiGetGeminiModel() {
    if (geminiModel) return geminiModel;
    if (geminiModelPromise) return geminiModelPromise;

    geminiModelPromise = (async () => {
      if (!cloudState.configured) {
        throw new Error("Configurazione Firebase mancante.");
      }

      aiBuilderSetStatus("Connessione a Firebase AI Logic…", "loading");
      const ready = await initCloud(true);
      if (!ready || !cloudState.app) {
        throw new Error("Firebase non è disponibile.");
      }

      const base = "https://www.gstatic.com/firebasejs/" + FIREBASE_SDK_VERSION + "/";
      const aiApi = await import(base + "firebase-ai.js");
      const ai = aiApi.getAI(cloudState.app, {
        backend: new aiApi.GoogleAIBackend()
      });

      geminiModel = aiApi.getGenerativeModel(ai, {
        model: GEMINI_MODEL_ID,
        systemInstruction: aiPlannerSystemPrompt(),
        generationConfig: {
          temperature: 0.25,
          topP: 0.9,
          maxOutputTokens: 1800,
          responseMimeType: "application/json",
          responseSchema: aiPlannerResponseSchema(aiApi.Schema)
        }
      });

      aiBuilderSetStatus("Gemini · " + GEMINI_MODEL_ID + " · pronto", "ready");
      return geminiModel;
    })();

    try {
      return await geminiModelPromise;
    } catch (error) {
      geminiModelPromise = null;
      geminiModel = null;
      aiBuilderSetStatus("Gemini non disponibile", "error");
      throw error;
    }
  }


  async function aiGetGeminiBareModel(modelId) {
    if (modelId === GEMINI_MODEL_ID && geminiBareModel) return geminiBareModel;
    if (modelId === GEMINI_COMPAT_MODEL_ID && geminiCompatModel) return geminiCompatModel;

    const ready = await initCloud(true);
    if (!ready || !cloudState.app) throw new Error("Firebase non è disponibile.");

    const base = "https://www.gstatic.com/firebasejs/" + FIREBASE_SDK_VERSION + "/";
    const aiApi = await import(base + "firebase-ai.js");
    const ai = aiApi.getAI(cloudState.app, {
      backend: new aiApi.GoogleAIBackend()
    });
    const model = aiApi.getGenerativeModel(ai, { model: modelId });

    if (modelId === GEMINI_MODEL_ID) geminiBareModel = model;
    if (modelId === GEMINI_COMPAT_MODEL_ID) geminiCompatModel = model;
    return model;
  }

  function aiBarePlannerPrompt(source) {
    return [
      aiPlannerSystemPrompt(),
      "",
      "ProjectFlow catalog and current graph follow as JSON:",
      aiPlannerUserPrompt(source),
      "",
      "Return ONLY the JSON object requested by the instructions above."
    ].join("\n");
  }

  function aiSafeNodeType(type) {
    const supported = new Set(aiPlannerCatalog().map((entry) => entry.type));
    return supported.has(type) && schemaAllowsNodeType(type) ? type : null;
  }

  function aiRowFromSpec(spec) {
    if (!spec || typeof spec !== "object") return null;
    const label = String(spec.label || "value").slice(0, 80);
    const kind = ["input", "output", "variable", "property"].includes(spec.kind) ? spec.kind : "input";
    const dataType = String(spec.dataType || "any").slice(0, 80);
    if (kind === "variable" || kind === "property") {
      const item = variableRow(label, dataType, "private");
      item.kind = kind;
      if (spec.defaultValue !== undefined) item.defaultValue = String(spec.defaultValue).slice(0, 200);
      return item;
    }
    return row(label, dataType, kind);
  }

  function aiApplyNodeConfig(node, spec) {
    const config = spec && spec.config && typeof spec.config === "object" ? spec.config : {};
    const assignString = (key, allowed) => {
      if (typeof config[key] !== "string") return;
      if (allowed && !allowed.includes(config[key])) return;
      node[key] = config[key];
    };

    if (node.type === "flowIO") {
      assignString("flowIoMode", ["input", "output"]);
      assignString("flowChartDataType");
      syncFlowIONode(node);
    }
    if (node.type === "constant") {
      assignString("constantType");
      assignString("constantValue");
    }
    if (node.type === "component") {
      assignString("componentType");
      if (node.componentType) {
        node.title = spec.title || node.componentType;
        node.componentCategory = componentCategoryFor(node.componentType);
      }
    }
    if (node.type === "event") assignString("eventKind");
    if (node.type === "action") assignString("actionKind");
    if (node.type === "state") assignString("stateKind");
    if (node.type === "foreachLoop") assignString("foreachItemType");
    if (node.type === "math") {
      assignString("mathOperation", ["add","subtract","multiply","divide","modulo","power","min","max","clamp","lerp","abs","sqrt"]);
      assignString("mathDataType");
    }
    if (node.type === "logic") assignString("logicOperation", ["and","or","xor","not"]);
    if (node.type === "compare") {
      assignString("compareOperation", ["equal","notEqual","greater","greaterEqual","less","lessEqual"]);
      assignString("compareDataType");
    }
    if (node.type === "adapter") {
      assignString("adapterInputType");
      assignString("adapterOutputType");
    }

    ensureNodeMeta(node);

    const extraRows = Array.isArray(spec.rows) ? spec.rows.slice(0, 12).map(aiRowFromSpec).filter(Boolean) : [];
    if (node.type === "variable" && extraRows.length) {
      node.rows = extraRows.filter((item) => item.kind === "variable" || item.kind === "property");
      if (!node.rows.length) node.rows = [variableRow("value", "any", "private")];
    } else if (["event", "action", "state", "ui"].includes(node.type) && extraRows.length) {
      const signatures = new Set((node.rows || []).map((item) => String(item.kind) + "|" + String(item.label).toLowerCase()));
      extraRows.forEach((item) => {
        const signature = String(item.kind) + "|" + String(item.label).toLowerCase();
        if (!signatures.has(signature)) {
          node.rows.push(item);
          signatures.add(signature);
        }
      });
    }
    ensureNodeMeta(node);
  }

  function aiPortCandidates(node, side) {
    if (!node) return [];
    ensureNodeMeta(node);
    const candidates = [];
    (node.rows || []).forEach((item) => {
      const canIn = ["input","flowIn","variable","property","unityEvent","condition"].includes(item.kind);
      const canOut = ["output","flowOut","variable","property","unityEvent","component","condition"].includes(item.kind);
      if ((side === "in" && canIn) || (side === "out" && canOut)) {
        candidates.push({
          row: item,
          label: String(item.label || "").trim(),
          type: side === "in" ? memberInputType(item) : memberOutputType(item)
        });
      }
    });
    return candidates;
  }

  function aiResolvePort(node, label, side) {
    const wanted = String(label || "").trim().toLowerCase();
    const ports = aiPortCandidates(node, side);
    if (!ports.length) return null;
    let match = ports.find((entry) => entry.label.toLowerCase() === wanted);
    if (!match) match = ports.find((entry) => entry.label.toLowerCase().includes(wanted) || wanted.includes(entry.label.toLowerCase()));
    if (!match && ports.length === 1) match = ports[0];
    return match || null;
  }

  function aiValidatePlan(rawPlan) {
    if (!rawPlan || typeof rawPlan !== "object") throw new Error("Piano AI non valido.");
    const rawNodes = Array.isArray(rawPlan.nodes) ? rawPlan.nodes.slice(0, 28) : [];
    if (!rawNodes.length) throw new Error("Il piano AI non contiene blocchi.");

    const seen = new Set();
    const nodes = [];
    rawNodes.forEach((spec, index) => {
      if (!spec || typeof spec !== "object") return;
      const type = aiSafeNodeType(String(spec.type || ""));
      if (!type) return;
      let key = String(spec.key || ("node" + (index + 1))).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
      if (!key) key = "node" + (index + 1);
      while (seen.has(key)) key += "_" + (index + 1);
      seen.add(key);
      nodes.push(Object.assign({}, spec, { key: key, type: type }));
    });
    if (!nodes.length) throw new Error("Il modello ha proposto solo tipi di blocco non supportati.");

    const validKeys = new Set(nodes.map((node) => node.key));
    const connections = (Array.isArray(rawPlan.connections) ? rawPlan.connections : [])
      .slice(0, 56)
      .filter((edge) => edge && edge.from && edge.to &&
        validKeys.has(String(edge.from.node || "")) &&
        validKeys.has(String(edge.to.node || "")) &&
        edge.from.port && edge.to.port)
      .map((edge) => ({
        from: { node: String(edge.from.node), port: String(edge.from.port) },
        to: { node: String(edge.to.node), port: String(edge.to.port) },
        dataType: String(edge.dataType || "any")
      }));

    return {
      summary: String(rawPlan.summary || "Graph generato dal modello locale.").slice(0, 500),
      groupTitle: String(rawPlan.groupTitle || "AI · Generated Graph").slice(0, 100),
      nodes: nodes,
      connections: connections
    };
  }

  function aiApplyGeneratedPlan(plan) {
    const snapshot = cloneProjectData(project);
    const center = viewportCenterWorld();
    const byKey = new Map();
    const created = [];

    try {

    plan.nodes.forEach((spec, index) => {
      const column = Math.max(0, Math.min(8, Number.isFinite(Number(spec.column)) ? Number(spec.column) : index % 4));
      const rowIndex = Math.max(0, Math.min(8, Number.isFinite(Number(spec.row)) ? Number(spec.row) : Math.floor(index / 4)));
      const x = Math.round(center.x - 720 + column * 430);
      const y = Math.round(center.y - 280 + rowIndex * 290);
      const component = spec.type === "component" && spec.config ? spec.config.componentType : undefined;
      const node = defaultNode(spec.type, x, y, component, spec.config || {});
      node.title = String(spec.title || node.title || typeMeta(spec.type).label).slice(0, 100);
      node.description = String(spec.description || "").slice(0, 500);
      node.pseudo = String(spec.pseudo || "").slice(0, 500);
      aiApplyNodeConfig(node, spec);
      project.nodes.push(node);
      byKey.set(spec.key, node);
      created.push(node);
    });

    let connected = 0;
    const skipped = [];
    plan.connections.forEach((edge, index) => {
      const fromNode = byKey.get(edge.from.node);
      const toNode = byKey.get(edge.to.node);
      const fromPort = aiResolvePort(fromNode, edge.from.port, "out");
      const toPort = aiResolvePort(toNode, edge.to.port, "in");
      if (!fromNode || !toNode || !fromPort || !toPort) {
        skipped.push(index);
        return;
      }
      const inferredType = fromPort.type || edge.dataType || "any";
      const requestedType = edge.dataType === "__flow__" ? "__flow__" : (edge.dataType || inferredType || "any");
      if (requestedType !== "__flow__" &&
          fromPort.type && toPort.type &&
          !sameType(fromPort.type, toPort.type) &&
          !sameType(requestedType, toPort.type)) {
        skipped.push(index);
        return;
      }
      aiConnect(fromNode, fromPort.row, toNode, toPort.row, requestedType);
      connected += 1;
    });

    if (!Array.isArray(project.groups)) project.groups = [];
    const group = {
      id: uid("group"),
      title: plan.groupTitle || "AI · Generated Graph",
      nodeIds: created.map((node) => node.id)
    };
    project.groups.push(group);

    selectedNodeIds = new Set(group.nodeIds);
    syncPrimarySelection();
    selectedGroupId = group.id;
    selectedEdgeId = null;
    selectedTypeRelationId = null;
    selectedJunctionIds.clear();

    render();
    markDirty();
    flushHistoryCheckpoint();
    broadcastActivity("AI genera " + group.title);

      return {
        nodes: created.length,
        connections: connected,
        skippedConnections: skipped.length,
        message: plan.summary + " · " + created.length + " blocchi, " + connected + " connessioni" +
          (skipped.length ? " · " + skipped.length + " connessioni scartate dal validator" : "")
      };
    } catch (error) {
      const restored = normalizeProject(snapshot);
      if (project === rootProject) {
        setProjectDocument(restored);
      } else {
        Object.keys(project).forEach((key) => delete project[key]);
        Object.assign(project, restored);
      }
      resetEditorSelection();
      render();
      throw error;
    }
  }

  async function aiExecuteBuilderPrompt(prompt) {
    const source = aiNormalizePrompt(prompt);
    if (!source) return null;

    const applyGeminiResult = (result) => {
      const content = result && result.response ? result.response.text() : "";
      const plan = aiValidatePlan(aiExtractJson(content));
      return aiApplyGeneratedPlan(plan);
    };

    const isInvalidArgument = (error) => {
      const code = String(error && error.code || "");
      const message = String(error && error.message || error || "");
      return code === "AI/fetch-error" &&
        (/\b400\b/.test(message) || /invalid argument/i.test(message));
    };

    const model = await aiGetGeminiModel();
    aiBuilderSetStatus("Gemini · sto progettando il graph…", "loading");

    try {
      const result = await model.generateContent(aiPlannerUserPrompt(source));
      const applied = applyGeminiResult(result);
      aiBuilderSetStatus("Gemini · " + GEMINI_MODEL_ID + " · pronto", "ready");
      return applied;
    } catch (error) {
      if (!isInvalidArgument(error)) {
        geminiModel = null;
        geminiModelPromise = null;
        geminiRelaxedModel = null;
        geminiBareModel = null;
        geminiCompatModel = null;
        aiBuilderSetStatus("Gemini · richiesta fallita", "error");
        throw error;
      }

      // Compatibility pass 1: same model, absolutely minimal Firebase request.
      try {
        aiBuilderSetStatus("Gemini · modalità compatibilità…", "loading");
        const bare = await aiGetGeminiBareModel(GEMINI_MODEL_ID);
        const bareResult = await bare.generateContent(aiBarePlannerPrompt(source));
        const applied = applyGeminiResult(bareResult);
        aiBuilderSetStatus("Gemini · " + GEMINI_MODEL_ID + " · compatibilità", "ready");
        return applied;
      } catch (bareError) {
        if (!isInvalidArgument(bareError)) {
          geminiBareModel = null;
          throw bareError;
        }

        // Compatibility pass 2: older stable Gemini, still no special request options.
        try {
          aiBuilderSetStatus("Gemini · fallback modello stabile…", "loading");
          const compat = await aiGetGeminiBareModel(GEMINI_COMPAT_MODEL_ID);
          const compatResult = await compat.generateContent(aiBarePlannerPrompt(source));
          const applied = applyGeminiResult(compatResult);
          aiBuilderSetStatus("Gemini · " + GEMINI_COMPAT_MODEL_ID + " · pronto", "ready");
          return applied;
        } catch (compatError) {
          geminiModel = null;
          geminiModelPromise = null;
          geminiRelaxedModel = null;
          geminiBareModel = null;
          geminiCompatModel = null;
          aiBuilderSetStatus("Gemini · richiesta fallita", "error");
          throw compatError;
        }
      }
    }
  }

  function aiFriendlyFirebaseError(error) {
    const code = error && error.code ? String(error.code) : "";
    const message = String(error && error.message ? error.message : error || "");
    const lower = message.toLowerCase();

    if (code === "AI/api-not-enabled" || lower.includes("firebasevertexai.googleapis.com") && lower.includes("enable")) {
      aiBuilderSetStatus("Firebase AI Logic · attivazione non ancora propagata", "error");
      return (
        "Firebase AI Logic risulta ancora non attivo alla richiesta. Se hai appena premuto Get started, attendi qualche minuto e riprova. " +
        "Nel progetto devono essere abilitate sia Firebase AI Logic API (firebasevertexai.googleapis.com) sia Gemini Developer API (generativelanguage.googleapis.com)."
      );
    }
    if (lower.includes("firebasevertexai.googleapis.com") && (lower.includes("blocked") || lower.includes("forbidden") || lower.includes("permission"))) {
      aiBuilderSetStatus("Firebase AI Logic · API key bloccata", "error");
      return (
        "La Firebase API key sta bloccando Firebase AI Logic. In Google Cloud → API e servizi → Credenziali, apri la chiave usata dalla web app " +
        "e assicurati che Firebase AI Logic API sia inclusa nelle API consentite."
      );
    }
    if (code.includes("app-check") || /app check/i.test(message)) {
      aiBuilderSetStatus("Firebase App Check richiede configurazione", "error");
      return (
        "Firebase AI Logic è attivo, ma App Check sta bloccando la richiesta. " +
        "Configura App Check per la web app ProjectFlow nella Firebase Console e poi riprova."
      );
    }
    if (lower.includes("quota") || lower.includes("resource_exhausted") || code.includes("quota")) {
      aiBuilderSetStatus("Gemini · quota temporaneamente esaurita", "error");
      return "La quota Gemini disponibile per questo progetto è temporaneamente esaurita. Riprova più tardi o controlla le quote Firebase AI Logic.";
    }
    if (lower.includes("model") && (lower.includes("not found") || lower.includes("unsupported"))) {
      aiBuilderSetStatus("Gemini · modello non disponibile", "error");
      return "Il modello " + GEMINI_MODEL_ID + " non risulta disponibile per questo progetto/provider.";
    }

    aiBuilderSetStatus("Gemini · errore " + (code || "sconosciuto"), "error");
    return "Gemini via Firebase AI Logic non è disponibile" + (code ? " (" + code + ")" : "") + ": " + message;
  }

  async function submitAiBuilderPrompt() {
    const input = $("aiBuilderPrompt");
    const button = $("aiBuilderSend");
    if (!input) return;
    const prompt = input.value.trim();
    if (!prompt) return;

    aiBuilderAddMessage("user", prompt);
    input.value = "";
    if (button) button.disabled = true;

    try {
      const result = await aiExecuteBuilderPrompt(prompt);
      aiBuilderAddMessage("assistant", result && result.message
        ? result.message
        : "Non sono riuscito a trasformare questa richiesta in un graph.");
      if (result && result.nodes) {
        showToast("AI Builder · " + result.nodes + " blocchi creati");
      }
    } catch (error) {
      console.error("ProjectFlow AI Builder:", error);
      aiBuilderAddMessage("assistant", aiFriendlyFirebaseError(error));
      showToast("AI Builder · Gemini non disponibile");
    } finally {
      if (button) button.disabled = false;
      requestAnimationFrame(() => input.focus());
    }
  }

  function addNode(type, presetComponent, preset) {
    if (!schemaAllowsNodeType(type)) {
      showToast((TYPE_META[type] || TYPE_META.object).label + " non è disponibile nello schema " + projectSchemaMeta(currentSchemaId()).label + ".");
      return;
    }
    const center = viewportCenterWorld();
    const offset = project.nodes.length % 5 * 18;
    const node = defaultNode(type, center.x - nodeWidthFor(type) / 2 + offset, center.y - 100 + offset, presetComponent, preset);
    project.nodes.push(node);
    selectedNodeIds = new Set([node.id]);
    syncPrimarySelection();
    selectedEdgeId = null;
    selectedTypeRelationId = null;
    selectedGroupId = null;
    selectedJunctionIds.clear();
    render();
    markDirty();
    broadcastActivity("Aggiunge " + ((TYPE_META[type] || TYPE_META.object).label));
    showToast((TYPE_META[type] || TYPE_META.object).label + " aggiunto");
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
    const groupBounds = (project.groups || []).map(groupWorldBounds).filter(Boolean);
    const minX = Math.min.apply(null, project.nodes.map((node) => node.x).concat(groupBounds.map((bounds) => bounds.x)));
    const minY = Math.min.apply(null, project.nodes.map((node) => node.y).concat(groupBounds.map((bounds) => bounds.y)));
    const maxX = Math.max.apply(null, project.nodes.map((node) => node.x + nodeWidthFor(node)).concat(groupBounds.map((bounds) => bounds.x + bounds.width)));
    const maxY = Math.max.apply(null, project.nodes.map((node) => {
      const element = nodeLayer.querySelector('[data-node-id="' + node.id + '"]');
      return node.y + (element ? element.offsetHeight : 260);
    }).concat(groupBounds.map((bounds) => bounds.y + bounds.height)));
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
    const documentProject = rootProject || project;
    const blob = new Blob([JSON.stringify(documentProject, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (documentProject.name || "projectflow").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
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
        setProjectDocument(imported);
        selectedNodeIds.clear();
        selectedNodeId = null;
        selectedEdgeId = null;
        pendingPort = null;
        $("projectName").value = project.name;
        saveProject(false);
        render();
        fitView();
        commitHistoryCheckpoint();
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
    node.rows.push(variableRow(
      node.type === "struct" || node.type === "jobStruct" ? "newField" : "newVariable",
      "int",
      node.type === "struct" || node.type === "jobStruct" ? "public" : "private"
    ));
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

  $("addObjectTop").addEventListener("click", (event) => {
    event.stopPropagation();
    const palette = $("newBlockPalette");
    if (palette.classList.contains("open")) closeNewBlockPalette();
    else openNewBlockPalette();
  });
  $("closeNewBlockPalette").addEventListener("click", closeNewBlockPalette);
  $("newBlockPalette").addEventListener("click", (event) => event.stopPropagation());
  $("newBlockFan").addEventListener("click", (event) => event.stopPropagation());
  $("newBlockSearch").addEventListener("input", (event) => renderNewBlockPalette(event.target.value));
  $("newBlockSearch").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeNewBlockPalette();
      return;
    }
    if (event.key === "Enter") {
      const results = $("newBlockResults");
      const firstResult = results.querySelector(".new-block-result");
      const firstCategory = results.querySelector(".new-block-category");
      const target = firstResult || firstCategory;
      if (target) {
        event.preventDefault();
        target.click();
      }
    }
  });

  $("createGroup").addEventListener("click", toggleGrouping);
  $("forceConnectionsView").addEventListener("click", toggleForcedConnections);
  $("aiBuilderButton").addEventListener("click", (event) => {
    event.stopPropagation();
    openAiBuilderPanel();
  });
  $("closeAiBuilder").addEventListener("click", closeAiBuilderPanel);
  $("aiBuilderPanel").addEventListener("click", (event) => event.stopPropagation());
  $("aiBuilderForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submitAiBuilderPrompt();
  });
  $("aiBuilderPrompt").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitAiBuilderPrompt();
    }
  });
  document.querySelectorAll("[data-ai-example]").forEach((button) => {
    button.addEventListener("click", () => {
      $("aiBuilderPrompt").value = button.dataset.aiExample || "";
      submitAiBuilderPrompt();
    });
  });
  $("shareProjectButton").addEventListener("click", openSharePanel);
  $("shareLoginButton").addEventListener("click", startGoogleLogin);
  $("closeSharePanel").addEventListener("click", () => closeInterfaceSurfaces());
  $("shareInviteButton").addEventListener("click", () => {
    const input = $("shareEmailInput");
    inviteCollaborator(input.value).then(() => { input.value = ""; });
  });
  $("shareEmailInput").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    $("shareInviteButton").click();
  });
  $("copyShareLink").addEventListener("click", copyCurrentShareLink);

  $("noteTool").addEventListener("click", () => addNode("note"));
  $("sketchTool").addEventListener("click", () => addNode("sketch"));

  $("undoAction").addEventListener("click", undoProjectChange);
  $("redoAction").addEventListener("click", redoProjectChange);
  $("fitView").addEventListener("click", fitView);
  $("zoomIn").addEventListener("click", () => setZoom(view.scale + 0.1));
  $("zoomOut").addEventListener("click", () => setZoom(view.scale - 0.1));
  $("zoomReadout").addEventListener("click", () => setZoom(1));
  $("minimapSvg").addEventListener("pointerdown", startMinimapNavigation);
  $("minimapResizeHandle").addEventListener("pointerdown", startMinimapResize);
  applyMinimapSize(false);

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

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#newBlockPalette") &&
        !event.target.closest("#newBlockFan") &&
        !event.target.closest("#addObjectTop")) closeNewBlockPalette();
    if (!event.target.closest("#accountMenu") && !event.target.closest("#homeAuthButton") && !event.target.closest("#editorAuthButton")) {
      closeAccountMenu();
    }

    if (!event.target.closest(".section-add-wrap")) {
      document.querySelectorAll(".section-add-popup.open").forEach((openPopup) => {
        openPopup.classList.remove("open");
        if (typeof openPopup._resetFanPopup === "function") openPopup._resetFanPopup();
      });
    }

    if (!event.target.closest(".type-picker")) {
      document.querySelectorAll(".type-picker-popup.open").forEach((openPopup) => {
        openPopup.classList.remove("open");
        if (typeof openPopup._resetTypePicker === "function") openPopup._resetTypePicker();
      });
    }
  });

  $("exportProject").addEventListener("click", () => {
    closeAccountMenu();
    exportProject();
  });

  $("importProject").addEventListener("click", () => {
    closeAccountMenu();
    $("importFile").click();
  });

  $("importFile").addEventListener("change", (event) => {
    importProjectFile(event.target.files[0]);
    event.target.value = "";
  });

  $("resetProject").addEventListener("click", () => {
    closeAccountMenu();
    if (!confirm("Caricare l'Inventory Demo? Il progetto corrente verrà sostituito.")) return;
    setProjectDocument(sampleProject());
    $("projectName").value = rootProject.name;
    selectedNodeIds.clear();
    selectedNodeId = null;
    selectedEdgeId = null;
    selectedJunctionIds.clear();
    selectedGroupId = null;
    pendingPort = null;
    saveProject(false);
    render();
    fitView();
    commitHistoryCheckpoint();
    showToast("Inventory Demo caricata");
  });

  $("projectName").addEventListener("input", () => {
    if (!canRenameCurrentProject()) {
      $("projectName").value = project.name || "Untitled Flow";
      showToast("Solo il proprietario può rinominare il progetto");
      return;
    }
    project.name = $("projectName").value;
    markDirty();
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!cloudState.sharedProjectId || !cloudState.user) return;
    presencePointerClient = { x: event.clientX, y: event.clientY };
    if (presencePointerFrame) return;
    presencePointerFrame = requestAnimationFrame(() => {
      presencePointerFrame = null;
      if (!presencePointerClient) return;
      const point = screenToWorld(presencePointerClient.x, presencePointerClient.y);
      presencePointerClient = null;
      cloudState.presenceCursor = {
        x: Math.round(point.x),
        y: Math.round(point.y)
      };
      queuePresenceWrite(false, true);
    });
  });

  viewport.addEventListener("pointerleave", () => {
    if (!cloudState.sharedProjectId) return;
    cloudState.presenceCursor = null;
    queuePresenceWrite(false);
  });

  viewport.addEventListener("wheel", (event) => {
    const localScroller = event.target.closest(
      ".section-member-list.scrollable, .section-add-popup.open, .type-picker-popup.open, .method-parameter-list"
    );

    if (localScroller) {
      const canScroll = localScroller.scrollHeight > localScroller.clientHeight + 1;
      if (canScroll) {
        event.stopPropagation();
        return;
      }
    }

    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const step = event.shiftKey ? 0.1 : 0.05;
    setZoom(view.scale + direction * step, event.clientX, event.clientY);
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

    const nextJunctions = state.additive ? new Set(selectedJunctionIds) : new Set();
    project.connections.forEach((edge) => {
      if (!Array.isArray(edge.points)) return;
      edge.points.forEach((point) => {
        if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
          nextJunctions.add(junctionSelectionKey(edge.id, point.id));
        }
      });
    });

    selectedNodeIds = next;
    selectedJunctionIds = nextJunctions;
    selectedGroupId = null;
    syncPrimarySelection();
    selectedEdgeId = null;
    selectedTypeRelationId = null;
    renderNodes();
    renderEdges();
    renderInspector();
    renderMinimap();
  }

  function startPanelResize(event) {
    if (window.innerWidth <= 850) return;
    event.preventDefault();
    event.stopPropagation();
    panelResizeState = {
      startX: event.clientX,
      startWidth: panelWidths.inspector
    };
    document.body.classList.add("resizing-panel");
    window.addEventListener("pointermove", movePanelResize);
    window.addEventListener("pointerup", endPanelResize, { once: true });
  }

  function movePanelResize(event) {
    if (!panelResizeState) return;
    const delta = event.clientX - panelResizeState.startX;
    panelWidths.inspector = Math.max(300, Math.min(620, panelResizeState.startWidth - delta));
    setPanelWidths();
  }

  function endPanelResize() {
    window.removeEventListener("pointermove", movePanelResize);
    panelResizeState = null;
    document.body.classList.remove("resizing-panel");
    setPanelWidths();
  }

  $("inspectorResizer").addEventListener("pointerdown", startPanelResize);

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
    if ($("editorView") && $("editorView").classList.contains("hidden")) return;
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    if (event.key === "Escape") {
      if ($("newBlockPalette") && $("newBlockPalette").classList.contains("open")) {
        closeNewBlockPalette();
        return;
      }
      if ($("sharePanel") && $("sharePanel").classList.contains("open")) {
        closeInterfaceSurfaces();
        return;
      }
      if ($("aiBuilderDock") && $("aiBuilderDock").classList.contains("open")) {
        closeAiBuilderPanel();
        return;
      }
      if (leaveNestedGraph()) {
        event.preventDefault();
        return;
      }
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
      selectedTypeRelationId = null;
      selectedJunctionIds.clear();
      selectedGroupId = null;
      renderNodes();
      renderEdges();
      renderInspector();
      renderMinimap();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !typing) {
      event.preventDefault();
      if (event.shiftKey) redoProjectChange();
      else undoProjectChange();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y" && !typing) {
      event.preventDefault();
      redoProjectChange();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g" && !typing) {
      event.preventDefault();
      toggleGrouping();
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
    const shortcuts = currentSchemaId() === "classic"
      ? {
          s: "flowStart",
          p: "flowProcess",
          i: "flowIO",
          z: "flowEnd",
          f: "function",
          v: "variable",
          n: "note",
          x: "emptyGraph"
        }
      : {
          o: "object",
          c: "class",
          f: "function",
          v: "variable",
          d: "condition",
          u: "ui",
          n: "note",
          e: "event",
          a: "action",
          s: "state",
          m: "enum",
          x: "emptyGraph"
        };
    const type = shortcuts[event.key.toLowerCase()];
    if (type) addNode(type);
  });

  $("backToProjects").addEventListener("click", () => {
    saveProject(false);

    if (graphWorkspaceStack.length) {
      leaveNestedGraph();
      return;
    }

    showProjectHome("projects");
  });

  document.querySelectorAll("[data-site-page-target]").forEach((control) => {
    control.addEventListener("click", () => {
      navigateSitePage(control.dataset.sitePageTarget);
    });
  });

  window.addEventListener("hashchange", () => {
    if (!$("projectHome") || $("projectHome").classList.contains("hidden")) return;
    navigateSitePage(window.location.hash.replace(/^#/, ""), {
      updateHash: false,
      scroll: true
    });
  });

  $("openDemoHome").addEventListener("click", openDemoProject);
  $("openDemoGuide").addEventListener("click", openDemoProject);
  $("openDemoGuideBottom").addEventListener("click", openDemoProject);

  $("createProjectHome").addEventListener("click", createProjectFromHome);
  $("createProjectProjects").addEventListener("click", createProjectFromHome);
  $("createProjectEmpty").addEventListener("click", createProjectFromHome);

  $("createProjectForm").addEventListener("submit", (event) => {
    event.preventDefault();
    createProjectFromDialog();
  });
  $("createProjectCancel").addEventListener("click", closeCreateProjectDialog);
  $("createProjectCancelFooter").addEventListener("click", closeCreateProjectDialog);
  $("createProjectSchema").addEventListener("change", updateCreateProjectSchemaPreview);
  $("createProjectDialog").addEventListener("mousedown", (event) => {
    if (event.target === $("createProjectDialog")) closeCreateProjectDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("createProjectDialog").classList.contains("show")) {
      event.preventDefault();
      closeCreateProjectDialog();
    }
  });

  $("uploadProjectHome").addEventListener("click", () => $("homeUploadFile").click());
  $("uploadProjectProjects").addEventListener("click", () => $("homeUploadFile").click());
  $("homeUploadFile").addEventListener("change", (event) => {
    importLibraryFile(event.target.files[0]);
    event.target.value = "";
  });

  $("projectLibrarySearch").addEventListener("input", renderProjectLibrary);
  $("homeAuthButton").addEventListener("click", (event) => {
    event.stopPropagation();
    handleAccountButton($("homeAuthButton"));
  });
  $("editorAuthButton").addEventListener("click", (event) => {
    event.stopPropagation();
    handleAccountButton($("editorAuthButton"));
  });
  $("accountLogout").addEventListener("click", logoutGoogleAuth);
  $("accountSyncNow").addEventListener("click", async () => {
    if (!cloudState.user) return;
    $("accountSyncNow").disabled = true;
    await mergeCloudLibrary();
    $("accountSyncNow").disabled = false;
    updateAccountUI();
    showToast("Sincronizzazione completata");
  });
  $("accountPrivacy").addEventListener("click", () => {
    closeAccountMenu();
    if ($("editorView") && !$("editorView").classList.contains("hidden")) {
      saveProject(false);
      showProjectHome("privacy");
    } else {
      navigateSitePage("privacy");
    }
  });

  window.addEventListener("resize", () => {
    closeNewBlockFan();
    closeInterfaceSurfaces();
    reconcileWorkspacePanels();
    renderEdges();
    renderMinimap();
  });

  window.addEventListener("beforeunload", () => {
    clearTimeout(viewSaveTimer);
    localStorage.setItem(VIEW_KEY, JSON.stringify(view));
    if (currentProjectId) saveProject(false);
    stopSharedProjectSession();
  });

  setInspectorVisible(false);
  updateConnectionVisibilityControl();
  renderProjectLibrary();
  updateAccountUI();
  if (sharedProjectIdFromLocation()) initCloud(true);
  else initCloud();
  render();
  renderSharePanel();
  showProjectHome();
})();