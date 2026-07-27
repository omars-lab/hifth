/**
 * L3 verse-text token table for the diff view (spec §3 diff), keyed by bare
 * `surah:ayah`. Each token carries a diff class: 0 = common/unchanged, while
 * 1 and 2 mark the two divergent readings being compared. This is Loop-3 demo
 * data — the mock's hand-verified tokens — that Loop 4's ETL will replace with
 * a real per-ayah token source. The Arabic text is copied EXACTLY, including
 * all harakat/diacritics: it is scripture and must not be normalized.
 */

export type DiffClass = 0 | 1 | 2;

export interface DiffToken {
  readonly text: string;
  readonly cls: DiffClass;
}

export const VERSE_TEXT: Readonly<Record<string, readonly DiffToken[]>> = {
  '2:40': [
    { text: 'يَا بَنِي إِسْرَائِيلَ اذْكُرُوا نِعْمَتِيَ الَّتِي أَنْعَمْتُ عَلَيْكُمْ', cls: 0 },
    { text: 'وَأَوْفُوا بِعَهْدِي أُوفِ بِعَهْدِكُمْ وَإِيَّايَ فَارْهَبُونِ', cls: 1 },
  ],
  '2:47': [
    { text: 'يَا بَنِي إِسْرَائِيلَ اذْكُرُوا نِعْمَتِيَ الَّتِي أَنْعَمْتُ عَلَيْكُمْ', cls: 0 },
    { text: 'وَأَنِّي فَضَّلْتُكُمْ عَلَى الْعَالَمِينَ', cls: 2 },
  ],
  '2:122': [
    { text: 'يَا بَنِي إِسْرَائِيلَ اذْكُرُوا نِعْمَتِيَ الَّتِي أَنْعَمْتُ عَلَيْكُمْ', cls: 0 },
    { text: 'وَأَنِّي فَضَّلْتُكُمْ عَلَى الْعَالَمِينَ', cls: 2 },
  ],
  '2:48': [
    { text: 'وَاتَّقُوا يَوْمًا لَا تَجْزِي نَفْسٌ عَنْ نَفْسٍ شَيْئًا وَلَا يُقْبَلُ مِنْهَا', cls: 0 },
    { text: 'شَفَاعَةٌ', cls: 1 },
    { text: 'وَلَا', cls: 0 },
    { text: 'يُؤْخَذُ مِنْهَا عَدْلٌ', cls: 2 },
    { text: 'وَلَا هُمْ يُنْصَرُونَ', cls: 0 },
  ],
  '2:123': [
    { text: 'وَاتَّقُوا يَوْمًا لَا تَجْزِي نَفْسٌ عَنْ نَفْسٍ شَيْئًا وَلَا يُقْبَلُ مِنْهَا', cls: 0 },
    { text: 'عَدْلٌ', cls: 2 },
    { text: 'وَلَا', cls: 0 },
    { text: 'تَنْفَعُهَا شَفَاعَةٌ', cls: 1 },
    { text: 'وَلَا هُمْ يُنْصَرُونَ', cls: 0 },
  ],
  '2:58': [
    { text: 'وَإِذْ', cls: 0 },
    { text: 'قُلْنَا ادْخُلُوا', cls: 1 },
    { text: 'هَذِهِ الْقَرْيَةَ', cls: 0 },
    { text: 'فَكُلُوا', cls: 2 },
    { text: 'مِنْهَا حَيْثُ شِئْتُمْ', cls: 0 },
    { text: 'رَغَدًا وَادْخُلُوا الْبَابَ سُجَّدًا وَقُولُوا حِطَّةٌ', cls: 1 },
    { text: 'نَغْفِرْ لَكُمْ', cls: 0 },
    { text: 'خَطَايَاكُمْ', cls: 2 },
    { text: 'وَسَنَزِيدُ الْمُحْسِنِينَ', cls: 0 },
  ],
  '7:161': [
    { text: 'وَإِذْ', cls: 0 },
    { text: 'قِيلَ لَهُمُ اسْكُنُوا', cls: 1 },
    { text: 'هَذِهِ الْقَرْيَةَ', cls: 0 },
    { text: 'وَكُلُوا', cls: 2 },
    { text: 'مِنْهَا حَيْثُ شِئْتُمْ', cls: 0 },
    { text: 'وَقُولُوا حِطَّةٌ وَادْخُلُوا الْبَابَ سُجَّدًا', cls: 1 },
    { text: 'نَغْفِرْ لَكُمْ', cls: 0 },
    { text: 'خَطِيئَاتِكُمْ', cls: 2 },
    { text: 'سَنَزِيدُ الْمُحْسِنِينَ', cls: 0 },
  ],
  '2:60': [
    { text: 'فَقُلْنَا', cls: 1 },
    { text: 'اضْرِبْ بِعَصَاكَ الْحَجَرَ', cls: 0 },
    { text: 'فَانْفَجَرَتْ', cls: 2 },
    { text: 'مِنْهُ اثْنَتَا عَشْرَةَ عَيْنًا', cls: 0 },
  ],
  '7:160': [
    { text: 'أَنِ', cls: 1 },
    { text: 'اضْرِبْ بِعَصَاكَ الْحَجَرَ', cls: 0 },
    { text: 'فَانْبَجَسَتْ', cls: 2 },
    { text: 'مِنْهُ اثْنَتَا عَشْرَةَ عَيْنًا', cls: 0 },
  ],
  '2:45': [
    { text: 'وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ', cls: 0 },
    { text: 'وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى الْخَاشِعِينَ', cls: 1 },
  ],
  '2:153': [
    { text: 'يَا أَيُّهَا الَّذِينَ آمَنُوا', cls: 2 },
    { text: 'اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ', cls: 0 },
    { text: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', cls: 1 },
  ],
  '82:19': [
    { text: 'يَوْمَ لَا تَمْلِكُ نَفْسٌ لِنَفْسٍ شَيْئًا وَالْأَمْرُ يَوْمَئِذٍ لِلَّهِ', cls: 0 },
  ],
};

/**
 * Look up the diff-token array for an ayah. Accepts either a bare `"2:48"` key
 * or a canonical `"quran/hafs-kfqc/2:48"` key — everything up to and including
 * the last `/` is stripped before lookup. Returns `null` if the key is absent.
 */
export function verseTokens(key: string): readonly DiffToken[] | null {
  const bare = key.slice(key.lastIndexOf('/') + 1);
  return VERSE_TEXT[bare] ?? null;
}

/** One side of a diff: the ayah's key and its pre-classified tokens. */
export interface DiffSide {
  readonly key: string;
  readonly tokens: readonly DiffToken[];
}

/**
 * The two rows of a token diff (spec §3): the source ayah ("here") and the hop
 * target. Each token is already class-tagged in the fixture (the mock does no
 * runtime alignment — the divergent readings are pre-marked), so this just pairs
 * the two token arrays. Returns `null` when either ayah has no vendored text, so
 * a caller can fall back to the plain note rather than render an empty diff.
 */
export function diffPair(fromKey: string, toKey: string): { from: DiffSide; to: DiffSide } | null {
  const from = verseTokens(fromKey);
  const to = verseTokens(toKey);
  if (!from || !to) return null;
  return { from: { key: fromKey, tokens: from }, to: { key: toKey, tokens: to } };
}
