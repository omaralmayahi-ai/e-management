import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import DOMPurify from "dompurify";
import { authFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Loader2,
  FileWarning,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Att = {
  id: number;
  originalName: string;
  fileName?: string;
  mimeType: string;
  fileSize?: number;
};

const PDF_OPTIONS = {
  cMapUrl: "/pdfjs-assets/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs-assets/standard_fonts/",
};

function isImage(mt: string) {
  return mt.startsWith("image/") && mt !== "image/svg+xml";
}
function isPdf(mt: string) {
  return mt === "application/pdf";
}
function isVideo(mt: string) {
  return mt.startsWith("video/");
}
function isAudio(mt: string) {
  return mt.startsWith("audio/");
}
function isText(mt: string, name: string) {
  if (mt.startsWith("text/")) return true;
  return /\.(txt|csv|md|log|json|xml|html|htm|rtf)$/i.test(name);
}
function isDocx(mt: string, name: string) {
  return (
    mt ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(name)
  );
}
function isXlsx(mt: string, name: string) {
  return (
    mt ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mt === "application/vnd.ms-excel" ||
    /\.(xlsx|xls|csv)$/i.test(name)
  );
}

export function canPreviewInApp(mt: string, name = ""): boolean {
  return (
    isImage(mt) ||
    isPdf(mt) ||
    isVideo(mt) ||
    isAudio(mt) ||
    isText(mt, name) ||
    isDocx(mt, name) ||
    isXlsx(mt, name)
  );
}

export function AttachmentViewer({
  attachment,
  className,
  height = "70vh",
}: {
  attachment: Att;
  className?: string;
  height?: string;
}) {
  const url = `/api/attachments/${attachment.id}/preview`;
  const mt = attachment.mimeType || "";
  const name = attachment.originalName || "";

  if (isImage(mt)) return <ImageView url={url} name={name} height={height} className={className} />;
  if (isPdf(mt)) return <PdfView url={url} height={height} className={className} />;
  if (isVideo(mt)) return <VideoView url={url} height={height} className={className} />;
  if (isAudio(mt)) return <AudioView url={url} className={className} />;
  if (isXlsx(mt, name)) return <XlsxView url={url} height={height} className={className} />;
  if (isDocx(mt, name)) return <DocxView url={url} height={height} className={className} />;
  if (isText(mt, name)) return <TextView url={url} height={height} className={className} mime={mt} name={name} />;
  return <UnsupportedView attachment={attachment} />;
}

function Loading({ label = "جارٍ تحميل المرفق..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-destructive">
      <FileWarning className="w-6 h-6" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function ImageView({ url, name, height, className }: { url: string; name: string; height: string; className?: string }) {
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  return (
    <div className={className}>
      <ViewerToolbar>
        <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} data-testid="button-zoom-out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))} data-testid="button-zoom-in">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRot((r) => (r + 90) % 360)} data-testid="button-rotate">
          <RotateCw className="w-4 h-4" />
        </Button>
      </ViewerToolbar>
      <div className="overflow-auto bg-muted/30" style={{ height }}>
        <div className="flex items-center justify-center min-h-full p-4">
          <img
            src={url}
            alt={name}
            style={{ transform: `scale(${zoom}) rotate(${rot}deg)`, transformOrigin: "center center" }}
            className="max-w-none rounded shadow"
            data-testid="preview-image"
          />
        </div>
      </div>
    </div>
  );
}

function VideoView({ url, height, className }: { url: string; height: string; className?: string }) {
  return (
    <div className={className} style={{ height }}>
      <div className="flex items-center justify-center w-full h-full bg-black/90 p-4">
        <video src={url} controls className="max-w-full max-h-full rounded" data-testid="preview-video">
          المتصفح لا يدعم تشغيل الفيديو
        </video>
      </div>
    </div>
  );
}

function AudioView({ url, className }: { url: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-center p-10">
        <audio src={url} controls className="w-full max-w-md" data-testid="preview-audio">
          المتصفح لا يدعم تشغيل الصوت
        </audio>
      </div>
    </div>
  );
}

function PdfView({ url, height, className }: { url: string; height: string; className?: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [rot, setRot] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const file = useMemo(() => ({ url, withCredentials: true }), [url]);

  return (
    <div className={className}>
      <ViewerToolbar>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          data-testid="button-pdf-prev"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="text-xs tabular-nums">
          {page} / {numPages || "—"}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPage((p) => Math.min(numPages || p, p + 1))}
          disabled={!numPages || page >= numPages}
          data-testid="button-pdf-next"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button size="sm" variant="outline" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))} data-testid="button-pdf-zoom-out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button size="sm" variant="outline" onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))} data-testid="button-pdf-zoom-in">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRot((r) => (r + 90) % 360)} data-testid="button-pdf-rotate">
          <RotateCw className="w-4 h-4" />
        </Button>
      </ViewerToolbar>
      <div ref={containerRef} className="overflow-auto bg-muted/30 flex justify-center" style={{ height }}>
        {error ? (
          <ErrorBox message={error} />
        ) : (
          <Document
            file={file}
            onLoadSuccess={(info) => {
              setNumPages(info.numPages);
              setError(null);
            }}
            onLoadError={(e) => setError("تعذّر تحميل ملف PDF: " + (e?.message || "خطأ غير معروف"))}
            loading={<Loading label="جارٍ تحميل ملف PDF..." />}
            options={PDF_OPTIONS}
          >
            <div className="p-4">
              <Page
                pageNumber={page}
                scale={scale}
                rotate={rot}
                renderAnnotationLayer
                renderTextLayer
                width={containerWidth ? Math.min(containerWidth - 40, 1200) * (scale / 1.2) : undefined}
                loading={<Loading label="جارٍ عرض الصفحة..." />}
              />
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}

function TextView({ url, height, className, name }: { url: string; height: string; className?: string; mime: string; name: string }) {
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isJson = /\.json$/i.test(name);

  useEffect(() => {
    setLoading(true);
    authFetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("فشل تحميل الملف");
        return r.text();
      })
      .then((t) => {
        if (isJson) {
          try {
            t = JSON.stringify(JSON.parse(t), null, 2);
          } catch {}
        }
        setText(t);
        setError(null);
      })
      .catch((e) => setError(e.message || "تعذّر تحميل الملف"))
      .finally(() => setLoading(false));
  }, [url, isJson]);

  return (
    <div className={className}>
      <div className="overflow-auto bg-white dark:bg-zinc-950" style={{ height }}>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} />
        ) : (
          <pre className="p-4 text-xs whitespace-pre-wrap break-words leading-relaxed font-mono" dir="ltr" data-testid="preview-text">
            {text}
          </pre>
        )}
      </div>
    </div>
  );
}

function DocxView({ url, height, className }: { url: string; height: string; className?: string }) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("فشل تحميل المستند");
        return r.arrayBuffer();
      })
      .then(async (buf) => {
        const result = await mammoth.convertToHtml(
          { arrayBuffer: buf },
          { includeDefaultStyleMap: true },
        );
        const clean = DOMPurify.sanitize(result.value || "", {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
          FORBID_ATTR: ["onerror", "onload", "onclick"],
        });
        setHtml(clean);
        setError(null);
      })
      .catch((e) => setError(e.message || "تعذّر عرض ملف Word"))
      .finally(() => setLoading(false));
  }, [url]);

  return (
    <div className={className}>
      <div className="overflow-auto bg-white" style={{ height }}>
        {loading ? (
          <Loading label="جارٍ تحويل ملف Word للعرض..." />
        ) : error ? (
          <ErrorBox message={error} />
        ) : (
          <div
            className="docx-preview p-8 max-w-4xl mx-auto text-zinc-900"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: html }}
            data-testid="preview-docx"
          />
        )}
      </div>
    </div>
  );
}

function XlsxView({ url, height, className }: { url: string; height: string; className?: string }) {
  const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("فشل تحميل الجدول");
        return r.arrayBuffer();
      })
      .then((buf) => {
        const wb = XLSX.read(buf, { type: "array" });
        const result = wb.SheetNames.map((n) => {
          const ws = wb.Sheets[n];
          const html = XLSX.utils.sheet_to_html(ws, { editable: false });
          const clean = DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ["script", "style", "iframe"],
            FORBID_ATTR: ["onerror", "onload", "onclick"],
          });
          return { name: n, html: clean };
        });
        setSheets(result);
        setActive(0);
        setError(null);
      })
      .catch((e) => setError(e.message || "تعذّر عرض الجدول"))
      .finally(() => setLoading(false));
  }, [url]);

  return (
    <div className={className}>
      {sheets.length > 1 && (
        <div className="flex gap-1 px-3 pt-2 border-b overflow-x-auto bg-muted/20">
          {sheets.map((s, i) => (
            <button
              key={s.name + i}
              onClick={() => setActive(i)}
              className={`px-3 py-1.5 text-xs rounded-t border-b-2 whitespace-nowrap ${
                i === active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-sheet-${i}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-auto bg-white" style={{ height }}>
        {loading ? (
          <Loading label="جارٍ تحميل الجدول..." />
        ) : error ? (
          <ErrorBox message={error} />
        ) : (
          <div
            className="xlsx-preview p-4 text-zinc-900 text-xs"
            dir="ltr"
            dangerouslySetInnerHTML={{ __html: sheets[active]?.html || "" }}
            data-testid="preview-xlsx"
          />
        )}
      </div>
    </div>
  );
}

function UnsupportedView({ attachment }: { attachment: Att }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <FileWarning className="w-10 h-10 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">لا يمكن معاينة هذا النوع من الملفات داخل النظام</p>
        <p className="text-xs text-muted-foreground">{attachment.originalName}</p>
      </div>
      <Button asChild size="sm" data-testid="button-download-unsupported">
        <a href={`/api/attachments/${attachment.id}/download`} download>
          <Download className="w-4 h-4 ml-1" />
          تنزيل الملف
        </a>
      </Button>
    </div>
  );
}

function ViewerToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/40" dir="ltr">
      {children}
    </div>
  );
}
