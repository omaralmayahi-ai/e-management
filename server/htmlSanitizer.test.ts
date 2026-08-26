import { describe, it, expect } from "vitest";
import { sanitizeHtmlContent } from "./htmlSanitizer";

describe("sanitizeHtmlContent", () => {
  it("removes <script> tags entirely", () => {
    const dirty = "<p>Hello</p><script>alert('xss')</script>";
    const clean = sanitizeHtmlContent(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/alert/);
    expect(clean).toMatch(/<p>Hello<\/p>/);
  });

  it("removes <iframe> tags entirely", () => {
    const dirty = '<div>x</div><iframe src="https://evil.example"></iframe>';
    const clean = sanitizeHtmlContent(dirty);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).toMatch(/<div>x<\/div>/);
  });

  it("strips onerror and other event handler attributes", () => {
    const dirty = '<img src="x" onerror="alert(1)" />';
    const clean = sanitizeHtmlContent(dirty);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/alert/);
  });

  it("strips javascript: hrefs", () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = sanitizeHtmlContent(dirty);
    expect(clean).not.toMatch(/javascript:/i);
  });

  it("preserves safe table markup", () => {
    const dirty = "<table><tbody><tr><td>cell</td></tr></tbody></table>";
    const clean = sanitizeHtmlContent(dirty);
    expect(clean).toMatch(/<table>/);
    expect(clean).toMatch(/<td>cell<\/td>/);
  });

  it("preserves safe inline style and strips dangerous declarations", () => {
    const dirty = '<p style="color: red; background: url(javascript:alert(1))">x</p>';
    const clean = sanitizeHtmlContent(dirty);
    expect(clean).toMatch(/color: red/);
    expect(clean).not.toMatch(/javascript/i);
    expect(clean).not.toMatch(/url\(/i);
  });

  it("returns empty string for non-string inputs", () => {
    expect(sanitizeHtmlContent(null)).toBe("");
    expect(sanitizeHtmlContent(undefined)).toBe("");
    expect(sanitizeHtmlContent(123)).toBe("");
  });
});
