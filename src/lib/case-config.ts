/** Unlock rules. A berkas/doc opens when ALL of its rules pass. */
export type Gate =
  | { type: 'sequential' }                         // last doc of the previous berkas has been read
  | { type: 'read'; code: string }                 // a specific doc has been read
  | { type: 'puzzle'; key: string }                // a puzzle/lock has been solved
  | { type: 'date'; at: string; label?: string }    // real time, WIB (YYYY-MM-DDTHH:mm)
  | { type: 'kliwon' }                              // only on malam Jumat Kliwon (WIB)
  | { type: 'collective'; threshold: number };      // N readers worldwide have finished

/** Shape of `case.config` (jsonb). Editable from /admin as JSON. */
export type SkinRow = [skin: string, label: string, icon: string];

export type CaseConfig = {
  /** document code → [skin, label, icon] */
  skins: Record<string, SkinRow>;
  /** fallback by code prefix, e.g. { "II-": ["letter","Surat","letter"] } */
  skinPrefixes: Record<string, SkinRow>;
  tapes: Record<string, { style: 'cassette' | 'phone'; label: string; brand?: string; length?: string; jingle?: boolean }>;
  berkas: Record<string, { years: string; motif: string; palette: string }>;
  /** identity cards: doc code → [name, habit, boat] */
  kenal: Record<string, [string, string, string]>;
  hints: string[];
  bekal: [key: string, text: string, why: string][];
  tugas: [docCode: string, text: string][];
  /** home card copy */
  card: {
    goal: string; audioHint: string; countdown: string; pill: string; brief?: string[];
    /** optional overrides for the home card (defaults are Nyewu's) */
    when?: string; voice?: string; sound?: 'oars' | 'jingle'; chip?: string; pillLine?: string; doneLabel?: string;
  };
  /** Nyewu-style envelope finale. Optional: cases without it close via `closeOn`. */
  finale?: {
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
  /** optional: rules per berkas code or doc code (default for berkas = sequential) */
  gates?: Record<string, Gate[]>;
  /** optional clue economy for puzzle hints: tokens = start + perStamp × stamps − spent */
  clues?: { start: number; perStamp: number; cost: number };
  /** optional per-document skin options, e.g. { "IV-07": { "me": "Ibu" } } */
  skinOptions?: Record<string, Record<string, unknown>>;
  /** optional: case has a final envelope (Nyewu-style). Absent → case ends when every puzzle is solved. */
  hasEnvelope?: boolean;
  /** optional: solving this puzzle closes the case (counts as "sent" for stats, share cards, collective gates) */
  closeOn?: { puzzle: string };
  /** optional: typed documents. "olympia" = the radio's machine (raised g, ink-filled e); "plain" = any other machine */
  typewriter?: Record<string, 'olympia' | 'plain'>;
  /** optional: archival photos printed above a document (src under /public) */
  photos?: Record<string, { src: string; caption: string; tall?: boolean }[]>;
  /** optional: evidence-board strings between these documents glow (pairs of doc codes) */
  boardLinks?: [string, string][];
  /** optional: puzzle keys listed in Desk ▸ Pertanyaan (the case's open questions) */
  questions?: string[];
  /** optional: which Desk tabs this case shows (default: Nyewu's set) */
  desk?: string[];
  /** optional: envelope look for the "letter" skin */
  letter?: { to: string; address: string; postmark: string };
  /** optional: the album's "Kenapa stamp?" paragraph */
  stampsWhy?: string;
};

export function skinOf(cfg: CaseConfig, code: string): SkinRow {
  if (cfg.skins[code]) return cfg.skins[code];
  for (const [prefix, row] of Object.entries(cfg.skinPrefixes || {})) if (code.startsWith(prefix)) return row;
  return ['note', 'Dokumen', 'report'];
}
