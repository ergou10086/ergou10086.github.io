import {
  parse
} from "./chunk-6GPO2DTZ.mjs";
import "./chunk-2WV7RJYK.mjs";
import "./chunk-5H5NAWTY.mjs";
import "./chunk-SRUNA2I5.mjs";
import "./chunk-2FCTELGL.mjs";
import "./chunk-BZ4PQW6L.mjs";
import "./chunk-N6MTY76Y.mjs";
import "./chunk-IGSNJQD5.mjs";
import "./chunk-6WQHHANH.mjs";
import "./chunk-FT2GS4ES.mjs";
import "./chunk-TB6STKVJ.mjs";
import "./chunk-RXMY7EUA.mjs";
import "./chunk-4QNPMWDU.mjs";
import "./chunk-FWUIELN6.mjs";
import "./chunk-TZ7DUYEA.mjs";
import "./chunk-E5HCKRCG.mjs";
import "./chunk-EGU2BUMN.mjs";
import {
  selectSvgElement
} from "./chunk-DCGTWG2P.mjs";
import {
  configureSvgSize
} from "./chunk-OMSUSS74.mjs";
import {
  log
} from "./chunk-2RP5QIEU.mjs";
import {
  __name
} from "./chunk-42YUCIBL.mjs";

// src/diagrams/info/infoParser.ts
var parser = {
  parse: /* @__PURE__ */ __name(async (input) => {
    const ast = await parse("info", input);
    log.debug(ast);
  }, "parse")
};

// src/diagrams/info/infoDb.ts
var DEFAULT_INFO_DB = {
  version: "12.3.0" + (true ? "" : "-tiny")
};
var getVersion = /* @__PURE__ */ __name(() => DEFAULT_INFO_DB.version, "getVersion");
var db = {
  getVersion
};

// src/diagrams/info/infoRenderer.ts
var draw = /* @__PURE__ */ __name((text, id, version) => {
  log.debug("rendering info diagram\n" + text);
  const svg = selectSvgElement(id);
  configureSvgSize(svg, 100, 400, true);
  const group = svg.append("g");
  group.append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${version}`);
}, "draw");
var renderer = { draw };

// src/diagrams/info/infoDiagram.ts
var diagram = {
  parser,
  db,
  renderer
};
export {
  diagram
};
