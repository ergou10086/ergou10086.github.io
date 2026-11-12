import {
  getConfig2 as getConfig
} from "./chunk-OMSUSS74.mjs";
import {
  select_default
} from "./chunk-2RP5QIEU.mjs";
import {
  __name
} from "./chunk-42YUCIBL.mjs";

// src/rendering-util/selectSvgElement.ts
var selectSvgElement = /* @__PURE__ */ __name((id) => {
  const { securityLevel } = getConfig();
  let root = select_default("body");
  if (securityLevel === "sandbox") {
    const sandboxElement = select_default(`#i${id}`);
    const doc = sandboxElement.node()?.contentDocument ?? document;
    root = select_default(doc.body);
  }
  const svg = root.select(`#${id}`);
  return svg;
}, "selectSvgElement");

export {
  selectSvgElement
};
