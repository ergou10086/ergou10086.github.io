import {
  createFlowDiagram,
  styles_default
} from "./chunk-ROCK7MPB.mjs";
import "./chunk-SABO3QHY.mjs";
import "./chunk-VZ55BDUP.mjs";
import "./chunk-6GVICLKL.mjs";
import "./chunk-5KIEVVVU.mjs";
import "./chunk-BNYFOFJ6.mjs";
import "./chunk-KUV5H3GH.mjs";
import "./chunk-I4NTJHXF.mjs";
import "./chunk-DJJ2HIRT.mjs";
import "./chunk-NBCTWQX4.mjs";
import "./chunk-YWW7ENDJ.mjs";
import "./chunk-KCEAOOXO.mjs";
import "./chunk-46A7OBX7.mjs";
import "./chunk-MQLPJEA3.mjs";
import "./chunk-UVJ2HR4M.mjs";
import "./chunk-7VMYC3L4.mjs";
import "./chunk-YMNL5UXF.mjs";
import "./chunk-GKB7ML42.mjs";
import "./chunk-VSULCTJ3.mjs";
import "./chunk-OMSUSS74.mjs";
import "./chunk-2RP5QIEU.mjs";
import {
  __name
} from "./chunk-42YUCIBL.mjs";

// src/diagrams/swimlanes/styles.ts
var getStyles = /* @__PURE__ */ __name((options) => `${styles_default(options)}
  .swimlane.cluster:not([data-color-id]) rect {
    stroke: ${options.clusterBorder} !important;
  }
  [data-look="neo"].cluster rect {
    filter: none;
  }
`, "getStyles");
var styles_default2 = getStyles;

// src/diagrams/swimlanes/swimlanesDiagram.ts
var diagram = createFlowDiagram({ styles: styles_default2 });
export {
  diagram
};
