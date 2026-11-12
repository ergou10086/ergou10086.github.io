import {
  db,
  getStyles,
  renderer
} from "./chunk-IBR26KL2.mjs";
import {
  populateCommonDb
} from "./chunk-FWNJ5EAJ.mjs";
import {
  MermaidParseError
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
import {
  createRailroadServices
} from "./chunk-TB6STKVJ.mjs";
import "./chunk-RXMY7EUA.mjs";
import "./chunk-4QNPMWDU.mjs";
import "./chunk-FWUIELN6.mjs";
import "./chunk-TZ7DUYEA.mjs";
import "./chunk-E5HCKRCG.mjs";
import "./chunk-EGU2BUMN.mjs";
import "./chunk-DCGTWG2P.mjs";
import "./chunk-OMSUSS74.mjs";
import {
  log
} from "./chunk-2RP5QIEU.mjs";
import {
  __name
} from "./chunk-42YUCIBL.mjs";

// src/diagrams/railroad/parser/railroadParser.ts
var langiumParser = createRailroadServices().Railroad.parser.LangiumParser;
var transformExpression = /* @__PURE__ */ __name((expr) => {
  switch (expr.$type) {
    case "RailroadTerminalExpr":
      return {
        type: "terminal",
        value: expr.value
      };
    case "RailroadNonTerminalExpr":
      return {
        type: "nonterminal",
        name: expr.name
      };
    case "RailroadSpecialExpr":
      return {
        type: "special",
        text: expr.text
      };
    case "RailroadSequenceExpr": {
      const elements = expr.elements.map(transformExpression);
      return elements.length === 1 ? elements[0] : { type: "sequence", elements };
    }
    case "RailroadChoiceExpr": {
      const alternatives = expr.alternatives.map(transformExpression);
      return alternatives.length === 1 ? alternatives[0] : { type: "choice", alternatives };
    }
    case "RailroadOptionalExpr":
      return {
        type: "optional",
        element: transformExpression(expr.element)
      };
    case "RailroadOneOrMoreExpr":
      return {
        type: "repetition",
        element: transformExpression(expr.element),
        min: 1,
        max: Infinity
      };
    case "RailroadZeroOrMoreExpr":
      return {
        type: "repetition",
        element: transformExpression(expr.element),
        min: 0,
        max: Infinity
      };
    default:
      throw new Error(`Unsupported railroad expression: ${expr.$type}`);
  }
}, "transformExpression");
var transformRule = /* @__PURE__ */ __name((rule) => {
  return {
    name: rule.name,
    definition: transformExpression(rule.definition)
  };
}, "transformRule");
var populateDb = /* @__PURE__ */ __name((ast) => {
  populateCommonDb(ast, db);
  if (ast.title) {
    db.setTitle(ast.title);
  }
  ast.rules.map((rule) => db.addRule(transformRule(rule)));
}, "populateDb");
var parser = {
  parse: /* @__PURE__ */ __name((input) => {
    db.clear();
    log.debug("[Railroad Parser] Starting Langium parse");
    const result = langiumParser.parse(input);
    if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
      throw new MermaidParseError(result);
    }
    const ast = result.value;
    log.debug("[Railroad Parser] Parsed rules:", ast.rules.length);
    populateDb(ast);
    log.debug("[Railroad Parser] Parse complete");
  }, "parse"),
  parser: {
    yy: db
  }
};

// src/diagrams/railroad/railroadDiagram.ts
var diagram = {
  parser,
  db,
  renderer,
  styles: getStyles
};
var railroadDiagram_default = diagram;
export {
  railroadDiagram_default as default,
  diagram
};
