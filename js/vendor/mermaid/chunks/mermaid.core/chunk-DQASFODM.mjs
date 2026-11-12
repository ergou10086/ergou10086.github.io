import {
  getSubGraphTitleMargins
} from "./chunk-LEVMRMFU.mjs";
import {
  createLabel_default
} from "./chunk-AXFCVDMN.mjs";
import {
  isLabelStyle,
  styles2String
} from "./chunk-X4PVCEUW.mjs";
import {
  createText,
  fastdom_default
} from "./chunk-STOXU5M4.mjs";
import {
  handleUndefinedAttr,
  utils_default
} from "./chunk-6MUBBAK2.mjs";
import {
  getConfig,
  getConfig2,
  getEffectiveHtmlLabels
} from "./chunk-BG4553SI.mjs";
import {
  log
} from "./chunk-X3CZISLH.mjs";
import {
  __name
} from "./chunk-Y2CYZVJY.mjs";

// src/rendering-util/labelTransform.ts
var computeLabelTransform = /* @__PURE__ */ __name((bbox, useHtmlLabels) => {
  if (useHtmlLabels) {
    return "translate(" + -bbox.width / 2 + ", " + -bbox.height / 2 + ")";
  }
  const x = bbox.x ?? 0;
  const y = bbox.y ?? 0;
  return "translate(" + -(x + bbox.width / 2) + ", " + -(y + bbox.height / 2) + ")";
}, "computeLabelTransform");

// src/utils/lineWithOffset.ts
var markerOffsets = {
  aggregation: 17.25,
  extension: 17.25,
  composition: 17.25,
  dependency: 6,
  lollipop: 13.5,
  arrow_point: 4,
  arrow_barb: 0,
  arrow_barb_neo: 5.5
  //arrow_cross: 24,
};
var markerOffsets2 = {
  arrow_point: 4,
  arrow_cross: 12.5,
  arrow_circle: 12.5,
  arrow_open_head: 4,
  arrow_hollow_circle: 8
};
function calculateDeltaAndAngle(point1, point2) {
  if (point1 === void 0 || point2 === void 0) {
    return { angle: 0, deltaX: 0, deltaY: 0 };
  }
  point1 = pointTransformer(point1);
  point2 = pointTransformer(point2);
  const [x1, y1] = [point1.x, point1.y];
  const [x2, y2] = [point2.x, point2.y];
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  return { angle: Math.atan(deltaY / deltaX), deltaX, deltaY };
}
__name(calculateDeltaAndAngle, "calculateDeltaAndAngle");
var pointTransformer = /* @__PURE__ */ __name((data) => {
  if (Array.isArray(data)) {
    return { x: data[0], y: data[1] };
  }
  return data;
}, "pointTransformer");
var getLineFunctionsWithOffset = /* @__PURE__ */ __name((edge) => {
  return {
    x: /* @__PURE__ */ __name(function(d, i, data) {
      let offset = 0;
      const DIRECTION = pointTransformer(data[0]).x < pointTransformer(data[data.length - 1]).x ? "left" : "right";
      if (i === 0 && Object.hasOwn(markerOffsets, edge.arrowTypeStart)) {
        const { angle, deltaX } = calculateDeltaAndAngle(data[0], data[1]);
        offset = markerOffsets[edge.arrowTypeStart] * Math.cos(angle) * (deltaX >= 0 ? 1 : -1);
      } else if (i === data.length - 1 && Object.hasOwn(markerOffsets, edge.arrowTypeEnd)) {
        const { angle, deltaX } = calculateDeltaAndAngle(
          data[data.length - 1],
          data[data.length - 2]
        );
        offset = markerOffsets[edge.arrowTypeEnd] * Math.cos(angle) * (deltaX >= 0 ? 1 : -1);
      }
      const differenceToEnd = Math.abs(
        pointTransformer(d).x - pointTransformer(data[data.length - 1]).x
      );
      const differenceInYEnd = Math.abs(
        pointTransformer(d).y - pointTransformer(data[data.length - 1]).y
      );
      const differenceToStart = Math.abs(pointTransformer(d).x - pointTransformer(data[0]).x);
      const differenceInYStart = Math.abs(pointTransformer(d).y - pointTransformer(data[0]).y);
      const startMarkerHeight = markerOffsets[edge.arrowTypeStart];
      const endMarkerHeight = markerOffsets[edge.arrowTypeEnd];
      const extraRoom = 1;
      if (differenceToEnd < endMarkerHeight && differenceToEnd > 0 && differenceInYEnd < endMarkerHeight) {
        let adjustment = endMarkerHeight + extraRoom - differenceToEnd;
        adjustment *= DIRECTION === "right" ? -1 : 1;
        offset -= adjustment;
      }
      if (differenceToStart < startMarkerHeight && differenceToStart > 0 && differenceInYStart < startMarkerHeight) {
        let adjustment = startMarkerHeight + extraRoom - differenceToStart;
        adjustment *= DIRECTION === "right" ? -1 : 1;
        offset += adjustment;
      }
      return pointTransformer(d).x + offset;
    }, "x"),
    y: /* @__PURE__ */ __name(function(d, i, data) {
      let offset = 0;
      const DIRECTION = pointTransformer(data[0]).y < pointTransformer(data[data.length - 1]).y ? "down" : "up";
      if (i === 0 && Object.hasOwn(markerOffsets, edge.arrowTypeStart)) {
        const { angle, deltaY } = calculateDeltaAndAngle(data[0], data[1]);
        offset = markerOffsets[edge.arrowTypeStart] * Math.abs(Math.sin(angle)) * (deltaY >= 0 ? 1 : -1);
      } else if (i === data.length - 1 && Object.hasOwn(markerOffsets, edge.arrowTypeEnd)) {
        const { angle, deltaY } = calculateDeltaAndAngle(
          data[data.length - 1],
          data[data.length - 2]
        );
        offset = markerOffsets[edge.arrowTypeEnd] * Math.abs(Math.sin(angle)) * (deltaY >= 0 ? 1 : -1);
      }
      const differenceToEnd = Math.abs(
        pointTransformer(d).y - pointTransformer(data[data.length - 1]).y
      );
      const differenceInXEnd = Math.abs(
        pointTransformer(d).x - pointTransformer(data[data.length - 1]).x
      );
      const differenceToStart = Math.abs(pointTransformer(d).y - pointTransformer(data[0]).y);
      const differenceInXStart = Math.abs(pointTransformer(d).x - pointTransformer(data[0]).x);
      const startMarkerHeight = markerOffsets[edge.arrowTypeStart];
      const endMarkerHeight = markerOffsets[edge.arrowTypeEnd];
      const extraRoom = 1;
      if (differenceToEnd < endMarkerHeight && differenceToEnd > 0 && differenceInXEnd < endMarkerHeight) {
        let adjustment = endMarkerHeight + extraRoom - differenceToEnd;
        adjustment *= DIRECTION === "up" ? -1 : 1;
        offset -= adjustment;
      }
      if (differenceToStart < startMarkerHeight && differenceToStart > 0 && differenceInXStart < startMarkerHeight) {
        let adjustment = startMarkerHeight + extraRoom - differenceToStart;
        adjustment *= DIRECTION === "up" ? -1 : 1;
        offset += adjustment;
      }
      return pointTransformer(d).y + offset;
    }, "y")
  };
}, "getLineFunctionsWithOffset");
if (void 0) {
  const { it, expect, describe } = void 0;
  describe("calculateDeltaAndAngle", () => {
    it("should calculate the angle and deltas between two points", () => {
      expect(calculateDeltaAndAngle([0, 0], [0, 1])).toStrictEqual({
        angle: 1.5707963267948966,
        deltaX: 0,
        deltaY: 1
      });
      expect(calculateDeltaAndAngle([1, 0], [0, -1])).toStrictEqual({
        angle: 0.7853981633974483,
        deltaX: -1,
        deltaY: -1
      });
      expect(calculateDeltaAndAngle({ x: 1, y: 0 }, [0, -1])).toStrictEqual({
        angle: 0.7853981633974483,
        deltaX: -1,
        deltaY: -1
      });
      expect(calculateDeltaAndAngle({ x: 1, y: 0 }, { x: 1, y: 0 })).toStrictEqual({
        angle: NaN,
        deltaX: 0,
        deltaY: 0
      });
    });
    it("should calculate the angle and deltas if one point in undefined", () => {
      expect(calculateDeltaAndAngle(void 0, [0, 1])).toStrictEqual({
        angle: 0,
        deltaX: 0,
        deltaY: 0
      });
      expect(calculateDeltaAndAngle([0, 1], void 0)).toStrictEqual({
        angle: 0,
        deltaX: 0,
        deltaY: 0
      });
    });
  });
}

// src/rendering-util/rendering-elements/edgeStepAnimation.ts
import { select } from "d3";
import { channel } from "khroma";

// src/rendering-util/edgeStep.ts
var EDGE_STEP_DURATION = 1;
var getStepDuration = /* @__PURE__ */ __name((value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : EDGE_STEP_DURATION, "getStepDuration");
var isStepEdge = /* @__PURE__ */ __name((edge) => typeof edge.step === "number" && Number.isInteger(edge.step) && edge.step > 0, "isStepEdge");

// src/rendering-util/rendering-elements/edgeStepAnimation.ts
var STEP_BADGE_FRACTIONS = [0.25, 0.35, 0.15, 0.65, 0.75, 0.5, 0.85, 0.1, 0.9];
var STEP_BADGE_RADIUS = 9;
var STEP_BADGE_FONT_SIZE = 11;
var STEP_BADGE_GAP = 2;
var STEP_BADGE_FALLBACK_FILL = "#333333";
var STEP_ARROWHEAD_LENGTH = 12;
var STEP_ARROWHEAD_HALF_WIDTH = 6;
var STEP_BADGE_OFFSET = 14;
var STEP_TANGENT_STEP = 0.01;
var MIN_TEXT_CONTRAST = 4.5;
var TRANSLATE = /translate\(\s*(-?[\d.e]+)[\s,]+(-?[\d.e]+)/i;
var STEP_HIGHLIGHT_STROKE_WIDTH = 4;
var STEP_HIGHLIGHT_STROKE_OPACITY = 0.6;
var STEP_DOT_RADIUS = 4;
var getEdgeStepTiming = /* @__PURE__ */ __name((step, stepCount, stepDuration = EDGE_STEP_DURATION) => {
  const count = Math.max(stepCount, step);
  return {
    begin: (step - 1) * stepDuration,
    dur: stepDuration,
    gap: (count - 1) * stepDuration
  };
}, "getEdgeStepTiming");
var toAnimationId = /* @__PURE__ */ __name((value) => `step_${Array.from(
  value,
  (char) => /[\dA-Za-z]/.test(char) ? char : `_${(char.codePointAt(0) ?? 0).toString(16)}_`
).join("")}`, "toAnimationId");
var pathStartTranslate = /* @__PURE__ */ __name((pathData) => {
  const start = /^m\s*(-?[\d.e]+)[\s,]+(-?[\d.e]+)/i.exec(pathData.trim());
  return start ? `translate(${start[1]},${start[2]}) ` : "";
}, "pathStartTranslate");
var escapeCssIdentifierFallback = /* @__PURE__ */ __name((value) => Array.from(value, (char, index) => {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0) {
    return "\uFFFD";
  }
  const isControl = code <= 31 || code === 127;
  const isLeadingDigit = /\d/.test(char) && (index === 0 || index === 1 && value.startsWith("-"));
  if (isControl || isLeadingDigit) {
    return `\\${code.toString(16)} `;
  }
  if (value === "-") {
    return "\\-";
  }
  return code >= 128 || /[\w-]/.test(char) ? char : `\\${char}`;
}).join(""), "escapeCssIdentifierFallback");
var escapeCssIdentifier = /* @__PURE__ */ __name((value) => typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(value) : escapeCssIdentifierFallback(value), "escapeCssIdentifier");
var ensureReducedMotionStyle = /* @__PURE__ */ __name((elem, diagramId) => {
  const node = elem.node();
  const svg = node?.ownerSVGElement ?? node?.closest?.("svg") ?? node;
  const scopeId = diagramId || svg?.getAttribute("id");
  if (!svg || !scopeId || svg.querySelector("style.edge-step-style")) {
    return;
  }
  const scope = `#${escapeCssIdentifier(scopeId)} `;
  const style = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "style");
  style.setAttribute("class", "edge-step-style");
  style.textContent = `@media (prefers-reduced-motion: reduce) { ${scope}.edge-step-dot, ${scope}.edge-step-highlight { display: none; } }`;
  svg.appendChild(style);
}, "ensureReducedMotionStyle");
var pointAlongPolyline = /* @__PURE__ */ __name((points, fraction) => {
  const valid = points.filter((point2) => Number.isFinite(point2.x) && Number.isFinite(point2.y));
  if (valid.length === 0) {
    return void 0;
  }
  const lengths = valid.slice(1).map((point2, index) => Math.hypot(point2.x - valid[index].x, point2.y - valid[index].y));
  let remaining = lengths.reduce((total, length) => total + length, 0) * fraction;
  for (const [index, length] of lengths.entries()) {
    if (remaining <= length && length > 0) {
      const ratio = remaining / length;
      const from = valid[index];
      const to = valid[index + 1];
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
    remaining -= length;
  }
  return valid[valid.length - 1];
}, "pointAlongPolyline");
var createPathSampler = /* @__PURE__ */ __name((points, pathNode) => {
  const length = typeof pathNode?.getTotalLength === "function" ? pathNode.getTotalLength() : 0;
  const getPoint = pathNode?.getPointAtLength?.bind(pathNode);
  if (length > 0 && getPoint) {
    return (fraction) => {
      const { x, y } = getPoint(length * fraction);
      return { x, y };
    };
  }
  return (fraction) => pointAlongPolyline(points, fraction);
}, "createPathSampler");
var roomAround = /* @__PURE__ */ __name((point2, obstacles) => Math.min(
  Number.POSITIVE_INFINITY,
  ...obstacles.map((obstacle) => {
    const dx = Math.max(Math.abs(point2.x - obstacle.x) - obstacle.halfWidth, 0);
    const dy = Math.max(Math.abs(point2.y - obstacle.y) - obstacle.halfHeight, 0);
    return Math.hypot(dx, dy) - STEP_BADGE_RADIUS;
  })
), "roomAround");
var besideThePath = /* @__PURE__ */ __name((sample, fraction) => {
  const point2 = sample(fraction);
  const before = sample(Math.max(fraction - STEP_TANGENT_STEP, 0));
  const after = sample(Math.min(fraction + STEP_TANGENT_STEP, 1));
  if (!point2 || !before || !after) {
    return [];
  }
  const length = Math.hypot(after.x - before.x, after.y - before.y);
  if (length === 0) {
    return [];
  }
  const normal = { x: -(after.y - before.y) / length, y: (after.x - before.x) / length };
  return [1, -1].map((side) => ({
    x: point2.x + normal.x * STEP_BADGE_OFFSET * side,
    y: point2.y + normal.y * STEP_BADGE_OFFSET * side
  }));
}, "besideThePath");
var chooseBadgePosition = /* @__PURE__ */ __name((sample, obstacles) => {
  const candidates = [
    ...STEP_BADGE_FRACTIONS.map(sample),
    ...STEP_BADGE_FRACTIONS.flatMap((fraction) => besideThePath(sample, fraction))
  ];
  let best;
  let bestRoom = Number.NEGATIVE_INFINITY;
  for (const point2 of candidates) {
    if (!point2 || !Number.isFinite(point2.x) || !Number.isFinite(point2.y)) {
      continue;
    }
    const room = roomAround(point2, obstacles);
    if (room >= STEP_BADGE_GAP) {
      return point2;
    }
    if (room > bestRoom) {
      best = point2;
      bestRoom = room;
    }
  }
  return best;
}, "chooseBadgePosition");
var square = /* @__PURE__ */ __name((point2, half) => ({
  ...point2,
  halfWidth: half,
  halfHeight: half
}), "square");
var translationOf = /* @__PURE__ */ __name((node) => {
  const match = TRANSLATE.exec(node.getAttribute("transform") ?? "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
}, "translationOf");
var offsetInSvg = /* @__PURE__ */ __name((node) => {
  const offset = { x: 0, y: 0 };
  for (let current = node; current && current.localName !== "svg"; current = current.parentElement) {
    const { x, y } = translationOf(current);
    offset.x += x;
    offset.y += y;
  }
  return offset;
}, "offsetInSvg");
var boxedObstacle = /* @__PURE__ */ __name((node, origin) => {
  if (!TRANSLATE.test(node.getAttribute("transform") ?? "")) {
    return void 0;
  }
  const offset = offsetInSvg(node);
  const x = offset.x - origin.x;
  const y = offset.y - origin.y;
  const box = node.getBBox?.();
  if (!box) {
    return void 0;
  }
  return {
    x: x + box.x + box.width / 2,
    y: y + box.y + box.height / 2,
    halfWidth: box.width / 2,
    halfHeight: box.height / 2
  };
}, "boxedObstacle");
var readPoints = /* @__PURE__ */ __name((path) => {
  try {
    const points = JSON.parse(atob(path.getAttribute("data-points") ?? ""));
    return Array.isArray(points) ? points : [];
  } catch {
    return [];
  }
}, "readPoints");
var arrowheadObstacle = /* @__PURE__ */ __name((tip, from) => {
  const length = Math.hypot(tip.x - from.x, tip.y - from.y);
  if (length === 0) {
    return square(tip, STEP_ARROWHEAD_LENGTH);
  }
  const along = { x: (tip.x - from.x) / length, y: (tip.y - from.y) / length };
  const half = STEP_ARROWHEAD_LENGTH / 2;
  return {
    x: tip.x - along.x * half,
    y: tip.y - along.y * half,
    halfWidth: Math.abs(along.x) * half + Math.abs(along.y) * STEP_ARROWHEAD_HALF_WIDTH,
    halfHeight: Math.abs(along.y) * half + Math.abs(along.x) * STEP_ARROWHEAD_HALF_WIDTH
  };
}, "arrowheadObstacle");
var hasMarker = /* @__PURE__ */ __name((path, attribute) => {
  const value = path.getAttribute(attribute);
  return !!value && value !== "none";
}, "hasMarker");
var arrowheadObstacles = /* @__PURE__ */ __name((path, origin) => {
  const points = readPoints(path).filter(
    (point2) => Number.isFinite(point2?.x) && Number.isFinite(point2?.y)
  );
  if (points.length === 0) {
    return [];
  }
  const offset = offsetInSvg(path);
  const toSvg = /* @__PURE__ */ __name((point2) => ({
    x: point2.x + offset.x - origin.x,
    y: point2.y + offset.y - origin.y
  }), "toSvg");
  const last = points.length - 1;
  const obstacles = [];
  if (hasMarker(path, "marker-start")) {
    obstacles.push(arrowheadObstacle(toSvg(points[0]), toSvg(points[Math.min(1, last)])));
  }
  if (hasMarker(path, "marker-end")) {
    obstacles.push(arrowheadObstacle(toSvg(points[last]), toSvg(points[Math.max(last - 1, 0)])));
  }
  return obstacles;
}, "arrowheadObstacles");
var collectBadgeObstacles = /* @__PURE__ */ __name((root) => {
  const origin = { x: 0, y: 0 };
  const boxed = [...root?.querySelectorAll(".edgeLabel, .node") ?? []].map((obstacle) => boxedObstacle(obstacle, origin)).filter((obstacle) => obstacle !== void 0);
  const arrowheads = [...root?.querySelectorAll('path[data-edge="true"]') ?? []].flatMap(
    (path) => arrowheadObstacles(path, origin)
  );
  return [...boxed, ...arrowheads];
}, "collectBadgeObstacles");
var edgeLabelObstacles = /* @__PURE__ */ __name((edge, points) => {
  if (!edge.label || points.length === 0) {
    return [];
  }
  const { x, y } = utils_default.calcLabelPosition(points);
  return [{ x, y, halfWidth: (edge.width ?? 0) / 2, halfHeight: (edge.height ?? 0) / 2 }];
}, "edgeLabelObstacles");
var linearChannel = /* @__PURE__ */ __name((value) => {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}, "linearChannel");
var relativeLuminance = /* @__PURE__ */ __name((color) => {
  try {
    const [r, g, b] = ["r", "g", "b"].map((part) => linearChannel(channel(color, part)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  } catch {
    return void 0;
  }
}, "relativeLuminance");
var contrastRatio = /* @__PURE__ */ __name((first, second) => {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  if (a === void 0 || b === void 0) {
    return 0;
  }
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}, "contrastRatio");
var pickBadgeTextColor = /* @__PURE__ */ __name((fill, candidates) => {
  const options = [...candidates.filter((color) => !!color), "#ffffff", "#000000"];
  const scored = options.map((color) => ({ color, ratio: contrastRatio(fill, color) }));
  const readable = scored.find(({ ratio }) => ratio >= MIN_TEXT_CONTRAST);
  return (readable ?? scored.reduce((best, next) => next.ratio > best.ratio ? next : best)).color;
}, "pickBadgeTextColor");
var bareColor = /* @__PURE__ */ __name((color) => {
  const bare = color?.replace(/^stroke:\s*/, "").trim();
  return bare === "" ? void 0 : bare;
}, "bareColor");
var insertEdgeStepBadge = /* @__PURE__ */ __name((elem, edge, options, obstacles = collectBadgeObstacles(elem.node()?.closest("svg"))) => {
  if (!isStepEdge(edge) || !edge.showStepNumber) {
    return void 0;
  }
  const origin = offsetInSvg(elem.node());
  const local = obstacles.map((obstacle) => ({
    ...obstacle,
    x: obstacle.x - origin.x,
    y: obstacle.y - origin.y
  }));
  const position = chooseBadgePosition(createPathSampler(options.points, options.pathNode), [
    ...local,
    ...edgeLabelObstacles(edge, options.points)
  ]);
  if (!position) {
    return void 0;
  }
  const fill = bareColor(options.color) ?? STEP_BADGE_FALLBACK_FILL;
  const badge = elem.append("g").attr("class", "edge-step-badge").attr("transform", `translate(${position.x},${position.y})`).attr("pointer-events", "none").attr("data-step", edge.step);
  badge.append("circle").attr("r", STEP_BADGE_RADIUS).attr("fill", fill);
  badge.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("font-size", STEP_BADGE_FONT_SIZE).attr("fill", pickBadgeTextColor(fill, options.textColors ?? [])).text(String(edge.step));
  return square({ x: position.x + origin.x, y: position.y + origin.y }, STEP_BADGE_RADIUS);
}, "insertEdgeStepBadge");
var showWhileStepPlays = /* @__PURE__ */ __name((target, motionId, dur) => {
  target.append("animateTransform").attr("attributeName", "transform").attr("type", "scale").attr("values", "1;1").attr("dur", `${dur}s`).attr("begin", `${motionId}.begin`).attr("fill", "remove");
}, "showWhileStepPlays");
var insertEdgeStepDot = /* @__PURE__ */ __name((elem, edge, pathData, diagramId, color) => {
  if (!isStepEdge(edge) || !pathData) {
    return;
  }
  const { begin, dur, gap } = getEdgeStepTiming(
    edge.step,
    edge.stepCount ?? edge.step,
    getStepDuration(edge.stepDuration)
  );
  const motionId = toAnimationId(`${diagramId}-${edge.id}-step`);
  const parked = `${pathStartTranslate(pathData)}scale(0)`;
  const fill = color?.replace(/^stroke:\s*/, "");
  const highlight = elem.append("path").attr("class", "edge-step-highlight").attr("aria-hidden", "true").attr("d", pathData).attr("fill", "none").attr("stroke", fill ?? "currentColor").attr("stroke-width", STEP_HIGHLIGHT_STROKE_WIDTH).attr("stroke-linecap", "round").attr("stroke-opacity", STEP_HIGHLIGHT_STROKE_OPACITY).attr("pointer-events", "none").attr("transform", parked).attr("data-step", edge.step);
  showWhileStepPlays(highlight, motionId, dur);
  const dot = elem.append("circle").attr("class", "edge-step-dot").attr("r", STEP_DOT_RADIUS).attr("aria-hidden", "true").attr("transform", parked).attr("data-step", edge.step);
  if (fill) {
    dot.attr("fill", fill).attr("stroke", "none");
  }
  dot.append("animateMotion").attr("id", motionId).attr("path", pathData).attr("dur", `${dur}s`).attr("begin", `${begin}s;${motionId}.end+${gap}s`).attr("fill", "remove");
  showWhileStepPlays(dot, motionId, dur);
  ensureReducedMotionStyle(elem, diagramId);
}, "insertEdgeStepDot");
var queuedBadges = /* @__PURE__ */ new WeakMap();
var badgeLayer = /* @__PURE__ */ __name((root) => {
  const existing = root.querySelector(":scope > g.edge-step-badges");
  if (existing) {
    return existing;
  }
  const layer = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("class", "edge-step-badges");
  return root.appendChild(layer);
}, "badgeLayer");
var placeQueuedStepBadges = /* @__PURE__ */ __name((svg) => {
  const queued = svg ? queuedBadges.get(svg) : void 0;
  if (!svg || !queued) {
    return;
  }
  queuedBadges.delete(svg);
  const obstacles = collectBadgeObstacles(svg);
  for (const { elem, edge, options } of queued) {
    const root = elem.node()?.parentElement;
    if (!root) {
      continue;
    }
    const layer = select(badgeLayer(root));
    const placed = insertEdgeStepBadge(layer, edge, options, obstacles);
    if (placed) {
      obstacles.push(placed);
    }
  }
}, "placeQueuedStepBadges");
var insertEdgeStepMarks = /* @__PURE__ */ __name((elem, edge, pathData, diagramId, badge) => {
  insertEdgeStepDot(elem, edge, pathData, diagramId, badge.color);
  const node = elem.node();
  const svg = node?.ownerSVGElement ?? node;
  if (!svg || !isStepEdge(edge) || !edge.showStepNumber) {
    return;
  }
  queuedBadges.set(svg, [...queuedBadges.get(svg) ?? [], { elem, edge, options: badge }]);
}, "insertEdgeStepMarks");

// src/rendering-util/rendering-elements/edges.js
import {
  curveBasis,
  curveLinear,
  curveCardinal,
  curveBumpX,
  curveBumpY,
  curveCatmullRom,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
  line,
  select as select2
} from "d3";
import rough from "roughjs";

// src/rendering-util/rendering-elements/edgeMarker.ts
var addEdgeMarkers = /* @__PURE__ */ __name((svgPath, edge, url, id, diagramType, useMargin = false, strokeColor) => {
  if (edge.arrowTypeStart) {
    addEdgeMarker(
      svgPath,
      "start",
      edge.arrowTypeStart,
      url,
      id,
      diagramType,
      useMargin,
      strokeColor
    );
  }
  if (edge.arrowTypeEnd) {
    addEdgeMarker(svgPath, "end", edge.arrowTypeEnd, url, id, diagramType, useMargin, strokeColor);
  }
}, "addEdgeMarkers");
var arrowTypesMap = {
  arrow_cross: { type: "cross", fill: false },
  arrow_point: { type: "point", fill: true },
  arrow_barb: { type: "barb", fill: true },
  arrow_barb_neo: { type: "barb", fill: true },
  arrow_circle: { type: "circle", fill: false },
  arrow_open_head: { type: "openArrow", fill: false },
  arrow_hollow_circle: { type: "hollowCircle", fill: false },
  arrow_hierarchy: { type: "hierarchy", fill: false },
  aggregation: { type: "aggregation", fill: false },
  extension: { type: "extension", fill: false },
  composition: { type: "composition", fill: true },
  dependency: { type: "dependency", fill: true },
  lollipop: { type: "lollipop", fill: false },
  only_one: { type: "onlyOne", fill: false },
  zero_or_one: { type: "zeroOrOne", fill: false },
  one_or_more: { type: "oneOrMore", fill: false },
  zero_or_more: { type: "zeroOrMore", fill: false },
  requirement_arrow: { type: "requirement_arrow", fill: false },
  requirement_contains: { type: "requirement_contains", fill: false }
};
var arrowTypesWithMarginSupport = [
  "cross",
  "point",
  "circle",
  "lollipop",
  "aggregation",
  "extension",
  "composition",
  "dependency",
  "barb"
];
var addEdgeMarker = /* @__PURE__ */ __name((svgPath, position, arrowType, url, id, diagramType, useMargin = false, strokeColor) => {
  if (!arrowType || arrowType === "none") {
    return;
  }
  const arrowTypeInfo = arrowTypesMap[arrowType];
  const marginSupport = arrowTypeInfo && arrowTypesWithMarginSupport.includes(arrowTypeInfo.type);
  if (!arrowTypeInfo) {
    log.warn(`Unknown arrow type: ${arrowType}`);
    return;
  }
  const endMarkerType = arrowTypeInfo.type;
  const suffix = position === "start" ? "Start" : "End";
  const offset = useMargin && marginSupport ? "-margin" : "";
  const originalMarkerId = `${id}_${diagramType}-${endMarkerType}${suffix}${offset}`;
  if (strokeColor && strokeColor.trim() !== "") {
    const colorId = strokeColor.replace(/[^\dA-Za-z]/g, "_");
    const coloredMarkerId = `${originalMarkerId}_${colorId}`;
    if (!document.getElementById(coloredMarkerId)) {
      const originalMarker = document.getElementById(originalMarkerId);
      if (originalMarker) {
        const coloredMarker = originalMarker.cloneNode(true);
        coloredMarker.id = coloredMarkerId;
        const paths = coloredMarker.querySelectorAll("path, circle, line");
        paths.forEach((path) => {
          path.setAttribute("stroke", strokeColor);
          if (arrowTypeInfo.fill) {
            path.setAttribute("fill", strokeColor);
          }
        });
        originalMarker.parentNode?.appendChild(coloredMarker);
      }
    }
    svgPath.attr(`marker-${position}`, `url(${url}#${coloredMarkerId})`);
  } else {
    svgPath.attr(`marker-${position}`, `url(${url}#${originalMarkerId})`);
  }
}, "addEdgeMarker");

// src/rendering-util/rendering-elements/edges.js
var resolveEdgeCurveType = /* @__PURE__ */ __name((edgeCurve) => {
  return typeof edgeCurve === "string" ? edgeCurve : getConfig2()?.flowchart?.curve;
}, "resolveEdgeCurveType");
var edgeLabels = /* @__PURE__ */ new Map();
var terminalLabels = /* @__PURE__ */ new Map();
var clear = /* @__PURE__ */ __name(() => {
  edgeLabels.clear();
  terminalLabels.clear();
}, "clear");
var hasEdgeLabel = /* @__PURE__ */ __name((edge) => Boolean(
  edge.label || edge.startLabelLeft || edge.startLabelRight || edge.endLabelLeft || edge.endLabelRight
), "hasEdgeLabel");
var getLabelStyles = /* @__PURE__ */ __name((styleArray) => {
  if (!styleArray) {
    return "";
  }
  if (typeof styleArray === "string") {
    return styleArray;
  }
  return styleArray.reduce((acc, style) => acc + ";" + style, "");
}, "getLabelStyles");
var insertEdgeLabel = /* @__PURE__ */ __name(async (elem, edge) => {
  const config = getConfig2();
  let useHtmlLabels = getEffectiveHtmlLabels(config);
  const { labelStyles } = styles2String(edge);
  edge.labelStyle = labelStyles;
  const edgeLabel = elem.insert("g").attr("class", "edgeLabel");
  const label = edgeLabel.insert("g").attr("class", "label").attr("data-id", edge.id);
  const isMarkdown = edge.labelType === "markdown";
  const markdownWidth = void 0;
  const labelElement = await createText(
    elem,
    edge.label,
    {
      style: getLabelStyles(edge.labelStyle),
      useHtmlLabels,
      addSvgBackground: true,
      isNode: false,
      markdown: isMarkdown,
      // Plain text edge labels should auto-wrap, markdown edge labels respect markdownAutoWrap config
      width: isMarkdown ? markdownWidth : void 0
    },
    config
  );
  label.node().appendChild(labelElement);
  log.info("abc82", edge, edge.labelType);
  let bbox;
  let transformBbox;
  if (useHtmlLabels) {
    const div = labelElement.children[0];
    const dv = select2(labelElement);
    bbox = await fastdom_default.measure(() => div.getBoundingClientRect());
    transformBbox = bbox;
    dv.attr("width", bbox.width);
    dv.attr("height", bbox.height);
  } else {
    const textEl = select2(labelElement).select("text").node();
    await fastdom_default.measure(() => {
      bbox = labelElement.getBBox();
      if (textEl && typeof textEl.getBBox === "function") {
        transformBbox = textEl.getBBox();
      } else {
        transformBbox = bbox;
      }
    });
  }
  label.attr("transform", computeLabelTransform(transformBbox, useHtmlLabels));
  edgeLabels.set(edge.id, edgeLabel);
  edge.width = bbox.width;
  edge.height = bbox.height;
  let fo;
  if (edge.startLabelLeft) {
    const startEdgeLabelLeft = elem.insert("g").attr("class", "edgeTerminals");
    const inner = startEdgeLabelLeft.insert("g").attr("class", "inner");
    const startLabelElement = await createLabel_default(
      inner,
      edge.startLabelLeft,
      getLabelStyles(edge.labelStyle) || "",
      false,
      false
    );
    fo = startLabelElement;
    let slBox = startLabelElement.getBBox();
    if (useHtmlLabels) {
      const div = startLabelElement.children[0];
      const dv = select2(startLabelElement);
      slBox = div.getBoundingClientRect();
      dv.attr("width", slBox.width);
      dv.attr("height", slBox.height);
    }
    inner.attr("transform", computeLabelTransform(slBox, useHtmlLabels));
    if (!terminalLabels.get(edge.id)) {
      terminalLabels.set(edge.id, {});
    }
    terminalLabels.get(edge.id).startLeft = startEdgeLabelLeft;
    setTerminalWidth(fo, edge.startLabelLeft, slBox);
    recordTerminalLabelSize(edge, "startLeft", slBox);
  }
  if (edge.startLabelRight) {
    const startEdgeLabelRight = elem.insert("g").attr("class", "edgeTerminals");
    const inner = startEdgeLabelRight.insert("g").attr("class", "inner");
    const startLabelElement = await createLabel_default(
      inner,
      edge.startLabelRight,
      getLabelStyles(edge.labelStyle) || "",
      false,
      false
    );
    fo = startLabelElement;
    let slBox = startLabelElement.getBBox();
    if (useHtmlLabels) {
      const div = startLabelElement.children[0];
      const dv = select2(startLabelElement);
      slBox = div.getBoundingClientRect();
      dv.attr("width", slBox.width);
      dv.attr("height", slBox.height);
    }
    inner.attr("transform", computeLabelTransform(slBox, useHtmlLabels));
    if (!terminalLabels.get(edge.id)) {
      terminalLabels.set(edge.id, {});
    }
    terminalLabels.get(edge.id).startRight = startEdgeLabelRight;
    setTerminalWidth(fo, edge.startLabelRight, slBox);
    recordTerminalLabelSize(edge, "startRight", slBox);
  }
  if (edge.endLabelLeft) {
    const endEdgeLabelLeft = elem.insert("g").attr("class", "edgeTerminals");
    const inner = endEdgeLabelLeft.insert("g").attr("class", "inner");
    const endLabelElement = await createLabel_default(
      inner,
      edge.endLabelLeft,
      getLabelStyles(edge.labelStyle) || "",
      false,
      false
    );
    fo = endLabelElement;
    let slBox = endLabelElement.getBBox();
    if (useHtmlLabels) {
      const div = endLabelElement.children[0];
      const dv = select2(endLabelElement);
      slBox = div.getBoundingClientRect();
      dv.attr("width", slBox.width);
      dv.attr("height", slBox.height);
    }
    inner.attr("transform", computeLabelTransform(slBox, useHtmlLabels));
    if (!terminalLabels.get(edge.id)) {
      terminalLabels.set(edge.id, {});
    }
    terminalLabels.get(edge.id).endLeft = endEdgeLabelLeft;
    setTerminalWidth(fo, edge.endLabelLeft, slBox);
    recordTerminalLabelSize(edge, "endLeft", slBox);
  }
  if (edge.endLabelRight) {
    const endEdgeLabelRight = elem.insert("g").attr("class", "edgeTerminals");
    const inner = endEdgeLabelRight.insert("g").attr("class", "inner");
    const endLabelElement = await createLabel_default(
      inner,
      edge.endLabelRight,
      getLabelStyles(edge.labelStyle) || "",
      false,
      false
    );
    fo = endLabelElement;
    let slBox = endLabelElement.getBBox();
    if (useHtmlLabels) {
      const div = endLabelElement.children[0];
      const dv = select2(endLabelElement);
      slBox = div.getBoundingClientRect();
      dv.attr("width", slBox.width);
      dv.attr("height", slBox.height);
    }
    inner.attr("transform", computeLabelTransform(slBox, useHtmlLabels));
    if (!terminalLabels.get(edge.id)) {
      terminalLabels.set(edge.id, {});
    }
    terminalLabels.get(edge.id).endRight = endEdgeLabelRight;
    setTerminalWidth(fo, edge.endLabelRight, slBox);
    recordTerminalLabelSize(edge, "endRight", slBox);
  }
  return labelElement;
}, "insertEdgeLabel");
function recordTerminalLabelSize(edge, key, box) {
  edge.terminalLabelSizes ??= {};
  edge.terminalLabelSizes[key] = { width: box.width, height: box.height };
}
__name(recordTerminalLabelSize, "recordTerminalLabelSize");
function setTerminalWidth(fo, value, box) {
  if (getEffectiveHtmlLabels(getConfig2()) && fo) {
    fo.style.width = Math.max(value.length * 9, box.width) + "px";
    fo.style.height = box.height + "px";
  }
}
__name(setTerminalWidth, "setTerminalWidth");
var resolveEdgeLabelPosition = /* @__PURE__ */ __name((edge, paths) => {
  let x = edge.x;
  let y = edge.y;
  if (paths?.updatedPath) {
    const updatedMid = utils_default.calcLabelPosition(paths.updatedPath);
    if (paths.originalPath) {
      const originalMid = utils_default.calcLabelPosition(paths.originalPath);
      x = edge.x + (updatedMid.x - originalMid.x);
      y = edge.y + (updatedMid.y - originalMid.y);
    } else {
      x = updatedMid.x;
      y = updatedMid.y;
    }
  }
  return { x, y };
}, "resolveEdgeLabelPosition");
var positionEdgeLabel = /* @__PURE__ */ __name((edge, paths) => {
  log.debug("Moving label abc88 ", edge.id, edge.label, edgeLabels.get(edge.id), paths);
  const siteConfig = getConfig2();
  const { subGraphTitleTotalMargin } = getSubGraphTitleMargins(siteConfig);
  if (edge.label) {
    const el = edgeLabels.get(edge.id);
    const { x, y } = resolveEdgeLabelPosition(edge, paths);
    log.debug(
      "Moving label " + edge.label + " from (",
      edge.x,
      ",",
      edge.y,
      ") to (",
      x,
      ",",
      y,
      ") abc88"
    );
    el.attr("transform", `translate(${x}, ${y + subGraphTitleTotalMargin / 2})`);
  }
  const path = paths.updatedPath ? paths.updatedPath : paths.originalPath;
  if (edge.startLabelLeft) {
    const el = terminalLabels.get(edge.id).startLeft;
    let x = edge.x;
    let y = edge.y;
    if (path) {
      const pos = utils_default.calcTerminalLabelPosition(edge.arrowTypeStart ? 10 : 0, "start_left", path);
      x = pos.x;
      y = pos.y;
    }
    el.attr("transform", `translate(${x}, ${y})`);
  }
  if (edge.startLabelRight) {
    const el = terminalLabels.get(edge.id).startRight;
    let x = edge.x;
    let y = edge.y;
    if (path) {
      const pos = utils_default.calcTerminalLabelPosition(
        edge.arrowTypeStart ? 10 : 0,
        "start_right",
        path
      );
      x = pos.x;
      y = pos.y;
    }
    el.attr("transform", `translate(${x}, ${y})`);
  }
  if (edge.endLabelLeft) {
    const el = terminalLabels.get(edge.id).endLeft;
    let x = edge.x;
    let y = edge.y;
    if (path) {
      const pos = utils_default.calcTerminalLabelPosition(edge.arrowTypeEnd ? 10 : 0, "end_left", path);
      x = pos.x;
      y = pos.y;
    }
    el.attr("transform", `translate(${x}, ${y})`);
  }
  if (edge.endLabelRight) {
    const el = terminalLabels.get(edge.id).endRight;
    let x = edge.x;
    let y = edge.y;
    if (path) {
      const pos = utils_default.calcTerminalLabelPosition(edge.arrowTypeEnd ? 10 : 0, "end_right", path);
      x = pos.x;
      y = pos.y;
    }
    el.attr("transform", `translate(${x}, ${y})`);
  }
}, "positionEdgeLabel");
var AXIS_TOLERANCE = 0.5;
var sharesColumn = /* @__PURE__ */ __name((a, b) => Math.abs(a.x - b.x) < AXIS_TOLERANCE, "sharesColumn");
var sharesRow = /* @__PURE__ */ __name((a, b) => Math.abs(a.y - b.y) < AXIS_TOLERANCE, "sharesRow");
var coincides = /* @__PURE__ */ __name((a, b) => sharesColumn(a, b) && sharesRow(a, b), "coincides");
function keepsArrivalAxis(originalLast, lastInner, candidate) {
  if (sharesColumn(originalLast, lastInner) && !sharesRow(originalLast, lastInner)) {
    return sharesColumn(candidate, lastInner);
  }
  if (sharesRow(originalLast, lastInner) && !sharesColumn(originalLast, lastInner)) {
    return sharesRow(candidate, lastInner);
  }
  return sharesColumn(candidate, lastInner) || sharesRow(candidate, lastInner);
}
__name(keepsArrivalAxis, "keepsArrivalAxis");
function arrivalSegment(originalLast, lastInner, before) {
  return coincides(originalLast, lastInner) ? { heading: lastInner, from: before } : { heading: originalLast, from: lastInner };
}
__name(arrivalSegment, "arrivalSegment");
function runsAgainstHeading({ heading, from }, lastInner, candidate) {
  return (heading.x - from.x) * (candidate.x - lastInner.x) + (heading.y - from.y) * (candidate.y - lastInner.y) < 0;
}
__name(runsAgainstHeading, "runsAgainstHeading");
function snapToArrivalAxis({ heading, from }, lastInner, candidate) {
  if (sharesRow(heading, from) && !sharesColumn(heading, from)) {
    return { x: candidate.x, y: lastInner.y };
  }
  if (sharesColumn(heading, from) && !sharesRow(heading, from)) {
    return { x: lastInner.x, y: candidate.y };
  }
  return candidate;
}
__name(snapToArrivalAxis, "snapToArrivalAxis");
function dockFinalPoint(originalLast, lastInner, before, candidate) {
  const wasOrthogonal = sharesColumn(originalLast, lastInner) || sharesRow(originalLast, lastInner);
  if (wasOrthogonal && !keepsArrivalAxis(originalLast, lastInner, candidate)) {
    return originalLast;
  }
  const arrival = arrivalSegment(originalLast, lastInner, before);
  if (runsAgainstHeading(arrival, lastInner, candidate)) {
    return lastInner;
  }
  return snapToArrivalAxis(arrival, lastInner, candidate);
}
__name(dockFinalPoint, "dockFinalPoint");
function markerPullBack(arrowType) {
  const offset = Object.hasOwn(markerOffsets, arrowType) ? markerOffsets[arrowType] : 0;
  return Number.isFinite(offset) ? offset : 0;
}
__name(markerPullBack, "markerPullBack");
function finalDockPoint({ originalLast, lastInner, newLast, minLength }) {
  const turned = !coincides(originalLast, lastInner);
  const length = Math.hypot(newLast.x - lastInner.x, newLast.y - lastInner.y);
  if (length >= Math.max(AXIS_TOLERANCE, minLength)) {
    return newLast;
  }
  return turned && length >= AXIS_TOLERANCE ? originalLast : void 0;
}
__name(finalDockPoint, "finalDockPoint");
var orthogonalizeToLabelClippedPoints = /* @__PURE__ */ __name((edge, points) => {
  if (!edge?.isLabelEdge || !edge?.id?.endsWith("-to-label") || !Array.isArray(points)) {
    return points;
  }
  if (points.length !== 2) {
    return points;
  }
  const [start, end] = points;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dx < 1e-3 || dy < 1e-3) {
    return points;
  }
  if (dy >= dx) {
    return [start, { x: start.x, y: end.y }, end];
  }
  return [start, { x: end.x, y: start.y }, end];
}, "orthogonalizeToLabelClippedPoints");
var outsideNode = /* @__PURE__ */ __name((node, point2) => {
  const x = node.x;
  const y = node.y;
  const dx = Math.abs(point2.x - x);
  const dy = Math.abs(point2.y - y);
  const w = node.width / 2;
  const h = node.height / 2;
  return dx >= w || dy >= h;
}, "outsideNode");
var intersection = /* @__PURE__ */ __name((node, outsidePoint, insidePoint) => {
  log.debug(`intersection calc abc89:
  outsidePoint: ${JSON.stringify(outsidePoint)}
  insidePoint : ${JSON.stringify(insidePoint)}
  node        : x:${node.x} y:${node.y} w:${node.width} h:${node.height}`);
  const x = node.x;
  const y = node.y;
  const dx = Math.abs(x - insidePoint.x);
  const w = node.width / 2;
  let r = insidePoint.x < outsidePoint.x ? w - dx : w + dx;
  const h = node.height / 2;
  const Q = Math.abs(outsidePoint.y - insidePoint.y);
  const R = Math.abs(outsidePoint.x - insidePoint.x);
  if (Math.abs(y - outsidePoint.y) * w > Math.abs(x - outsidePoint.x) * h) {
    let q = insidePoint.y < outsidePoint.y ? outsidePoint.y - h - y : y - h - outsidePoint.y;
    r = R * q / Q;
    const res = {
      x: insidePoint.x < outsidePoint.x ? insidePoint.x + r : insidePoint.x - R + r,
      y: insidePoint.y < outsidePoint.y ? insidePoint.y + Q - q : insidePoint.y - Q + q
    };
    if (r === 0) {
      res.x = outsidePoint.x;
      res.y = outsidePoint.y;
    }
    if (R === 0) {
      res.x = outsidePoint.x;
    }
    if (Q === 0) {
      res.y = outsidePoint.y;
    }
    log.debug(`abc89 top/bottom calc, Q ${Q}, q ${q}, R ${R}, r ${r}`, res);
    return res;
  } else {
    if (insidePoint.x < outsidePoint.x) {
      r = outsidePoint.x - w - x;
    } else {
      r = x - w - outsidePoint.x;
    }
    let q = Q * r / R;
    let _x = insidePoint.x < outsidePoint.x ? insidePoint.x + R - r : insidePoint.x - R + r;
    let _y = insidePoint.y < outsidePoint.y ? insidePoint.y + q : insidePoint.y - q;
    log.debug(`sides calc abc89, Q ${Q}, q ${q}, R ${R}, r ${r}`, { _x, _y });
    if (r === 0) {
      _x = outsidePoint.x;
      _y = outsidePoint.y;
    }
    if (R === 0) {
      _x = outsidePoint.x;
    }
    if (Q === 0) {
      _y = outsidePoint.y;
    }
    return { x: _x, y: _y };
  }
}, "intersection");
var cutPathAtIntersect = /* @__PURE__ */ __name((_points, boundaryNode) => {
  log.warn("abc88 cutPathAtIntersect", _points, boundaryNode);
  let points = [];
  let lastPointOutside = _points[0];
  let isInside = false;
  _points.forEach((point2) => {
    log.info("abc88 checking point", point2, boundaryNode);
    if (!outsideNode(boundaryNode, point2) && !isInside) {
      const inter = intersection(boundaryNode, lastPointOutside, point2);
      log.debug("abc88 inside", point2, lastPointOutside, inter);
      log.debug("abc88 intersection", inter, boundaryNode);
      let pointPresent = false;
      points.forEach((p) => {
        pointPresent = pointPresent || p.x === inter.x && p.y === inter.y;
      });
      if (!points.some((e) => e.x === inter.x && e.y === inter.y)) {
        points.push(inter);
      } else {
        log.warn("abc88 no intersect", inter, points);
      }
      isInside = true;
    } else {
      log.warn("abc88 outside", point2, lastPointOutside);
      lastPointOutside = point2;
      if (!isInside) {
        points.push(point2);
      }
    }
  });
  log.debug("returning points", points);
  return points;
}, "cutPathAtIntersect");
function extractCornerPoints(points) {
  const cornerPoints = [];
  const cornerPointPositions = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    if (prev.x === curr.x && curr.y === next.y && Math.abs(curr.x - next.x) > 5 && Math.abs(curr.y - prev.y) > 5) {
      cornerPoints.push(curr);
      cornerPointPositions.push(i);
    } else if (prev.y === curr.y && curr.x === next.x && Math.abs(curr.x - prev.x) > 5 && Math.abs(curr.y - next.y) > 5) {
      cornerPoints.push(curr);
      cornerPointPositions.push(i);
    }
  }
  return { cornerPoints, cornerPointPositions };
}
__name(extractCornerPoints, "extractCornerPoints");
var findAdjacentPoint = /* @__PURE__ */ __name(function(pointA, pointB, distance) {
  const xDiff = pointB.x - pointA.x;
  const yDiff = pointB.y - pointA.y;
  const length = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
  const ratio = distance / length;
  return { x: pointB.x - ratio * xDiff, y: pointB.y - ratio * yDiff };
}, "findAdjacentPoint");
var fixCorners = /* @__PURE__ */ __name(function(lineData) {
  const { cornerPointPositions } = extractCornerPoints(lineData);
  const newLineData = [];
  for (let i = 0; i < lineData.length; i++) {
    if (cornerPointPositions.includes(i)) {
      const prevPoint = lineData[i - 1];
      const nextPoint = lineData[i + 1];
      const cornerPoint = lineData[i];
      const newPrevPoint = findAdjacentPoint(prevPoint, cornerPoint, 5);
      const newNextPoint = findAdjacentPoint(nextPoint, cornerPoint, 5);
      const xDiff = newNextPoint.x - newPrevPoint.x;
      const yDiff = newNextPoint.y - newPrevPoint.y;
      newLineData.push(newPrevPoint);
      const a = Math.sqrt(2) * 2;
      let newCornerPoint = { x: cornerPoint.x, y: cornerPoint.y };
      if (Math.abs(nextPoint.x - prevPoint.x) > 10 && Math.abs(nextPoint.y - prevPoint.y) >= 10) {
        log.debug(
          "Corner point fixing",
          Math.abs(nextPoint.x - prevPoint.x),
          Math.abs(nextPoint.y - prevPoint.y)
        );
        const r = 5;
        if (cornerPoint.x === newPrevPoint.x) {
          newCornerPoint = {
            x: xDiff < 0 ? newPrevPoint.x - r + a : newPrevPoint.x + r - a,
            y: yDiff < 0 ? newPrevPoint.y - a : newPrevPoint.y + a
          };
        } else {
          newCornerPoint = {
            x: xDiff < 0 ? newPrevPoint.x - a : newPrevPoint.x + a,
            y: yDiff < 0 ? newPrevPoint.y - r + a : newPrevPoint.y + r - a
          };
        }
      } else {
        log.debug(
          "Corner point skipping fixing",
          Math.abs(nextPoint.x - prevPoint.x),
          Math.abs(nextPoint.y - prevPoint.y)
        );
      }
      newLineData.push(newCornerPoint, newNextPoint);
    } else {
      newLineData.push(lineData[i]);
    }
  }
  return newLineData;
}, "fixCorners");
var generateDashArray = /* @__PURE__ */ __name((len, oValueS, oValueE) => {
  const middleLength = len - oValueS - oValueE;
  const dashLength = 2;
  const gapLength = 2;
  const dashGapPairLength = dashLength + gapLength;
  const rawPairs = Math.floor(middleLength / dashGapPairLength);
  const numberOfPairs = Number.isFinite(rawPairs) ? Math.max(0, rawPairs) : 0;
  const middlePattern = Array(numberOfPairs).fill(`${dashLength} ${gapLength}`).join(" ");
  const dashArray = `0 ${oValueS} ${middlePattern} ${oValueE}`;
  return dashArray;
}, "generateDashArray");
var insertEdge = /* @__PURE__ */ __name(function(elem, edge, clusterDb, diagramType, startNode, endNode, diagramId, skipIntersect = false, layoutAlgorithm = void 0) {
  if (!diagramId) {
    throw new Error(
      `insertEdge: missing diagramId for edge "${edge.id}" \u2014 edge IDs require a diagram prefix for uniqueness`
    );
  }
  const { handDrawnSeed, layout: configuredLayout } = getConfig2();
  const layout = layoutAlgorithm ?? configuredLayout;
  let points = edge.points;
  let pointsHasChanged = false;
  const tail = startNode;
  var head = endNode;
  const edgeClassStyles = [];
  for (const key in edge.cssCompiledStyles) {
    if (isLabelStyle(key)) {
      continue;
    }
    edgeClassStyles.push(edge.cssCompiledStyles[key]);
  }
  if (layout === "swimlane") {
    if (!skipIntersect && head.intersect && tail.intersect && Array.isArray(points) && points.length >= 2) {
      if (points.length === 2) {
        const [first, last] = points;
        points = sharesColumn(first, last) || sharesRow(first, last) ? [tail.intersect(first), head.intersect(last)] : [tail.intersect(last), head.intersect(first)];
      } else {
        const innerPoints = points.slice(1, -1);
        const firstInner = innerPoints[0];
        const lastInner = innerPoints[innerPoints.length - 1];
        const newFirst = tail.intersect(firstInner);
        const originalLast = points[points.length - 1];
        const candidateLast = head.intersect(lastInner);
        const before = innerPoints.at(-2) ?? points[0];
        const newLast = dockFinalPoint(originalLast, lastInner, before, candidateLast);
        const finalPoint = finalDockPoint({
          originalLast,
          lastInner,
          newLast,
          minLength: markerPullBack(edge.arrowTypeEnd)
        });
        const firstIsDuplicate = Math.abs(newFirst.x - firstInner.x) < AXIS_TOLERANCE && Math.abs(newFirst.y - firstInner.y) < AXIS_TOLERANCE;
        const startPoints = firstIsDuplicate ? [] : [newFirst];
        const endPoints = finalPoint ? [finalPoint] : [];
        points = [...startPoints, ...innerPoints, ...endPoints];
      }
    }
    points = orthogonalizeToLabelClippedPoints(edge, points);
  } else if (head.intersect && tail.intersect && !skipIntersect) {
    points = points.slice(1, edge.points.length - 1);
    points.unshift(tail.intersect(points[0]));
    points.push(head.intersect(points[points.length - 1]));
  }
  const pointsStr = btoa(JSON.stringify(points));
  if (edge.toCluster) {
    log.info("to cluster abc88", clusterDb.get(edge.toCluster));
    points = cutPathAtIntersect(edge.points, clusterDb.get(edge.toCluster).node);
    pointsHasChanged = true;
  }
  if (edge.fromCluster) {
    log.debug(
      "from cluster abc88",
      clusterDb.get(edge.fromCluster),
      JSON.stringify(points, null, 2)
    );
    points = cutPathAtIntersect(points.reverse(), clusterDb.get(edge.fromCluster).node).reverse();
    pointsHasChanged = true;
  }
  let lineData = points.filter((p) => !Number.isNaN(p.y));
  const edgeCurveType = resolveEdgeCurveType(edge.curve);
  if (edgeCurveType !== "rounded") {
    lineData = fixCorners(lineData);
  }
  let curve = curveLinear;
  switch (edgeCurveType) {
    case "linear":
      curve = curveLinear;
      break;
    case "basis":
      curve = curveBasis;
      break;
    case "cardinal":
      curve = curveCardinal;
      break;
    case "bumpX":
      curve = curveBumpX;
      break;
    case "bumpY":
      curve = curveBumpY;
      break;
    case "catmullRom":
      curve = curveCatmullRom;
      break;
    case "monotoneX":
      curve = curveMonotoneX;
      break;
    case "monotoneY":
      curve = curveMonotoneY;
      break;
    case "natural":
      curve = curveNatural;
      break;
    case "step":
      curve = curveStep;
      break;
    case "stepAfter":
      curve = curveStepAfter;
      break;
    case "stepBefore":
      curve = curveStepBefore;
      break;
    case "rounded":
      curve = curveLinear;
      break;
    default:
      curve = curveBasis;
  }
  const { x, y } = getLineFunctionsWithOffset(edge);
  const lineFunction = line().x(x).y(y).curve(curve);
  let strokeClasses;
  switch (edge.thickness) {
    case "normal":
      strokeClasses = "edge-thickness-normal";
      break;
    case "thick":
      strokeClasses = "edge-thickness-thick";
      break;
    case "invisible":
      strokeClasses = "edge-thickness-invisible";
      break;
    default:
      strokeClasses = "edge-thickness-normal";
  }
  switch (edge.pattern) {
    case "solid":
      strokeClasses += " edge-pattern-solid";
      break;
    case "dotted":
      strokeClasses += " edge-pattern-dotted";
      break;
    case "dashed":
      strokeClasses += " edge-pattern-dashed";
      break;
    default:
      strokeClasses += " edge-pattern-solid";
  }
  let svgPath;
  let linePath = edgeCurveType === "rounded" ? generateRoundedPath(applyMarkerOffsetsToPoints(lineData, edge), 5) : lineFunction(lineData);
  const edgeStyles = Array.isArray(edge.style) ? edge.style : [edge.style];
  let strokeColor = edgeStyles.find((style) => style?.startsWith("stroke:"));
  let animationClass = "";
  if (edge.animate) {
    animationClass = "edge-animation-fast";
  }
  if (edge.animation) {
    animationClass = "edge-animation-" + edge.animation;
  }
  let animatedEdge = false;
  if (edge.look === "handDrawn") {
    const rc = rough.svg(elem);
    Object.assign([], lineData);
    const svgPathNode = rc.path(linePath, {
      roughness: 0.3,
      seed: handDrawnSeed
    });
    strokeClasses += " transition";
    svgPath = select2(svgPathNode).select("path").attr("id", `${diagramId}-${edge.id}`).attr(
      "class",
      " " + strokeClasses + (edge.classes ? " " + edge.classes : "") + (animationClass ? " " + animationClass : "")
    ).attr("style", edgeStyles ? edgeStyles.reduce((acc, style) => acc + ";" + style, "") : "");
    let d = svgPath.attr("d");
    svgPath.attr("d", d);
    elem.node().appendChild(svgPath.node());
  } else {
    const stylesFromClasses = edgeClassStyles.join(";");
    const styles = edgeStyles ? edgeStyles.reduce((acc, style) => acc + style + ";", "") : "";
    const pathStyle = (stylesFromClasses ? stylesFromClasses + ";" + styles + ";" : styles) + ";" + (edgeStyles ? edgeStyles.reduce((acc, style) => acc + ";" + style, "") : "");
    svgPath = elem.append("path").attr("d", linePath).attr("id", `${diagramId}-${edge.id}`).attr(
      "class",
      " " + strokeClasses + (edge.classes ? " " + edge.classes : "") + (animationClass ? " " + animationClass : "")
    ).attr("style", pathStyle);
    strokeColor = pathStyle.match(/stroke:([^;]+)/)?.[1];
    animatedEdge = edge.animate === true || !!edge.animation || stylesFromClasses.includes("animation");
    const pathNode = svgPath.node();
    const len = typeof pathNode.getTotalLength === "function" ? pathNode.getTotalLength() : 0;
    const oValueS = markerOffsets2[edge.arrowTypeStart] || 0;
    const oValueE = markerOffsets2[edge.arrowTypeEnd] || 0;
    if (edge.look === "neo" && !animatedEdge) {
      const dashArray = edge.pattern === "dotted" || edge.pattern === "dashed" ? generateDashArray(len, oValueS, oValueE) : `0 ${oValueS} ${len - oValueS - oValueE} ${oValueE}`;
      const mOffset = `stroke-dasharray: ${dashArray}; stroke-dashoffset: 0;`;
      svgPath.attr("style", mOffset + svgPath.attr("style"));
    }
  }
  svgPath.attr("data-edge", true);
  svgPath.attr("data-et", "edge");
  svgPath.attr("data-id", edge.id);
  svgPath.attr("data-points", pointsStr);
  svgPath.attr("data-look", handleUndefinedAttr(edge.look));
  if (edge.step !== void 0) {
    const { themeVariables } = getConfig2();
    const stepColor = strokeColor ?? themeVariables?.lineColor;
    insertEdgeStepMarks(elem, edge, linePath, diagramId, {
      points: lineData,
      pathNode: svgPath.node(),
      color: stepColor,
      textColors: [themeVariables?.background, themeVariables?.primaryTextColor]
    });
  }
  if (edge.showPoints) {
    lineData.forEach((point3) => {
      elem.append("circle").style("stroke", "red").style("fill", "red").attr("r", 1).attr("cx", point3.x).attr("cy", point3.y);
    });
  }
  let url = "";
  if (getConfig2().flowchart.arrowMarkerAbsolute || getConfig2().state.arrowMarkerAbsolute) {
    url = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.search;
    url = url.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }
  log.info("arrowTypeStart", edge.arrowTypeStart);
  log.info("arrowTypeEnd", edge.arrowTypeEnd);
  const useMargin = !animatedEdge && edge?.look === "neo";
  addEdgeMarkers(svgPath, edge, url, diagramId, diagramType, useMargin, strokeColor);
  const midIndex = Math.floor(points.length / 2);
  const point2 = points[midIndex];
  if (!utils_default.isLabelCoordinateInPath(point2, svgPath.attr("d"))) {
    pointsHasChanged = true;
  }
  let paths = {};
  if (pointsHasChanged) {
    paths.updatedPath = points;
  }
  paths.originalPath = edge.points;
  return paths;
}, "insertEdge");
function generateRoundedPath(points, radius) {
  if (points.length < 2) {
    return "";
  }
  let path = "";
  const size = points.length;
  const epsilon = 1e-5;
  for (let i = 0; i < size; i++) {
    const currPoint = points[i];
    const prevPoint = points[i - 1];
    const nextPoint = points[i + 1];
    if (i === 0) {
      path += `M${currPoint.x},${currPoint.y}`;
    } else if (i === size - 1) {
      path += `L${currPoint.x},${currPoint.y}`;
    } else {
      const dx1 = currPoint.x - prevPoint.x;
      const dy1 = currPoint.y - prevPoint.y;
      const dx2 = nextPoint.x - currPoint.x;
      const dy2 = nextPoint.y - currPoint.y;
      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);
      if (len1 < epsilon || len2 < epsilon) {
        path += `L${currPoint.x},${currPoint.y}`;
        continue;
      }
      const nx1 = dx1 / len1;
      const ny1 = dy1 / len1;
      const nx2 = dx2 / len2;
      const ny2 = dy2 / len2;
      const dot = nx1 * nx2 + ny1 * ny2;
      const clampedDot = Math.max(-1, Math.min(1, dot));
      const angle = Math.acos(clampedDot);
      if (angle < epsilon || Math.abs(Math.PI - angle) < epsilon) {
        path += `L${currPoint.x},${currPoint.y}`;
        continue;
      }
      const cutLen = Math.min(radius / Math.sin(angle / 2), len1 / 2, len2 / 2);
      const startX = currPoint.x - nx1 * cutLen;
      const startY = currPoint.y - ny1 * cutLen;
      const endX = currPoint.x + nx2 * cutLen;
      const endY = currPoint.y + ny2 * cutLen;
      path += `L${startX},${startY}`;
      path += `Q${currPoint.x},${currPoint.y} ${endX},${endY}`;
    }
  }
  return path;
}
__name(generateRoundedPath, "generateRoundedPath");
function calculateDeltaAndAngle2(point1, point2) {
  if (!point1 || !point2) {
    return { angle: 0, deltaX: 0, deltaY: 0 };
  }
  const deltaX = point2.x - point1.x;
  const deltaY = point2.y - point1.y;
  const angle = Math.atan2(deltaY, deltaX);
  return { angle, deltaX, deltaY };
}
__name(calculateDeltaAndAngle2, "calculateDeltaAndAngle");
function applyMarkerOffsetsToPoints(points, edge) {
  const newPoints = points.map((point2) => ({ ...point2 }));
  if (points.length >= 2 && markerOffsets[edge.arrowTypeStart]) {
    const offsetValue = markerOffsets[edge.arrowTypeStart];
    const point1 = points[0];
    const point2 = points[1];
    const { angle } = calculateDeltaAndAngle2(point1, point2);
    const offsetX = offsetValue * Math.cos(angle);
    const offsetY = offsetValue * Math.sin(angle);
    newPoints[0].x = point1.x + offsetX;
    newPoints[0].y = point1.y + offsetY;
  }
  const n = points.length;
  if (n >= 2 && markerOffsets[edge.arrowTypeEnd]) {
    const offsetValue = markerOffsets[edge.arrowTypeEnd];
    const point1 = points[n - 1];
    const point2 = points[n - 2];
    const { angle } = calculateDeltaAndAngle2(point2, point1);
    const offsetX = offsetValue * Math.cos(angle);
    const offsetY = offsetValue * Math.sin(angle);
    newPoints[n - 1].x = point1.x - offsetX;
    newPoints[n - 1].y = point1.y - offsetY;
  }
  return newPoints;
}
__name(applyMarkerOffsetsToPoints, "applyMarkerOffsetsToPoints");

// src/rendering-util/rendering-elements/markers.js
var insertMarkers = /* @__PURE__ */ __name((elem, markerArray, type, id) => {
  markerArray.forEach((markerName) => {
    markers[markerName](elem, type, id);
  });
}, "insertMarkers");
var extension = /* @__PURE__ */ __name((elem, type, id) => {
  log.trace("Making markers for ", id);
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-extensionStart").attr("class", "marker extension " + type).attr("refX", 18).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 1,7 L18,13 V 1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-extensionEnd").attr("class", "marker extension " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 1,1 V 13 L18,7 Z");
  elem.append("marker").attr("id", id + "_" + type + "-extensionStart-margin").attr("class", "marker extension " + type).attr("refX", 18).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("viewBox", "0 0 20 14").append("polygon").attr("points", "10,7 18,13 18,1").style("stroke-width", 2).style("stroke-dasharray", "0");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-extensionEnd-margin").attr("class", "marker extension " + type).attr("refX", 9).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("viewBox", "0 0 20 14").append("polygon").attr("points", "10,1 10,13 18,7").style("stroke-width", 2).style("stroke-dasharray", "0");
}, "extension");
var composition = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-compositionStart").attr("class", "marker composition " + type).attr("refX", 18).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-compositionEnd").attr("class", "marker composition " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-compositionStart-margin").attr("class", "marker composition " + type).attr("refX", 15).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("viewBox", "0 0 15 15").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-compositionEnd-margin").attr("class", "marker composition " + type).attr("refX", 3.5).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
}, "composition");
var aggregation = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-aggregationStart").attr("class", "marker aggregation " + type).attr("refX", 18).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-aggregationEnd").attr("class", "marker aggregation " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-aggregationStart-margin").attr("class", "marker aggregation " + type).attr("refX", 15).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 2).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-aggregationEnd-margin").attr("class", "marker aggregation " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 2).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
}, "aggregation");
var dependency = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-dependencyStart").attr("class", "marker dependency " + type).attr("refX", 6).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 5,7 L9,13 L1,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-dependencyEnd").attr("class", "marker dependency " + type).attr("refX", 13).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 18,7 L9,13 L14,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-dependencyStart-margin").attr("class", "marker dependency " + type).attr("refX", 4).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 5,7 L9,13 L1,7 L9,1 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-dependencyEnd-margin").attr("class", "marker dependency " + type).attr("refX", 16).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 18,7 L9,13 L14,7 L9,1 Z");
}, "dependency");
var lollipop = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-lollipopStart").attr("class", "marker lollipop " + type).attr("refX", 13).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6);
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-lollipopEnd").attr("class", "marker lollipop " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6);
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-lollipopStart-margin").attr("class", "marker lollipop " + type).attr("refX", 13).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6).attr("stroke-width", 2);
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-lollipopEnd-margin").attr("class", "marker lollipop " + type).attr("refX", 1).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6).attr("stroke-width", 2);
}, "lollipop");
var point = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("marker").attr("id", id + "_" + type + "-pointEnd").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", 5).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 8).attr("markerHeight", 8).attr("orient", "auto").append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0");
  elem.append("marker").attr("id", id + "_" + type + "-pointStart").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", 4.5).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 8).attr("markerHeight", 8).attr("orient", "auto").append("path").attr("d", "M 0 5 L 10 10 L 10 0 z").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0");
  elem.append("marker").attr("id", id + "_" + type + "-pointEnd-margin").attr("class", "marker " + type).attr("viewBox", "0 0 11.5 14").attr("refX", 11.5).attr("refY", 7).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 10.5).attr("markerHeight", 14).attr("orient", "auto").append("path").attr("d", "M 0 0 L 11.5 7 L 0 14 z").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
  elem.append("marker").attr("id", id + "_" + type + "-pointStart-margin").attr("class", "marker " + type).attr("viewBox", "0 0 11.5 14").attr("refX", 1).attr("refY", 7).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11.5).attr("markerHeight", 14).attr("orient", "auto").append("polygon").attr("points", "0,7 11.5,14 11.5,0").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
}, "point");
var circle = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("marker").attr("id", id + "_" + type + "-circleEnd").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", 11).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0");
  elem.append("marker").attr("id", id + "_" + type + "-circleStart").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", -1).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0");
  elem.append("marker").attr("id", id + "_" + type + "-circleEnd-margin").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refY", 5).attr("refX", 12.25).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 14).attr("markerHeight", 14).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
  elem.append("marker").attr("id", id + "_" + type + "-circleStart-margin").attr("class", "marker " + type).attr("viewBox", "0 0 10 10").attr("refX", -2).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 14).attr("markerHeight", 14).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
}, "circle");
var cross = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("marker").attr("id", id + "_" + type + "-crossEnd").attr("class", "marker cross " + type).attr("viewBox", "0 0 11 11").attr("refX", 12).attr("refY", 5.2).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("path").attr("d", "M 1,1 l 9,9 M 10,1 l -9,9").attr("class", "arrowMarkerPath").style("stroke-width", 2).style("stroke-dasharray", "1,0");
  elem.append("marker").attr("id", id + "_" + type + "-crossStart").attr("class", "marker cross " + type).attr("viewBox", "0 0 11 11").attr("refX", -1).attr("refY", 5.2).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("path").attr("d", "M 1,1 l 9,9 M 10,1 l -9,9").attr("class", "arrowMarkerPath").style("stroke-width", 2).style("stroke-dasharray", "1,0");
  elem.append("marker").attr("id", id + "_" + type + "-crossEnd-margin").attr("class", "marker cross " + type).attr("viewBox", "0 0 15 15").attr("refX", 17.7).attr("refY", 7.5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 12).attr("orient", "auto").append("path").attr("d", "M 1,1 L 14,14 M 1,14 L 14,1").attr("class", "arrowMarkerPath").style("stroke-width", 2.5);
  elem.append("marker").attr("id", id + "_" + type + "-crossStart-margin").attr("class", "marker cross " + type).attr("viewBox", "0 0 15 15").attr("refX", -3.5).attr("refY", 7.5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 12).attr("orient", "auto").append("path").attr("d", "M 1,1 L 14,14 M 1,14 L 14,1").attr("class", "arrowMarkerPath").style("stroke-width", 2.5).style("stroke-dasharray", "1,0");
}, "cross");
var barb = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-barbEnd").attr("refX", 19).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M 19,7 L9,13 L14,7 L9,1 Z");
}, "barb");
var barbNeo = /* @__PURE__ */ __name((elem, type, id) => {
  const config = getConfig();
  const { themeVariables } = config;
  const { transitionColor } = themeVariables;
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-barbEnd").attr("refX", 19).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "strokeWidth").attr("orient", "auto").append("path").attr("d", "M 19,7 L11,14 L13,7 L11,0 Z");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-barbEnd-margin").attr("refX", 17).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M 19,7 L11,14 L13,7 L11,0 Z").attr("fill", `${transitionColor}`);
}, "barbNeo");
var only_one = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-onlyOneStart").attr("class", "marker onlyOne " + type).attr("refX", 0).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").append("path").attr("d", "M9,0 L9,18 M15,0 L15,18");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-onlyOneEnd").attr("class", "marker onlyOne " + type).attr("refX", 18).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").append("path").attr("d", "M3,0 L3,18 M9,0 L9,18");
}, "only_one");
var zero_or_one = /* @__PURE__ */ __name((elem, type, id) => {
  const startMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrOneStart").attr("class", "marker zeroOrOne " + type).attr("refX", 0).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto");
  startMarker.append("circle").attr("fill", "white").attr("cx", 21).attr("cy", 9).attr("r", 6);
  startMarker.append("path").attr("d", "M9,0 L9,18");
  const endMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrOneEnd").attr("class", "marker zeroOrOne " + type).attr("refX", 30).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto");
  endMarker.append("circle").attr("fill", "white").attr("cx", 9).attr("cy", 9).attr("r", 6);
  endMarker.append("path").attr("d", "M21,0 L21,18");
}, "zero_or_one");
var one_or_more = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-oneOrMoreStart").attr("class", "marker oneOrMore " + type).attr("refX", 18).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").append("path").attr("d", "M0,18 Q 18,0 36,18 Q 18,36 0,18 M42,9 L42,27");
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-oneOrMoreEnd").attr("class", "marker oneOrMore " + type).attr("refX", 27).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").append("path").attr("d", "M3,9 L3,27 M9,18 Q27,0 45,18 Q27,36 9,18");
}, "one_or_more");
var zero_or_more = /* @__PURE__ */ __name((elem, type, id) => {
  const startMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrMoreStart").attr("class", "marker zeroOrMore " + type).attr("refX", 18).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto");
  startMarker.append("circle").attr("fill", "white").attr("cx", 48).attr("cy", 18).attr("r", 6);
  startMarker.append("path").attr("d", "M0,18 Q18,0 36,18 Q18,36 0,18");
  const endMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrMoreEnd").attr("class", "marker zeroOrMore " + type).attr("refX", 39).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto");
  endMarker.append("circle").attr("fill", "white").attr("cx", 9).attr("cy", 18).attr("r", 6);
  endMarker.append("path").attr("d", "M21,18 Q39,0 57,18 Q39,36 21,18");
}, "zero_or_more");
var only_one_neo = /* @__PURE__ */ __name((elem, type, id) => {
  const config = getConfig();
  const { themeVariables } = config;
  const { strokeWidth } = themeVariables;
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-onlyOneStart").attr("class", "marker onlyOne " + type).attr("refX", 0).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M9,0 L9,18 M15,0 L15,18").attr("stroke-width", `${strokeWidth}`);
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-onlyOneEnd").attr("class", "marker onlyOne " + type).attr("refX", 18).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M3,0 L3,18 M9,0 L9,18").attr("stroke-width", `${strokeWidth}`);
}, "only_one_neo");
var zero_or_one_neo = /* @__PURE__ */ __name((elem, type, id) => {
  const config = getConfig();
  const { themeVariables } = config;
  const { strokeWidth, mainBkg } = themeVariables;
  const startMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrOneStart").attr("class", "marker zeroOrOne " + type).attr("refX", 0).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse");
  startMarker.append("circle").attr("fill", mainBkg ?? "white").attr("cx", 21).attr("cy", 9).attr("stroke-width", `${strokeWidth}`).attr("r", 6);
  startMarker.append("path").attr("d", "M9,0 L9,18").attr("stroke-width", `${strokeWidth}`);
  const endMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrOneEnd").attr("class", "marker zeroOrOne " + type).attr("refX", 30).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto");
  endMarker.append("circle").attr("fill", mainBkg ?? "white").attr("cx", 9).attr("cy", 9).attr("stroke-width", `${strokeWidth}`).attr("r", 6);
  endMarker.append("path").attr("d", "M21,0 L21,18").attr("stroke-width", `${strokeWidth}`);
}, "zero_or_one_neo");
var one_or_more_neo = /* @__PURE__ */ __name((elem, type, id) => {
  const config = getConfig();
  const { themeVariables } = config;
  const { strokeWidth } = themeVariables;
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-oneOrMoreStart").attr("class", "marker oneOrMore " + type).attr("refX", 18).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M0,18 Q 18,0 36,18 Q 18,36 0,18 M42,9 L42,27").attr("stroke-width", `${strokeWidth}`);
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-oneOrMoreEnd").attr("class", "marker oneOrMore " + type).attr("refX", 27).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M3,9 L3,27 M9,18 Q27,0 45,18 Q27,36 9,18").attr("stroke-width", `${strokeWidth}`);
}, "one_or_more_neo");
var zero_or_more_neo = /* @__PURE__ */ __name((elem, type, id) => {
  const config = getConfig();
  const { themeVariables } = config;
  const { strokeWidth, mainBkg } = themeVariables;
  const startMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrMoreStart").attr("class", "marker zeroOrMore " + type).attr("refX", 18).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto");
  startMarker.append("circle").attr("fill", mainBkg ?? "white").attr("cx", 45.5).attr("cy", 18).attr("r", 6).attr("stroke-width", `${strokeWidth}`);
  startMarker.append("path").attr("d", "M0,18 Q18,0 36,18 Q18,36 0,18").attr("stroke-width", `${strokeWidth}`);
  const endMarker = elem.append("defs").append("marker").attr("id", id + "_" + type + "-zeroOrMoreEnd").attr("class", "marker zeroOrMore " + type).attr("refX", 39).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse");
  endMarker.append("circle").attr("fill", mainBkg ?? "white").attr("cx", 11).attr("cy", 18).attr("r", 6).attr("stroke-width", `${strokeWidth}`);
  endMarker.append("path").attr("d", "M21,18 Q39,0 57,18 Q39,36 21,18").attr("stroke-width", `${strokeWidth}`);
}, "zero_or_more_neo");
var requirement_arrow = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-requirement_arrowEnd").attr("refX", 20).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").append("path").attr(
    "d",
    `M0,0
      L20,10
      M20,10
      L0,20`
  );
}, "requirement_arrow");
var requirement_arrow_neo = /* @__PURE__ */ __name((elem, type, id) => {
  const config = getConfig();
  const { themeVariables } = config;
  const { strokeWidth } = themeVariables;
  elem.append("defs").append("marker").attr("id", id + "_" + type + "-requirement_arrowEnd").attr("refX", 20).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("stroke-width", `${strokeWidth}`).attr("viewBox", "0 0 25 20").append("path").attr(
    "d",
    `M0,0
      L20,10
      M20,10
      L0,20`
  ).attr("stroke-linejoin", "miter");
}, "requirement_arrow_neo");
var requirement_contains = /* @__PURE__ */ __name((elem, type, id) => {
  const containsNode = elem.append("defs").append("marker").attr("id", id + "_" + type + "-requirement_containsStart").attr("refX", 0).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").append("g");
  containsNode.append("circle").attr("cx", 10).attr("cy", 10).attr("r", 9).attr("fill", "none");
  containsNode.append("line").attr("x1", 1).attr("x2", 19).attr("y1", 10).attr("y2", 10);
  containsNode.append("line").attr("y1", 1).attr("y2", 19).attr("x1", 10).attr("x2", 10);
}, "requirement_contains");
var requirement_contains_neo = /* @__PURE__ */ __name((elem, type, id) => {
  const config = getConfig();
  const { themeVariables } = config;
  const { strokeWidth } = themeVariables;
  const containsNode = elem.append("defs").append("marker").attr("id", id + "_" + type + "-requirement_containsStart").attr("refX", 0).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("g");
  containsNode.append("circle").attr("cx", 10).attr("cy", 10).attr("r", 9).attr("fill", "none");
  containsNode.append("line").attr("x1", 1).attr("x2", 19).attr("y1", 10).attr("y2", 10);
  containsNode.append("line").attr("y1", 1).attr("y2", 19).attr("x1", 10).attr("x2", 10);
  containsNode.selectAll("*").attr("stroke-width", `${strokeWidth}`);
}, "requirement_contains_neo");
var hierarchy = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("marker").attr("id", id + "_" + type + "-hierarchyEnd").attr("class", "marker hierarchy " + type).attr("viewBox", "0 0 12 10").attr("refX", 10).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 10).attr("orient", "auto").append("path").attr("d", "M 0 0 L 6 5 L 0 10 M 4 0 L 10 5 L 4 10").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0").style("fill", "none");
  elem.append("marker").attr("id", id + "_" + type + "-hierarchyStart").attr("class", "marker hierarchy " + type).attr("viewBox", "0 0 12 10").attr("refX", 2).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 10).attr("orient", "auto").append("path").attr("d", "M 12 0 L 6 5 L 12 10 M 8 0 L 2 5 L 8 10").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0").style("fill", "none");
}, "hierarchy");
var openArrow = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("marker").attr("id", id + "_" + type + "-openArrowEnd").attr("class", "marker openArrow " + type).attr("viewBox", "0 0 12 12").attr("refX", 11).attr("refY", 6).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 12).attr("orient", "auto").append("path").attr("d", "M 1 1 L 11 6 L 1 11").attr("class", "arrowMarkerPath").style("stroke-width", 1.4).style("stroke-linecap", "round").style("stroke-linejoin", "round").style("stroke-dasharray", "1,0").style("fill", "none");
  elem.append("marker").attr("id", id + "_" + type + "-openArrowStart").attr("class", "marker openArrow " + type).attr("viewBox", "0 0 12 12").attr("refX", 1).attr("refY", 6).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 12).attr("orient", "auto").append("path").attr("d", "M 11 1 L 1 6 L 11 11").attr("class", "arrowMarkerPath").style("stroke-width", 1.4).style("stroke-linecap", "round").style("stroke-linejoin", "round").style("stroke-dasharray", "1,0").style("fill", "none");
}, "openArrow");
var hollowCircle = /* @__PURE__ */ __name((elem, type, id) => {
  elem.append("marker").attr("id", id + "_" + type + "-hollowCircleStart").attr("class", "marker hollowCircle " + type).attr("viewBox", "0 0 10 10").attr("refX", 0).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 10).attr("markerHeight", 10).attr("orient", "auto").append("circle").attr("cx", 5).attr("cy", 5).attr("r", 3.6).attr("class", "arrowMarkerPath").style("stroke-width", 1.4).style("stroke-dasharray", "1,0").style("fill", "none");
  elem.append("marker").attr("id", id + "_" + type + "-hollowCircleEnd").attr("class", "marker hollowCircle " + type).attr("viewBox", "0 0 10 10").attr("refX", 10).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 10).attr("markerHeight", 10).attr("orient", "auto").append("circle").attr("cx", 5).attr("cy", 5).attr("r", 3.6).attr("class", "arrowMarkerPath").style("stroke-width", 1.4).style("stroke-dasharray", "1,0").style("fill", "none");
}, "hollowCircle");
var markers = {
  extension,
  composition,
  aggregation,
  dependency,
  lollipop,
  point,
  circle,
  cross,
  barb,
  barbNeo,
  hierarchy,
  only_one,
  zero_or_one,
  one_or_more,
  zero_or_more,
  only_one_neo,
  zero_or_one_neo,
  one_or_more_neo,
  zero_or_more_neo,
  requirement_arrow,
  requirement_contains,
  requirement_arrow_neo,
  requirement_contains_neo,
  openArrow,
  hollowCircle
};
var markers_default = insertMarkers;

export {
  getStepDuration,
  isStepEdge,
  markerOffsets,
  markerOffsets2,
  placeQueuedStepBadges,
  edgeLabels,
  terminalLabels,
  clear,
  hasEdgeLabel,
  insertEdgeLabel,
  resolveEdgeLabelPosition,
  positionEdgeLabel,
  insertEdge,
  markers_default
};
