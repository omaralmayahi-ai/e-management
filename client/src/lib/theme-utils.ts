// Utilities for dynamic theme, color, typography, sidebar, and border radius management

export interface ThemeConfig {
  theme: string;
  customPrimary?: string;
  customAccent?: string;
  fontFamily: string;
  sidebarStyle: "primary" | "dark" | "light";
  borderRadius: "sm" | "md" | "lg" | "xl";
}

export interface ThemePreset {
  id: string;
  name: string;
  nameEn: string;
  primary: string;
  accentColor: string;
  badge: string;
  badgeColor: string;
  desc: string;
  hexPrimary: string;
  hexAccent: string;
}

export interface FontOption {
  id: string;
  name: string;
  fontFamily: string;
  desc: string;
  previewSample: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "crimson",
    name: "أحمر داكن / خمري ملكي",
    nameEn: "Royal Crimson & Ruby",
    primary: "344 75% 30%",
    accentColor: "#E11D48",
    badge: "👑 الهوية الملكية / المعتمدة",
    badgeColor: "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20",
    desc: "النمط الخمري والياقوتي الداكن (#881337 مع #E11D48) - طابع رئاسي وسيادي فخم مع قائمة جانبية ملونة وحضور رسمي رفيع.",
    hexPrimary: "#881337",
    hexAccent: "#E11D48",
  },
  {
    id: "royal-blue",
    name: "أزرق ملكي سيادي",
    nameEn: "Royal Blue & Amber",
    primary: "222 75% 28%",
    accentColor: "#D97706",
    badge: "🏛️ كحلي حكومي",
    badgeColor: "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20",
    desc: "كحلي بحري عميق (#1E3A8A) مع لمسات عنبرية وذهبية وقورة تمنح المراسلات والكتب طابعاً رسمياً لا غبار عليه.",
    hexPrimary: "#1E3A8A",
    hexAccent: "#D97706",
  },
  {
    id: "emerald",
    name: "أخضر زمردي راقي",
    nameEn: "Emerald Forest & Sage",
    primary: "160 84% 28%",
    accentColor: "#10B981",
    badge: "🌿 زمردي هادئ",
    badgeColor: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20",
    desc: "أخضر زمردي كلاسيكي (#065F46) يبعث على الهدوء والتركيز المكتبي ويحد من إجهاد العين أثناء العمل الإداري المطول.",
    hexPrimary: "#065F46",
    hexAccent: "#10B981",
  },
  {
    id: "deep-purple",
    name: "بنفسجي غامق ملكي",
    nameEn: "Imperial Purple & Violet",
    primary: "272 65% 32%",
    accentColor: "#A855F7",
    badge: "🔮 فخامة وتميز",
    badgeColor: "bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/20",
    desc: "تدرج أرجواني وبنفسجي عميق (#581C87) يمنح النظام لمسة جمالية حديثة واستثنائية.",
    hexPrimary: "#581C87",
    hexAccent: "#A855F7",
  },
  {
    id: "charcoal",
    name: "رمادي احترافي محايد",
    nameEn: "Monochrome Slate",
    primary: "215 28% 27%",
    accentColor: "#64748B",
    badge: "📑 حيادي & صارم",
    badgeColor: "bg-slate-500/10 text-slate-800 dark:text-slate-300 border-slate-500/20",
    desc: "فحمي وأردوازي رسمي (#334155) خالٍ من البهرجة يوجه كامل تركيز الموظفين لنصوص الوثائق والمذكرات والمرفقات.",
    hexPrimary: "#334155",
    hexAccent: "#64748B",
  },
  {
    id: "warm-orange",
    name: "برتقالي دافئ ونشط",
    nameEn: "Warm Amber & Terracotta",
    primary: "24 78% 42%",
    accentColor: "#F97316",
    badge: "☀️ نشاط وحيوية",
    badgeColor: "bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/20",
    desc: "ألوان خريفية دافئة (#C2410C) تعزز التفاعل وسرعة إنجاز وتدقيق المعاملات والطلبات.",
    hexPrimary: "#C2410C",
    hexAccent: "#F97316",
  },
  {
    id: "azure",
    name: "أزرق أردوازي حديث",
    nameEn: "Azure Tech Slate",
    primary: "201 96% 40%",
    accentColor: "#0284C7",
    badge: "💎 حديث وعصري",
    badgeColor: "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/20",
    desc: "أزرق تكنولوجي مشرق ناصع وواضح (#0369A1) مناسب لبيئات العمل الحديثة متعددة الشاشات.",
    hexPrimary: "#0369A1",
    hexAccent: "#0284C7",
  },
];

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "cairo",
    name: "خط القاهرة (Cairo)",
    fontFamily: "'Cairo', sans-serif",
    desc: "خط ممتد ومتين للقوائم والعناوين والروابط - الخط المثالي للأنظمة الإدارية والمراسلات الرسمية",
    previewSample: "نظام إدارة المعاملات الإلكتروني والمراسلات الرسمية",
  },
  {
    id: "ibm-plex",
    name: "خط آي بي إم (IBM Plex Sans Arabic)",
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
    desc: "خط رقمي هندسي متطور مصمم للأنظمة المؤسسية وتسهيل القراءة الطويلة المريحة",
    previewSample: "لوحة التحكم الموحدة وسجلات الخدمة والوارد والصادر",
  },
  {
    id: "tajawal",
    name: "خط تجوال (Tajawal)",
    fontFamily: "'Tajawal', sans-serif",
    desc: "خط انسيابي عصري مريح جداً للبصر مع استدارة ناعمة في نهايات الأحرف",
    previewSample: "إدارة الهيكل التنظيمي والموظفين ومسارات التدفق",
  },
  {
    id: "almarai",
    name: "خط المراعي (Almarai)",
    fontFamily: "'Almarai', sans-serif",
    desc: "خط مضغوط ودقيق ومثالي للجداول الكثيفة وعرض البيانات الرقمية المتقاربة",
    previewSample: "سجلات الإجازات الرسمية والتقارير الدورية للموظفين",
  },
  {
    id: "readex",
    name: "خط ريديكس برو (Readex Pro)",
    fontFamily: "'Readex Pro', sans-serif",
    desc: "خط حديث فائق التناسق يتميز بالوضوح العالي في الشاشات العريضة والأجهزة المحمولة",
    previewSample: "التأشيرات الإلكترونية وتوقيع الكتب والتعاميم السرية",
  },
  {
    id: "kufi",
    name: "خط الكوفي الحديث (Noto Kufi Arabic)",
    fontFamily: "'Noto Kufi Arabic', sans-serif",
    desc: "طراز كوفي هندسي رسمي يمنح الوثائق والشهادات والمراسلات الوزارية طابعاً عريقاً",
    previewSample: "الأمانة العامة ومجلس الإدارة وإشعارات النظام المركزية",
  },
];

/**
 * Converts Hex string to HSL CSS values "h s% l%"
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number; str: string } | null {
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  if (cleanHex.length !== 6) return null;

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return {
    h: hDeg,
    s: sPct,
    l: lPct,
    str: `${hDeg} ${sPct}% ${lPct}%`,
  };
}

/**
 * Applies all appearance settings dynamically to the DOM
 */
export function applyAppearanceToDOM(config: Partial<ThemeConfig>) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // 1. Apply theme
  const theme = config.theme || "crimson";
  root.setAttribute("data-theme", theme);

  // 2. Apply font family
  const font = config.fontFamily || "cairo";
  root.setAttribute("data-font", font);

  // 3. Apply sidebar style
  const sidebar = config.sidebarStyle || "primary";
  root.setAttribute("data-sidebar-style", sidebar);

  // 4. Apply border radius
  const radius = config.borderRadius || "md";
  root.setAttribute("data-radius", radius);

  // 5. Custom Primary & Accent Color Override
  if (config.customPrimary) {
    const hsl = hexToHsl(config.customPrimary);
    if (hsl) {
      root.style.setProperty("--primary", hsl.str);
      root.style.setProperty("--ring", hsl.str);
      root.style.setProperty("--sidebar-primary", hsl.str);
      root.style.setProperty("--primary-foreground", hsl.l > 60 ? "0 0% 10%" : "0 0% 100%");
      root.style.setProperty("--sidebar-primary-foreground", hsl.l > 60 ? "0 0% 10%" : "0 0% 100%");
    }
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--sidebar-primary-foreground");
  }

  if (config.customAccent) {
    const hslAccent = hexToHsl(config.customAccent);
    if (hslAccent) {
      root.style.setProperty("--accent", `${hslAccent.h} ${hslAccent.s}% 95%`);
      root.style.setProperty("--accent-foreground", `${hslAccent.h} ${hslAccent.s}% 25%`);
      root.style.setProperty("--chart-2", hslAccent.str);
    }
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-foreground");
    root.style.removeProperty("--chart-2");
  }

  // Update localStorage for local user preference
  localStorage.setItem("userTheme", theme);
  localStorage.setItem("userFont", font);
  localStorage.setItem("userSidebarStyle", sidebar);
  localStorage.setItem("userRadius", radius);
  if (config.customPrimary) localStorage.setItem("userCustomPrimary", config.customPrimary);
  else localStorage.removeItem("userCustomPrimary");
  if (config.customAccent) localStorage.setItem("userCustomAccent", config.customAccent);
  else localStorage.removeItem("userCustomAccent");
}
