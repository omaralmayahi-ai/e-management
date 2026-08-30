import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
// quill1-table registers Table/TR/TD blots so cells survive Quill's normalization
// and provides handlers for add/remove/merge/split that work via the toolbar module.
import TableModule from "quill1-table";
import type QuillType from "quill";
import type { RangeStatic } from "quill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/queryClient";
import {
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Trash2,
  Combine,
  Split,
  Table as TableIcon,
  Undo2,
  Redo2,
  Eraser,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  testId?: string;
}

const SHAPES = [
  { name: "مستطيل", svg: '<svg width="40" height="30" viewBox="0 0 40 30" style="display:inline-block;vertical-align:middle;margin:0 2px"><rect x="2" y="2" width="36" height="26" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "دائرة", svg: '<svg width="32" height="32" viewBox="0 0 32 32" style="display:inline-block;vertical-align:middle;margin:0 2px"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "مثلث", svg: '<svg width="32" height="32" viewBox="0 0 32 32" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="16,2 30,28 2,28" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "معيّن", svg: '<svg width="32" height="32" viewBox="0 0 32 32" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="16,2 30,16 16,30 2,16" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "نجمة", svg: '<svg width="32" height="32" viewBox="0 0 32 32" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="16,2 19,12 30,12 21,18 25,28 16,22 7,28 11,18 2,12 13,12" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "سهم →", svg: '<svg width="40" height="20" viewBox="0 0 40 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><path d="M2 10 L34 10 M34 10 L26 4 M34 10 L26 16" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "سهم ←", svg: '<svg width="40" height="20" viewBox="0 0 40 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><path d="M38 10 L6 10 M6 10 L14 4 M6 10 L14 16" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "سهم ↑", svg: '<svg width="20" height="40" viewBox="0 0 20 40" style="display:inline-block;vertical-align:middle;margin:0 2px"><path d="M10 38 L10 6 M10 6 L4 14 M10 6 L16 14" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "سهم ↓", svg: '<svg width="20" height="40" viewBox="0 0 20 40" style="display:inline-block;vertical-align:middle;margin:0 2px"><path d="M10 2 L10 34 M10 34 L4 26 M10 34 L16 26" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
  { name: "صح ✓", svg: '<svg width="24" height="24" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;color:#10b981;margin:0 2px"><path d="M4 12 L10 18 L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: "خطأ ✗", svg: '<svg width="24" height="24" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;color:#ef4444;margin:0 2px"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>' },
  { name: "خط فاصل", svg: '<svg width="80" height="2" viewBox="0 0 80 2" style="display:inline-block;vertical-align:middle;margin:0 2px"><line x1="0" y1="1" x2="80" y2="1" stroke="currentColor" stroke-width="2"/></svg>' },
];

let toolbarCounter = 0;

// --- Minimal local interfaces over Quill internals we touch ---------------
// These avoid `any` while staying narrowly scoped to what we actually call.
type TableActionValue =
  | `newtable_${number}_${number}`
  | "append-row-above"
  | "append-row-below"
  | "append-col-before"
  | "append-col-after"
  | "remove-row"
  | "remove-col"
  | "remove-cell"
  | "remove-table"
  | "merge-selection"
  | "split-cell"
  | "undo"
  | "redo";

type KeyBindingContext = { format: Record<string, unknown>; collapsed: boolean; offset: number };

interface ToolbarModule {
  handlers: Record<string, ((value?: unknown) => unknown) | undefined>;
}

interface QuillSelectionInternal {
  update: (source: "user" | "api" | "silent") => void;
}

interface EditorWithSelectionInternal extends QuillType {
  selection: QuillSelectionInternal;
}

// quill1-table extends Quill's static API with a keyboard handler we need to
// wire into the editor's keyboard module.
interface TableModuleStatics {
  register: () => void;
  keyboardHandler: (
    quill: QuillType,
    key: "backspace" | "delete" | "undo" | "redo" | "tab" | "shiftTab",
    range: RangeStatic | null,
    keycontext: KeyBindingContext
  ) => boolean;
}

const TableModuleApi = TableModule as unknown as TableModuleStatics & {
  new (...args: unknown[]): unknown;
};

// --- Module registration --------------------------------------------------
// Track the registration result so insert/edit operations can fail loudly
// instead of silently doing nothing if registration ever throws.
let tableModuleRegistration:
  | { state: "ok" }
  | { state: "failed"; error: unknown }
  | { state: "pending" } = { state: "pending" };

function ensureTableModuleRegistered() {
  if (tableModuleRegistration.state !== "pending") return tableModuleRegistration;
  try {
    // 1. Run TableModule.register once with try-catch so all blot classes are instantiated
    try {
      TableModuleApi.register();
    } catch {
      // Ignore if initial register encountered uninitialized Parchment state
    }

    // 2. Fetch the registered blots from Quill
    const TableBlot = Quill.import("formats/table") as any;
    const TDBlot = Quill.import("formats/td") as any;
    const TRBlot = Quill.import("formats/tr") as any;
    const ContainBlot = Quill.import("formats/contain") as any;
    const Container = Quill.import("blots/container") as any;
    const Block = Quill.import("blots/block") as any;

    // 3. Patch TableBlot.create safely preserving Parchment blot bindings
    if (TableBlot) {
      const origTableCreate = TableBlot.create;
      TableBlot.create = function (value?: any) {
        const str = typeof value === "string" ? value : (value ? String(value) : "");
        const parts = str ? str.split("|") : [];
        const tableId = parts[0] || ("tbl_" + Math.random().toString(36).substring(2, 9));
        const hideBorder = parts[1] === "true";
        const safeVal = `${tableId}|${hideBorder}`;
        let node: HTMLElement;
        try {
          if (typeof origTableCreate === "function" && origTableCreate !== TableBlot.create) {
            node = origTableCreate.call(this, safeVal);
          } else if (Container && typeof Container.create === "function") {
            node = Container.create.call(this, "table");
          } else {
            node = document.createElement("table");
          }
        } catch {
          node = Container ? Container.create.call(this, "table") : document.createElement("table");
        }
        node.setAttribute("table_id", tableId);
        if (hideBorder) node.classList.add("ql-editor__table--hideBorder");
        return node;
      };
    }

    // 4. Patch TDBlot.create safely preserving Parchment blot bindings
    if (TDBlot) {
      const origTdCreate = TDBlot.create;
      TDBlot.create = function (value?: any) {
        const str = typeof value === "string" ? value : (value ? String(value) : "");
        const r = str ? str.split("|") : [];
        const tableId = r[0] || ("tbl_" + Math.random().toString(36).substring(2, 9));
        const rowId = r[1] || ("row_" + Math.random().toString(36).substring(2, 9));
        const cellId = r[2] || ("c_" + Math.random().toString(36).substring(2, 9));
        const mergeId = r[3] && r[3] !== "undefined" && r[3] !== "null" ? r[3] : "";
        const colspan = r[4] && r[4] !== "undefined" && r[4] !== "null" ? r[4] : "";
        const rowspan = r[5] && r[5] !== "undefined" && r[5] !== "null" ? r[5] : "";
        const hideBorder = r[6] && r[6] !== "undefined" && r[6] !== "null" ? r[6] : "";
        const safeVal = [tableId, rowId, cellId, mergeId, colspan, rowspan, hideBorder].join("|");
        let node: HTMLElement;
        try {
          if (typeof origTdCreate === "function" && origTdCreate !== TDBlot.create) {
            node = origTdCreate.call(this, safeVal);
          } else if (Block && typeof Block.create === "function") {
            node = Block.create.call(this, "td");
          } else {
            node = document.createElement("td");
          }
        } catch {
          node = Block ? Block.create.call(this, "td") : document.createElement("td");
        }
        node.setAttribute("table_id", tableId);
        node.setAttribute("row_id", rowId);
        node.setAttribute("cell_id", cellId);
        if (mergeId) node.setAttribute("merge_id", mergeId);
        if (colspan) node.setAttribute("colspan", colspan);
        if (rowspan) node.setAttribute("rowspan", rowspan);
        if (hideBorder) node.setAttribute("hide_border", hideBorder);
        return node;
      };
    }

    // 5. Override TableModule.register so that when Quill's module loader invokes it,
    // it always registers our hardened, patched blots instead of the unpatched originals.
    (TableModule as any).register = function () {
      if (TDBlot) Quill.register(TDBlot, true);
      if (TRBlot) Quill.register(TRBlot, true);
      if (TableBlot) Quill.register(TableBlot, true);
      if (ContainBlot) Quill.register(ContainBlot, true);
    };

    // 6. Explicitly register our patched blots and the table module
    if (TDBlot) Quill.register(TDBlot, true);
    if (TRBlot) Quill.register(TRBlot, true);
    if (TableBlot) Quill.register(TableBlot, true);
    if (ContainBlot) Quill.register(ContainBlot, true);
    Quill.register("modules/table", TableModule, true);

    tableModuleRegistration = { state: "ok" };
  } catch (error) {
    tableModuleRegistration = { state: "failed", error };
    console.error("Failed to register quill1-table module", error);
  }
  return tableModuleRegistration;
}
ensureTableModuleRegistered();

interface TableMenuState {
  x: number;
  y: number;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "200px",
  testId,
}: RichTextEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<QuillType | null>(null);
  const isInternalChangeRef = useRef(false);
  const { toast } = useToast();

  // Selection captured the moment the user clicks a toolbar button. The
  // dialog steals focus, so getSelection() inside the confirm handler can
  // return the document end instead of the user's caret. Restore from this.
  const savedRangeRef = useRef<RangeStatic | null>(null);

  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [shapesDialogOpen, setShapesDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [rows, setRows] = useState("3");
  const [cols, setCols] = useState("3");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tableMenu, setTableMenu] = useState<TableMenuState | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const toolbarId = useMemo(() => `rte-toolbar-${++toolbarCounter}`, []);

  const captureSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      savedRangeRef.current = null;
      return;
    }
    // getSelection(false) returns null if the editor isn't focused. We
    // intentionally don't force focus here so we don't move the caret.
    const range = editor.getSelection(false);
    savedRangeRef.current = range ?? null;
  }, []);

  const restoreSelectionForInsertion = useCallback((): RangeStatic => {
    const editor = editorRef.current;
    if (!editor) return { index: 0, length: 0 };
    const saved = savedRangeRef.current;
    if (saved) {
      editor.focus();
      editor.setSelection(saved.index, saved.length, "silent");
      return saved;
    }
    // No saved range — fall back to the editor's current selection (forcing
    // focus) which lands the caret at the document end if needed.
    return editor.getSelection(true);
  }, []);

  const insertAtCursor = (html: string) => {
    const editor = editorRef.current;
    if (!editor || !editor.root) return;
    const range = restoreSelectionForInsertion();
    try {
      editor.clipboard.dangerouslyPasteHTML(range.index, html, "user");
      editor.setSelection(range.index + 1, 0);
    } catch {
      if (editor.root) {
        editor.root.innerHTML += html;
      }
    }
    const currentHtml = editor.root?.innerHTML || "";
    onChangeRef.current?.(currentHtml === "<p><br></p>" ? "" : currentHtml);
  };

  const callTableAction = useCallback(
    (action: TableActionValue): boolean => {
      const editor = editorRef.current;
      if (!editor || !editor.root) return false;

      if (tableModuleRegistration.state !== "ok") {
        toast({
          title: "تعذّر تنفيذ العملية",
          description: "وحدة الجداول لم تُحمَّل. أعد تحميل الصفحة وحاول مجدداً.",
          variant: "destructive",
        });
        return false;
      }

      const toolbar = editor.getModule("toolbar") as ToolbarModule | undefined;
      const handler = toolbar?.handlers?.table;
      if (typeof handler !== "function") {
        toast({
          title: "تعذّر تنفيذ العملية",
          description: "أداة تحرير الجدول غير متاحة في هذا المحرر.",
          variant: "destructive",
        });
        return false;
      }

      try {
        handler.call(toolbar, action);
      } catch (err) {
        console.error("Table action failed", action, err);
        toast({
          title: "فشل تنفيذ عملية الجدول",
          description: "لم يتم تطبيق التغيير. تأكد من وجود المؤشر داخل خلية الجدول.",
          variant: "destructive",
        });
        return false;
      }

      // Most table operations mutate the DOM via Parchment but don't always
      // emit a text-change event that react-quill would forward — sync html.
      const currentHtml = editor.root?.innerHTML || "";
      onChangeRef.current?.(currentHtml === "<p><br></p>" ? "" : currentHtml);
      return true;
    },
    [toast]
  );

  const modules = useMemo(
    () => ({
      toolbar: {
        container: `#${toolbarId}`,
        handlers: {
          table: () => {
            captureSelection();
            setRows("3");
            setCols("3");
            setTableDialogOpen(true);
          },
          "table-insert": () => {
            captureSelection();
            setRows("3");
            setCols("3");
            setTableDialogOpen(true);
          },
          tableInsert: () => {
            captureSelection();
            setRows("3");
            setCols("3");
            setTableDialogOpen(true);
          },
          shapes: () => {
            captureSelection();
            setShapesDialogOpen(true);
          },
          customLink: () => {
            captureSelection();
            const editor = editorRef.current;
            const sel = savedRangeRef.current;
            const selText = sel && sel.length > 0 && editor ? editor.getText(sel.index, sel.length) : "";
            setLinkText(selText);
            setLinkUrl("");
            setLinkDialogOpen(true);
          },
          "custom-link": () => {
            captureSelection();
            const editor = editorRef.current;
            const sel = savedRangeRef.current;
            const selText = sel && sel.length > 0 && editor ? editor.getText(sel.index, sel.length) : "";
            setLinkText(selText);
            setLinkUrl("");
            setLinkDialogOpen(true);
          },
          customImage: () => {
            captureSelection();
            setImageUrl("");
            setImageDialogOpen(true);
          },
          "custom-image": () => {
            captureSelection();
            setImageUrl("");
            setImageDialogOpen(true);
          },
          hr: () => {
            captureSelection();
            insertAtCursor('<hr style="border:0;border-top:1px solid #999;margin:8px 0"/><p><br/></p>');
          },
          pageBreak: () => {
            captureSelection();
            insertAtCursor('<div style="page-break-after:always"></div><p><br/></p>');
          },
          "page-break": () => {
            captureSelection();
            insertAtCursor('<div style="page-break-after:always"></div><p><br/></p>');
          },
        },
      },
      // Table module from quill1-table: tracks tables as proper Quill blots so
      // they survive normalization. cellSelectionOnClick=false means users
      // must Ctrl/Cmd+click to start a multi-cell selection (to merge etc.).
      table: { cellSelectionOnClick: false },
      // Required keyboard bindings so backspace/delete/undo/redo behave
      // correctly inside table cells (per quill1-table README).
      keyboard: {
        bindings: {
          backspace: {
            key: "backspace",
            handler(this: { quill: QuillType }, range: RangeStatic, keycontext: KeyBindingContext) {
              return TableModuleApi.keyboardHandler(this.quill, "backspace", range, keycontext);
            },
          },
          delete: {
            key: "delete",
            handler(this: { quill: QuillType }, range: RangeStatic, keycontext: KeyBindingContext) {
              return TableModuleApi.keyboardHandler(this.quill, "delete", range, keycontext);
            },
          },
          undo: {
            shortKey: true,
            key: "z",
            handler(this: { quill: QuillType }, range: RangeStatic, keycontext: KeyBindingContext) {
              return TableModuleApi.keyboardHandler(this.quill, "undo", range, keycontext);
            },
          },
          redo: {
            shortKey: true,
            shiftKey: true,
            key: "z",
            handler(this: { quill: QuillType }, range: RangeStatic, keycontext: KeyBindingContext) {
              return TableModuleApi.keyboardHandler(this.quill, "redo", range, keycontext);
            },
          },
          tab: {
            key: 9,
            handler(this: { quill: QuillType }, range: RangeStatic, keycontext: KeyBindingContext) {
              return TableModuleApi.keyboardHandler(this.quill, "tab", range, keycontext);
            },
          },
          shiftTab: {
            key: 9,
            shiftKey: true,
            handler(this: { quill: QuillType }, range: RangeStatic, keycontext: KeyBindingContext) {
              return TableModuleApi.keyboardHandler(this.quill, "shiftTab", range, keycontext);
            },
          },
        },
      },
      clipboard: { matchVisual: false },
    }),
    [toolbarId, captureSelection]
  );

  const insertTable = () => {
    const r = Math.min(Math.max(parseInt(rows) || 3, 1), 20);
    const c = Math.min(Math.max(parseInt(cols) || 3, 1), 10);
    const editor = editorRef.current;
    if (!editor) {
      setTableDialogOpen(false);
      return;
    }
    if (tableModuleRegistration.state !== "ok") {
      toast({
        title: "وحدة الجداول غير متاحة",
        description: "تعذّر تحميل وحدة الجداول. أعد تحميل الصفحة.",
        variant: "destructive",
      });
      setTableDialogOpen(false);
      return;
    }

    // Restore the caret to where the user clicked the toolbar button,
    // otherwise the dialog focus would have invalidated the saved range and
    // the table would land at the document end.
    restoreSelectionForInsertion();

    const action = `newtable_${r}_${c}` as const;
    const ok = callTableAction(action);
    if (!ok) {
      // callTableAction already toasted; keep the dialog open so the user
      // can adjust or cancel deliberately.
      return;
    }
    setTableDialogOpen(false);
  };

  const insertShape = (svg: string) => {
    insertAtCursor(svg + "&nbsp;");
    setShapesDialogOpen(false);
  };

  const insertLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const text = (linkText || url).trim();
    const safe = url.replace(/"/g, "&quot;");
    insertAtCursor(`<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>&nbsp;`);
    setLinkDialogOpen(false);
  };

  const insertImage = () => {
    const url = imageUrl.trim();
    if (!url) return;
    const safe = url.replace(/"/g, "&quot;");
    insertAtCursor(`<p><img src="${safe}" style="max-width:100%;height:auto"/></p>`);
    setImageDialogOpen(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "حجم الصورة كبير جداً", description: "الحد الأقصى 10 ميجابايت.", variant: "destructive" });
      input.value = "";
      return;
    }
    if (!/^image\//.test(file.type)) {
      toast({ title: "نوع الملف غير مدعوم", description: "يرجى اختيار صورة.", variant: "destructive" });
      input.value = "";
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await authFetch("/api/uploads/inline-image", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        throw new Error(data?.message || "فشل رفع الصورة");
      }
      const data = (await res.json()) as { url: string };
      const safe = data.url.replace(/"/g, "&quot;");
      insertAtCursor(`<p><img src="${safe}" style="max-width:100%;height:auto"/></p>`);
      setImageDialogOpen(false);
    } catch (err: any) {
      toast({ title: "تعذّر رفع الصورة", description: err?.message || "حاول مرة أخرى.", variant: "destructive" });
    } finally {
      input.value = "";
    }
  };

  // Move the editor's caret to the cell that was right-clicked so subsequent
  // table actions (which use the current selection) target the right cell.
  const focusCellAtPoint = useCallback((cell: HTMLTableCellElement, x: number, y: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    // caretRangeFromPoint is the WebKit/Blink API; not in the standard DOM
    // typings yet, so guard with feature detection.
    const caretFromPoint = (
      document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      }
    ).caretRangeFromPoint;

    let textNode: Node | null = null;
    let offset = 0;

    if (typeof caretFromPoint === "function") {
      const r = caretFromPoint.call(document, x, y);
      if (r && cell.contains(r.startContainer)) {
        textNode = r.startContainer;
        offset = r.startOffset;
      }
    }
    if (!textNode) {
      // Fallback: place caret in the first text-like leaf of the cell
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      const first = walker.nextNode();
      textNode = first ?? cell;
      offset = 0;
    }

    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.setStart(textNode, offset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      // Sync Quill's internal range from the native selection so subsequent
      // module actions see the right cell.
      (editor as EditorWithSelectionInternal).selection.update("user");
      // Save the resulting Quill range so that even if the menu shifts focus
      // briefly we can restore the caret before applying the action.
      savedRangeRef.current = editor.getSelection(false);
    } catch (err) {
      console.warn("focusCellAtPoint failed", err);
    }
  }, []);

  // Initialize Quill editor directly on mount
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;
    const editorDiv = document.createElement("div");
    container.innerHTML = "";
    container.appendChild(editorDiv);

    let quill: QuillType;
    try {
      quill = new Quill(editorDiv, {
        theme: "snow",
        modules,
        placeholder: placeholder || "",
      });
    } catch (err) {
      console.error("Failed to initialize Quill editor", err);
      return;
    }

    editorRef.current = quill;

    if (value && quill.root) {
      isInternalChangeRef.current = true;
      try {
        quill.clipboard.dangerouslyPasteHTML(0, value, "silent");
      } catch {
        if (quill.root) {
          quill.root.innerHTML = value;
        }
      }
      isInternalChangeRef.current = false;
    }

    const handleTextChange = () => {
      if (isInternalChangeRef.current) return;
      if (!quill || !quill.root) return;
      const html = quill.root.innerHTML || "";
      const cleanHtml = html === "<p><br></p>" ? "" : html;
      onChangeRef.current?.(cleanHtml);
    };

    quill.on("text-change", handleTextChange);

    const root = quill.root;
    let contextMenuHandler: ((e: MouseEvent) => void) | null = null;
    if (root) {
      contextMenuHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const cell = target.closest("td, th") as HTMLTableCellElement | null;
        if (!cell || !root.contains(cell)) return;
        e.preventDefault();
        e.stopPropagation();
        const menuW = 260;
        const menuH = 480;
        const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
        const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
        focusCellAtPoint(cell, e.clientX, e.clientY);
        setTableMenu({ x: Math.max(8, x), y: Math.max(8, y) });
      };
      root.addEventListener("contextmenu", contextMenuHandler);
    }

    return () => {
      try {
        quill.off("text-change", handleTextChange);
      } catch {}
      if (root && contextMenuHandler) {
        try {
          root.removeEventListener("contextmenu", contextMenuHandler);
        } catch {}
      }
      editorRef.current = null;
      if (container) {
        container.innerHTML = "";
      }
    };
  }, []);

  // Sync external value updates
  useEffect(() => {
    const quill = editorRef.current;
    if (!quill || !quill.root) return;
    const currentHtml = quill.root.innerHTML || "";
    const cleanCurrent = currentHtml === "<p><br></p>" ? "" : currentHtml;
    const cleanValue = value === "<p><br></p>" ? "" : (value || "");
    if (cleanValue !== cleanCurrent) {
      isInternalChangeRef.current = true;
      const sel = quill.getSelection();
      try {
        quill.root.innerHTML = cleanValue;
      } catch (err) {
        console.warn("Failed to set Quill HTML", err);
      }
      if (sel) {
        try {
          quill.setSelection(sel.index, sel.length, "silent");
        } catch {}
      }
      isInternalChangeRef.current = false;
    }
  }, [value]);

  // Close menu on outside click / Escape
  useEffect(() => {
    if (!tableMenu) return;
    const close = (e: MouseEvent) => {
      const menuEl = document.getElementById("rte-table-context-menu");
      if (menuEl && menuEl.contains(e.target as Node)) return;
      setTableMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTableMenu(null);
    };
    const onScroll = () => setTableMenu(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("contextmenu", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("contextmenu", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [tableMenu]);

  const apply = (action: TableActionValue) => {
    // Restore the caret captured when the menu opened, in case any focus
    // bouncing occurred between right-click and click.
    restoreSelectionForInsertion();
    callTableAction(action);
    setTableMenu(null);
  };

  return (
    <div className="rich-text-editor border rounded-md bg-background relative">
      <div id={toolbarId} className="ql-toolbar ql-snow !border-x-0 !border-t-0 !border-b !flex !flex-wrap !gap-1">
        <span className="ql-formats">
          <select className="ql-header" defaultValue="" title="نمط الفقرة">
            <option value="1">عنوان 1</option>
            <option value="2">عنوان 2</option>
            <option value="3">عنوان 3</option>
            <option value="4">عنوان 4</option>
            <option value="5">عنوان 5</option>
            <option value="6">عنوان 6</option>
            <option value="">عادي</option>
          </select>
          <select className="ql-font" defaultValue="" title="الخط" />
          <select className="ql-size" defaultValue="" title="حجم الخط" />
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-bold" title="عريض (Ctrl+B)" />
          <button type="button" className="ql-italic" title="مائل (Ctrl+I)" />
          <button type="button" className="ql-underline" title="مسطّر (Ctrl+U)" />
          <button type="button" className="ql-strike" title="يتوسطه خط" />
        </span>

        <span className="ql-formats">
          <select className="ql-color" title="لون الخط" />
          <select className="ql-background" title="لون التظليل" />
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-script" value="sub" title="منخفض" />
          <button type="button" className="ql-script" value="super" title="مرتفع" />
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-list" value="ordered" title="قائمة مرقمة" />
          <button type="button" className="ql-list" value="bullet" title="قائمة نقطية" />
          <button type="button" className="ql-indent" value="-1" title="تقليل المسافة" />
          <button type="button" className="ql-indent" value="+1" title="زيادة المسافة" />
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-direction" value="rtl" title="اتجاه الكتابة" />
          <select className="ql-align" title="محاذاة" />
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-blockquote" title="اقتباس" />
          <button type="button" className="ql-code-block" title="كتلة كود" />
          <button type="button" className="ql-code" title="كود سطري" />
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-customLink" title="إدراج رابط">
            <svg viewBox="0 0 18 18" width="18" height="18">
              <path d="M5 9 a4 4 0 0 1 4 -4 h2 M13 9 a4 4 0 0 1 -4 4 h-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button type="button" className="ql-customImage" title="إدراج صورة">
            <svg viewBox="0 0 18 18" width="18" height="18">
              <rect x="2" y="3" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="6" cy="7" r="1.2" fill="currentColor" />
              <path d="M2 13 L6 9 L9 12 L12 9 L16 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button type="button" className="ql-video" title="فيديو" />
        </span>

        <span className="ql-formats">
          <button
            type="button"
            className="ql-table-insert"
            title="إدراج جدول (انقر بالزر الأيمن داخل خلية لخيارات التحرير)"
            onMouseDown={() => captureSelection()}
            onClick={() => {
              setRows("3");
              setCols("3");
              setTableDialogOpen(true);
            }}
            data-testid="button-table-insert"
          >
            <svg viewBox="0 0 18 18" width="18" height="18">
              <rect x="2" y="3" width="14" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" />
              <line x1="2" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.5" />
              <line x1="7" y1="3" x2="7" y2="15" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="3" x2="11" y2="15" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button type="button" className="ql-shapes" title="إدراج شكل">
            <svg viewBox="0 0 18 18" width="18" height="18">
              <circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="9" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button type="button" className="ql-hr" title="خط أفقي">
            <svg viewBox="0 0 18 18" width="18" height="18">
              <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" />
              <line x1="2" y1="4" x2="6" y2="4" stroke="currentColor" strokeWidth="1.5" />
              <line x1="2" y1="14" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button type="button" className="ql-pageBreak" title="فاصل صفحات">
            <svg viewBox="0 0 18 18" width="18" height="18">
              <rect x="3" y="2" width="12" height="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="10" width="12" height="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
            </svg>
          </button>
        </span>

        <span className="ql-formats">
          <button type="button" className="ql-clean" title="مسح التنسيق" />
        </span>
      </div>

      <div
        ref={editorContainerRef}
        data-testid={testId}
        style={{ minHeight }}
        className="rich-text-editor-container"
      />

      {tableMenu && (
        <div
          id="rte-table-context-menu"
          role="menu"
          dir="rtl"
          data-testid="table-context-menu"
          className="fixed z-50 min-w-[260px] rounded-md border bg-popover text-popover-foreground shadow-lg p-1 text-sm"
          style={{ top: tableMenu.y, left: tableMenu.x }}
          onContextMenu={e => e.preventDefault()}
        >
          <div className="px-3 py-1.5 text-xs text-muted-foreground border-b mb-1 flex items-center gap-1.5">
            <TableIcon className="h-3.5 w-3.5" />
            <span>تحرير الجدول</span>
          </div>

          <MenuItem testId="menu-row-above" onClick={() => apply("append-row-above")} icon={<ArrowUpToLine className="h-4 w-4" />}>
            إضافة صف للأعلى
          </MenuItem>
          <MenuItem testId="menu-row-below" onClick={() => apply("append-row-below")} icon={<ArrowDownToLine className="h-4 w-4" />}>
            إضافة صف للأسفل
          </MenuItem>

          <Divider />

          <MenuItem testId="menu-col-right" onClick={() => apply("append-col-before")} icon={<ArrowRightToLine className="h-4 w-4" />}>
            إضافة عمود إلى اليمين
          </MenuItem>
          <MenuItem testId="menu-col-left" onClick={() => apply("append-col-after")} icon={<ArrowLeftToLine className="h-4 w-4" />}>
            إضافة عمود إلى اليسار
          </MenuItem>

          <Divider />

          <MenuItem testId="menu-delete-row" onClick={() => apply("remove-row")} icon={<Trash2 className="h-4 w-4" />}>
            حذف الصف
          </MenuItem>
          <MenuItem testId="menu-delete-col" onClick={() => apply("remove-col")} icon={<Trash2 className="h-4 w-4" />}>
            حذف العمود
          </MenuItem>
          <MenuItem testId="menu-delete-cell" onClick={() => apply("remove-cell")} icon={<Eraser className="h-4 w-4" />}>
            حذف الخلية الحالية
          </MenuItem>
          <MenuItem testId="menu-delete-table" onClick={() => apply("remove-table")} icon={<Trash2 className="h-4 w-4" />} danger>
            حذف الجدول بالكامل
          </MenuItem>

          <Divider />

          <MenuItem testId="menu-merge" onClick={() => apply("merge-selection")} icon={<Combine className="h-4 w-4" />}>
            دمج الخلايا المحددة
          </MenuItem>
          <MenuItem testId="menu-unmerge" onClick={() => apply("split-cell")} icon={<Split className="h-4 w-4" />}>
            فك دمج الخلية
          </MenuItem>

          <div className="px-3 py-1 text-[11px] text-muted-foreground border-t mt-1">
            لتحديد عدّة خلايا: اضغط Ctrl وانقر على الخلايا، ثم اختر "دمج".
          </div>

          <Divider />

          <MenuItem testId="menu-undo" onClick={() => apply("undo")} icon={<Undo2 className="h-4 w-4" />}>
            تراجع (Ctrl+Z)
          </MenuItem>
          <MenuItem testId="menu-redo" onClick={() => apply("redo")} icon={<Redo2 className="h-4 w-4" />}>
            إعادة (Ctrl+Shift+Z)
          </MenuItem>
        </div>
      )}

      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>إدراج جدول</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>عدد الصفوف (1-20)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={e => setRows(e.target.value)}
                data-testid="input-table-rows"
              />
            </div>
            <div className="space-y-1">
              <Label>عدد الأعمدة (1-10)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={cols}
                onChange={e => setCols(e.target.value)}
                data-testid="input-table-cols"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              نصيحة: بعد الإدراج، انقر بالزر الأيمن داخل أي خلية للحصول على خيارات إضافة/حذف/دمج الصفوف والأعمدة.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTableDialogOpen(false)} data-testid="button-cancel-table">
              إلغاء
            </Button>
            <Button type="button" onClick={insertTable} data-testid="button-insert-table">
              إدراج
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shapesDialogOpen} onOpenChange={setShapesDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إدراج شكل</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2 py-2">
            {SHAPES.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => insertShape(s.svg)}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded border hover:bg-muted transition-colors"
                data-testid={`shape-${i}`}
              >
                <span dangerouslySetInnerHTML={{ __html: s.svg }} />
                <span className="text-xs">{s.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>إدراج رابط</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>الرابط (URL)</Label>
              <Input
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                dir="ltr"
                data-testid="input-link-url"
              />
            </div>
            <div className="space-y-1">
              <Label>النص الظاهر (اختياري)</Label>
              <Input
                value={linkText}
                onChange={e => setLinkText(e.target.value)}
                placeholder="نص الرابط"
                data-testid="input-link-text"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" onClick={insertLink} data-testid="button-insert-link" disabled={!linkUrl.trim()}>
              إدراج
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>إدراج صورة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>رفع صورة من الجهاز</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                data-testid="input-image-file"
              />
              <p className="text-xs text-muted-foreground">الحد الأقصى: 10 ميجابايت</p>
            </div>
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-border" />
              <span className="mx-2 text-xs text-muted-foreground">أو</span>
              <div className="flex-grow border-t border-border" />
            </div>
            <div className="space-y-1">
              <Label>رابط صورة</Label>
              <Input
                type="url"
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                dir="ltr"
                data-testid="input-image-url"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setImageDialogOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" onClick={insertImage} data-testid="button-insert-image" disabled={!imageUrl.trim()}>
              إدراج من رابط
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MenuItemProps {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
  testId?: string;
}

function MenuItem({ onClick, icon, children, danger, testId }: MenuItemProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={
        "w-full flex items-center gap-2 px-3 py-1.5 rounded-sm text-right hover:bg-accent hover:text-accent-foreground transition-colors " +
        (danger ? "text-destructive" : "")
      }
    >
      <span className="opacity-70">{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t" />;
}
