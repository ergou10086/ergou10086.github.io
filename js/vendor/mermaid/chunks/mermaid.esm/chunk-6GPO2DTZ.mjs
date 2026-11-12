import {
  __name as __name2
} from "./chunk-EGU2BUMN.mjs";
import {
  __name
} from "./chunk-42YUCIBL.mjs";

// ../parser/dist/mermaid-parser.core.mjs
var parsers = {};
var initializers = {
  info: /* @__PURE__ */ __name2(async () => {
    const { createInfoServices: createInfoServices2 } = await import("./info-5BNCTR6C-7QCBR4J4.mjs");
    const parser = createInfoServices2().Info.parser.LangiumParser;
    parsers.info = parser;
  }, "info"),
  packet: /* @__PURE__ */ __name2(async () => {
    const { createPacketServices: createPacketServices2 } = await import("./packet-FDJJNMMN-54A5SFJN.mjs");
    const parser = createPacketServices2().Packet.parser.LangiumParser;
    parsers.packet = parser;
  }, "packet"),
  pie: /* @__PURE__ */ __name2(async () => {
    const { createPieServices: createPieServices2 } = await import("./pie-BMGGJ4DP-A7RGNFP6.mjs");
    const parser = createPieServices2().Pie.parser.LangiumParser;
    parsers.pie = parser;
  }, "pie"),
  treeView: /* @__PURE__ */ __name2(async () => {
    const { createTreeViewServices: createTreeViewServices2 } = await import("./treeView-OWB7PY5U-C2AXSKLA.mjs");
    const parser = createTreeViewServices2().TreeView.parser.LangiumParser;
    parsers.treeView = parser;
  }, "treeView"),
  architecture: /* @__PURE__ */ __name2(async () => {
    const { createArchitectureServices: createArchitectureServices2 } = await import("./architecture-LC7QOZUM-TNXEJX5V.mjs");
    const parser = createArchitectureServices2().Architecture.parser.LangiumParser;
    parsers.architecture = parser;
  }, "architecture"),
  gitGraph: /* @__PURE__ */ __name2(async () => {
    const { createGitGraphServices: createGitGraphServices2 } = await import("./gitGraph-S4SDYQ5E-FQZAANP3.mjs");
    const parser = createGitGraphServices2().GitGraph.parser.LangiumParser;
    parsers.gitGraph = parser;
  }, "gitGraph"),
  eventmodeling: /* @__PURE__ */ __name2(async () => {
    const { createEventModelingServices: createEventModelingServices2 } = await import("./eventmodeling-QR7CT3BE-XZ27I2MB.mjs");
    const parser = createEventModelingServices2().EventModel.parser.LangiumParser;
    parsers.eventmodeling = parser;
  }, "eventmodeling"),
  radar: /* @__PURE__ */ __name2(async () => {
    const { createRadarServices: createRadarServices2 } = await import("./radar-4MYH26CV-IW4QM5CU.mjs");
    const parser = createRadarServices2().Radar.parser.LangiumParser;
    parsers.radar = parser;
  }, "radar"),
  railroad: /* @__PURE__ */ __name2(async () => {
    const { createRailroadServices: createRailroadServices2 } = await import("./railroad-UC74YYTJ-DLPIJMWF.mjs");
    const parser = createRailroadServices2().Railroad.parser.LangiumParser;
    parsers.railroad = parser;
  }, "railroad"),
  railroadEbnf: /* @__PURE__ */ __name2(async () => {
    const { createRailroadEbnfServices: createRailroadEbnfServices2 } = await import("./railroad-ebnf-WVTJNEEQ-WATDX3CZ.mjs");
    const parser = createRailroadEbnfServices2().RailroadEbnf.parser.LangiumParser;
    parsers.railroadEbnf = parser;
  }, "railroadEbnf"),
  railroadAbnf: /* @__PURE__ */ __name2(async () => {
    const { createRailroadAbnfServices: createRailroadAbnfServices2 } = await import("./railroad-abnf-63ZTAFXO-SISHGAXA.mjs");
    const parser = createRailroadAbnfServices2().RailroadAbnf.parser.LangiumParser;
    parsers.railroadAbnf = parser;
  }, "railroadAbnf"),
  railroadPeg: /* @__PURE__ */ __name2(async () => {
    const { createRailroadPegServices: createRailroadPegServices2 } = await import("./railroad-peg-W4VBZIEU-BX62DKHI.mjs");
    const parser = createRailroadPegServices2().RailroadPeg.parser.LangiumParser;
    parsers.railroadPeg = parser;
  }, "railroadPeg"),
  treemap: /* @__PURE__ */ __name2(async () => {
    const { createTreemapServices: createTreemapServices2 } = await import("./treemap-B4MHVWJL-JEPGK2Q7.mjs");
    const parser = createTreemapServices2().Treemap.parser.LangiumParser;
    parsers.treemap = parser;
  }, "treemap"),
  wardley: /* @__PURE__ */ __name2(async () => {
    const { createWardleyServices: createWardleyServices2 } = await import("./wardley-ZOP5H4X3-IGLOND33.mjs");
    const parser = createWardleyServices2().Wardley.parser.LangiumParser;
    parsers.wardley = parser;
  }, "wardley"),
  cynefin: /* @__PURE__ */ __name2(async () => {
    const { createCynefinServices: createCynefinServices2 } = await import("./cynefin-SQZ4V6AE-JRBRXATP.mjs");
    const parser = createCynefinServices2().Cynefin.parser.LangiumParser;
    parsers.cynefin = parser;
  }, "cynefin")
};
async function parse(diagramType, text) {
  const initializer = initializers[diagramType];
  if (!initializer) {
    throw new Error(`Unknown diagram type: ${diagramType}`);
  }
  if (!parsers[diagramType]) {
    await initializer();
  }
  const parser = parsers[diagramType];
  const result = parser.parse(text);
  if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
    throw new MermaidParseError(result);
  }
  return result.value;
}
__name(parse, "parse");
__name2(parse, "parse");
var formatLocation = /* @__PURE__ */ __name2((value) => value !== void 0 && value >= 0 ? value : "?", "formatLocation");
var MermaidParseError = class extends Error {
  static {
    __name(this, "MermaidParseError");
  }
  constructor(result) {
    const lexerErrors = result.lexerErrors.map((err) => {
      const line = formatLocation(err.line);
      const column = formatLocation(err.column);
      return `Lexer error on line ${line}, column ${column}: ${err.message}`;
    }).join("\n");
    const parserErrors = result.parserErrors.map((err) => {
      const line = formatLocation(err.token.startLine);
      const column = formatLocation(err.token.startColumn);
      return `Parse error on line ${line}, column ${column}: ${err.message}`;
    }).join("\n");
    super(`Parsing failed: ${lexerErrors} ${parserErrors}`);
    this.result = result;
  }
  static {
    __name2(this, "MermaidParseError");
  }
};

export {
  parse,
  MermaidParseError
};
