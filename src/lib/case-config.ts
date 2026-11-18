/** Shape of `case.config` (jsonb). Editable from /admin as JSON. */
export type SkinRow = [skin: string, label: string, icon: string];

export type CaseConfig = {
  /** document code → [skin, label, icon] */
  skins: Record<string, SkinRow>;
  /** fallback by code prefix, e.g. { "II-": ["letter","Surat","letter"] } */
  skinPrefixes: Record<string, SkinRow>;
  tapes: Record<string, { style: 'cassette' | 'phone'; label: string; brand?: string; length?: string }>;
  berkas: Record<string, { years: string; motif: string; palette: string }>;
  /** identity cards: doc code → [name, habit, boat] */
  kenal: Record<string, [string, string, string]>;
  hints: string[];
  bekal: [key: string, text: string, why: string][];
  tugas: [docCode: string, text: string][];
  /** home card copy */
  card: { goal: string; audioHint: string; countdown: string; pill: string };
  finale: {
    berkas: string;          // the locked berkas, e.g. "IX"
    unlockAfter: string;     // doc that opens it, e.g. "VIII-20"
    ritual: string;          // instructions doc
    song: string;            // tembang doc
    tape: string;            // locked: after solve
    epilogue: string;        // locked: after solve + date
    endingsDoc?: string;     // doc split into the endings below, not shown as a doc
    windu: string;           // YYYY-MM-DD, the night it all happens
    epilogueDate: string;    // YYYY-MM-DD, when the epilogue may appear
    address: string;         // envelope "Kepada"
    sayLine: string;
    sayTranslation: string;
  };
  endings: { before: string; incomplete: string; after: string };
  replies: Record<string, string>;
};

export function skinOf(cfg: CaseConfig, code: string): SkinRow {
  if (cfg.skins[code]) return cfg.skins[code];
  for (const [prefix, row] of Object.entries(cfg.skinPrefixes || {})) if (code.startsWith(prefix)) return row;
  return ['note', 'Dokumen', 'report'];
}
