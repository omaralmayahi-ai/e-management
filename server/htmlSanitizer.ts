import createDOMPurify from "isomorphic-dompurify";

const DOMPurify = createDOMPurify;

const SAFE_CSS_PROPS = new Set([
  "color", "background-color", "background",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-width", "border-style", "border-collapse", "border-spacing",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "text-align", "text-decoration", "text-indent", "text-transform",
  "font-weight", "font-size", "font-family", "font-style",
  "line-height", "letter-spacing", "white-space", "word-wrap", "word-break",
  "width", "height", "min-width", "max-width", "min-height", "max-height",
  "vertical-align", "table-layout",
  "display", "list-style", "list-style-type",
]);

const SAFE_DISPLAY_VALUES = new Set([
  "inline", "inline-block", "block", "table", "table-row", "table-cell", "list-item", "none",
]);

function sanitizeStyle(style: string): string {
  return style
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const idx = rule.indexOf(":");
      if (idx < 0) return null;
      const prop = rule.slice(0, idx).trim().toLowerCase();
      const val = rule.slice(idx + 1).trim();
      if (!SAFE_CSS_PROPS.has(prop)) return null;
      if (/url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|position\s*:/i.test(val)) return null;
      if (prop === "display" && !SAFE_DISPLAY_VALUES.has(val.toLowerCase())) return null;
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join("; ");
}

let hookInstalled = false;
function ensureHook() {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style") {
      data.attrValue = sanitizeStyle(data.attrValue || "");
      if (!data.attrValue) data.keepAttr = false;
    }
  });
}
ensureHook();

const SANITIZE_CONFIG = {
  ADD_TAGS: [
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "hr",
    "svg", "rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "g", "text",
    "defs", "marker", "use",
  ],
  ADD_ATTR: [
    "style", "target", "rel", "colspan", "rowspan", "align", "valign", "width", "height",
    "cellpadding", "cellspacing", "border", "viewBox", "fill", "stroke", "stroke-width",
    "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "x", "y", "x1", "y1", "x2", "y2",
    "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "preserveAspectRatio",
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image\/(?:png|jpe?g|gif|webp|svg\+xml));|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeHtmlContent(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input !== "string") return "";
  return DOMPurify.sanitize(input, SANITIZE_CONFIG);
}
