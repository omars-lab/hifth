import { describe, it, expect } from "vitest";
import {
  MAX_JUMP_RESULTS,
  normalizeArabic,
  parseJump,
  toWesternDigits,
} from "./jump.js";
import { AYAH_COUNTS, JUZ_STARTS } from "./quran-meta.js";

// The name table lives in the app (presentation); tests inject the real one so
// the ranking is exercised against the names a hafiz actually types.
const NAMES: readonly string[] = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف",
  "الأنفال", "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر",
  "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون",
  "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان",
  "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح",
  "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة",
  "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", "المنافقون",
  "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج", "نوح",
  "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ",
  "النازعات", "عبس", "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج",
  "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى",
  "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر",
  "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس",
];

const jump = (q: string) => parseJump(q, NAMES);

describe("digit + Arabic normalization", () => {
  it("reads Arabic-Indic and Persian digits as numbers", () => {
    expect(toWesternDigits("٢:٢٥٥")).toBe("2:255");
    expect(toWesternDigits("۳۰")).toBe("30");
  });

  it("folds tashkeel, hamza forms, ta-marbuta and tatweel", () => {
    expect(normalizeArabic("الأَعْرَاف")).toBe("الاعراف");
    expect(normalizeArabic("الفاتِحـة")).toBe("الفاتحه");
    expect(normalizeArabic("  مريم  ")).toBe("مريم");
  });
});

describe("parseJump — an ayah", () => {
  it("parses S:A in either digit system", () => {
    expect(jump("2:255")).toEqual([{ kind: "ayah", surah: 2, ayah: 255 }]);
    expect(jump("٢:٢٥٥")).toEqual([{ kind: "ayah", surah: 2, ayah: 255 }]);
  });

  it("accepts the separators a thumb produces", () => {
    for (const q of ["2 255", "2/255", "2-255", "2.255", "2 : 255"]) {
      expect(jump(q)).toEqual([{ kind: "ayah", surah: 2, ayah: 255 }]);
    }
  });

  it("refuses an out-of-range ayah rather than clamping it", () => {
    // Al-Baqara has 286 ayahs; landing on 286 when 287 was asked for would be
    // the one failure a navigation instrument may not have.
    expect(jump("2:287")).toEqual([]);
    expect(jump("115:1")).toEqual([]);
    expect(jump("2:0")).toEqual([]);
  });

  it("takes a surah name plus an ayah number", () => {
    expect(jump("البقرة ٢٥٥")).toEqual([
      { kind: "ayah", surah: 2, ayah: 255 },
      { kind: "surah", surah: 2, ayah: 1 },
    ]);
  });

  it("falls back to the surah head when the ayah number is out of range", () => {
    expect(jump("الفاتحة 40")).toEqual([{ kind: "surah", surah: 1, ayah: 1 }]);
  });
});

describe("parseJump — a surah", () => {
  it("matches a name exactly, ignoring the article and the hamza", () => {
    expect(jump("بقرة")).toEqual([{ kind: "surah", surah: 2, ayah: 1 }]);
    expect(jump("الأعراف")).toEqual([{ kind: "surah", surah: 7, ayah: 1 }]);
    expect(jump("الاعراف")).toEqual([{ kind: "surah", surah: 7, ayah: 1 }]);
  });

  it("ranks prefix matches above mere substring matches", () => {
    // "نس": النساء *starts* with it; يونس and الإنسان merely contain it.
    expect(jump("نس").map((h) => h.surah)).toEqual([4, 10, 76]);
  });

  it("puts an exact match first even when longer names contain it", () => {
    // "الحج" is surah 22 exactly; "الحجر" (15) and "الحجرات" (49) contain it.
    expect(jump("الحج")[0]).toEqual({ kind: "surah", surah: 22, ayah: 1 });
  });

  it("takes an explicit surah prefix", () => {
    expect(jump("سورة ١٨")).toEqual([{ kind: "surah", surah: 18, ayah: 1 }]);
    expect(jump("س 18")).toEqual([{ kind: "surah", surah: 18, ayah: 1 }]);
    expect(jump("سورة 115")).toEqual([]);
  });

  it("caps the candidate list", () => {
    expect(jump("ا").length).toBeLessThanOrEqual(MAX_JUMP_RESULTS);
  });
});

describe("parseJump — a juz", () => {
  it("lands a juz on its first ayah", () => {
    expect(jump("جزء ٩")).toEqual([
      { kind: "juz", surah: JUZ_STARTS[8]![0], ayah: JUZ_STARTS[8]![1], juz: 9 },
    ]);
    expect(jump("ج30")).toEqual([{ kind: "juz", surah: 78, ayah: 1, juz: 30 }]);
  });

  it("rejects a juz outside 1..30", () => {
    expect(jump("جزء 31")).toEqual([]);
    expect(jump("ج0")).toEqual([]);
  });

  it("offers both readings of a bare number, surah first", () => {
    const hits = jump("3");
    expect(hits).toEqual([
      { kind: "surah", surah: 3, ayah: 1 },
      { kind: "juz", surah: JUZ_STARTS[2]![0], ayah: JUZ_STARTS[2]![1], juz: 3 },
    ]);
  });

  it("offers only the surah when the number is past 30", () => {
    expect(jump("55")).toEqual([{ kind: "surah", surah: 55, ayah: 1 }]);
  });

  it("de-duplicates identical landings of different kinds", () => {
    // Juz 1 and surah 1 both start at 1:1 — two readings, both worth showing,
    // but the same landing must not appear twice under one kind.
    const hits = jump("1");
    expect(hits).toHaveLength(2);
    expect(new Set(hits.map((h) => h.kind)).size).toBe(2);
  });
});

describe("parseJump — nothing to say", () => {
  it("returns nothing for empty or unmatched input", () => {
    expect(jump("")).toEqual([]);
    expect(jump("   ")).toEqual([]);
    expect(jump("zzz")).toEqual([]);
  });
});

describe("every target is a real landing", () => {
  it("every juz start and every surah head resolves in range", () => {
    for (let j = 1; j <= 30; j++) {
      const [t] = jump(`ج${j}`);
      expect(t).toBeDefined();
      expect(t!.ayah).toBeGreaterThanOrEqual(1);
      expect(t!.ayah).toBeLessThanOrEqual(AYAH_COUNTS[t!.surah - 1]!);
    }
    for (let s = 1; s <= 114; s++) {
      const [t] = jump(`سورة ${s}`);
      expect(t).toEqual({ kind: "surah", surah: s, ayah: 1 });
    }
  });

  it("finds every surah by its own name", () => {
    NAMES.forEach((name, i) => {
      const hits = jump(name);
      expect(hits.map((h) => h.surah)).toContain(i + 1);
    });
  });
});
