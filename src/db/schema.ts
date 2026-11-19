import { pgTable, text, timestamp, boolean, integer, jsonb, serial, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/* Better Auth                                                          */
/* ------------------------------------------------------------------ */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Cases (CMS)                                                          */
/* ------------------------------------------------------------------ */
export type CaseStatus = 'draft' | 'sealed' | 'live';

export const cases = pgTable('case', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  no: text('no').notNull(),
  title: text('title').notNull(),
  tagline: text('tagline').notNull().default(''),
  hook: text('hook').notNull().default(''),
  author: text('author').notNull().default(''),
  status: text('status').$type<CaseStatus>().notNull().default('draft'),
  sort: integer('sort').notNull().default(0),
  /** presentation + game config (skins, tapes, berkas meta, hints, finale…) — see src/lib/case-config.ts */
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const berkas = pgTable('berkas', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  title: text('title').notNull(),
  intro: text('intro').notNull().default(''),
  sort: integer('sort').notNull(),
}, (t) => [uniqueIndex('berkas_case_code').on(t.caseId, t.code)]);

export const documents = pgTable('document', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  berkasCode: text('berkas_code').notNull(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  md: text('md').notNull(),
  sort: integer('sort').notNull(),
  /** null = readable; 'solve' = only after the kabar is sent; 'date' = after solve AND the unlock date */
  lock: text('lock').$type<'solve' | 'date'>(),
}, (t) => [uniqueIndex('document_case_code').on(t.caseId, t.code), index('document_case_sort').on(t.caseId, t.sort)]);

/** The names that are still waiting. Never sent to the browser until placed. */
export const answers = pgTable('answer', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  idx: integer('idx').notNull(),
  name: text('name').notNull(),
  aliases: jsonb('aliases').$type<string[]>().notNull(),
  habit: text('habit').notNull().default(''),
  question: text('question').notNull().default(''),
  year: integer('year').notNull(),
}, (t) => [uniqueIndex('answer_case_idx').on(t.caseId, t.idx)]);

/** Known wrong names → reply code (sampai, tidur, tahu, sini, darat, jo). */
export const wrongAnswers = pgTable('wrong_answer', {
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
  code: text('code').notNull(),
}, (t) => [primaryKey({ columns: [t.caseId, t.alias] })]);

/* ------------------------------------------------------------------ */
/* Readers & progress                                                   */
/* ------------------------------------------------------------------ */
/** A reader is anonymous (cookie) until they sign in; then userId is set. */
export const readers = pgTable('reader', {
  id: text('id').primaryKey(),
  userId: text('user_id').unique().references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Puzzles / locks. `config` is public (sent to the reader), `solution` never leaves the server. */
export const puzzles = pgTable('puzzle', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull().default(''),
  prompt: text('prompt').notNull().default(''),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  solution: jsonb('solution').$type<Record<string, unknown>>().notNull().default({}),
  reward: jsonb('reward').$type<Record<string, unknown>>().notNull().default({}),
  sort: integer('sort').notNull().default(0),
}, (t) => [uniqueIndex('puzzle_case_key').on(t.caseId, t.key)]);

/** Append-only reader events: the source for writer analytics. */
export const events = pgTable('event', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  readerId: text('reader_id').notNull(),
  kind: text('kind').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  at: timestamp('at').notNull().defaultNow(),
}, (t) => [index('event_case_kind_at').on(t.caseId, t.kind, t.at)]);

export type ProgressData = {
  read: Record<string, string>;
  opened: Record<string, boolean>;
  stamps: Record<string, string>;
  kenal: Record<string, string>;
  board: Record<string, string>;
  extra: string[];
  notes: string;
  bekal: Record<string, boolean>;
  placed: number[];
  recited: number[];
  tembangLine: number;
  believe: boolean;
  hintsShown: number;
  /** puzzles */
  solved: Record<string, string>;
  attempts: Record<string, number>;
  lastWrong: Record<string, string>;
  pzHints: Record<string, number>;
  tokensSpent: number;
  /** evidence board: pinned quotes + red strings ("idA|idB", sorted) */
  /** memory tests: puzzle key → answers ('b' benar, 's' salah, 't' tidak tahu) */
  memory?: Record<string, string[]>;
  pins?: Pin[];
  strings?: string[];
};
export type Pin = { id: string; code: string; text: string; x: number; y: number };

export const progress = pgTable('progress', {
  readerId: text('reader_id').notNull().references(() => readers.id, { onDelete: 'cascade' }),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  acceptedAt: timestamp('accepted_at'),
  sentAt: timestamp('sent_at'),
  data: jsonb('data').$type<ProgressData>().notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.readerId, t.caseId] }), index('progress_case_sent').on(t.caseId, t.sentAt)]);

/* ------------------------------------------------------------------ */
/* Co-op: up to four readers share one progress row (owned by a synthetic reader `room:<code>`). */
/* ------------------------------------------------------------------ */
export const rooms = pgTable('room', {
  code: text('code').primaryKey(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  progressId: text('progress_id').notNull().references(() => readers.id, { onDelete: 'cascade' }),
  hostId: text('host_id').notNull(),
  /** together = everyone sees everything; split = documents are dealt between seats */
  mode: text('mode').$type<'together' | 'split'>().notNull().default('together'),
  /** split mode: documents someone has put on the table for everyone */
  shared: jsonb('shared').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const roomMembers = pgTable('room_member', {
  code: text('code').notNull().references(() => rooms.code, { onDelete: 'cascade' }),
  readerId: text('reader_id').notNull().references(() => readers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  seat: integer('seat').notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  lastSeen: timestamp('last_seen').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.code, t.readerId] }), index('room_member_reader').on(t.readerId)]);

/** The room's table talk: chat lines and the activity feed. */
export const roomMsgs = pgTable('room_msg', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().references(() => rooms.code, { onDelete: 'cascade' }),
  readerId: text('reader_id').notNull(),
  kind: text('kind').notNull(),
  text: text('text').notNull(),
  at: timestamp('at').notNull().defaultNow(),
}, (t) => [index('room_msg_code_id').on(t.code, t.id)]);

/** Margin notes readers leave on a document for later readers. Shown only to those who've read it, redacted server-side. */
export const docNotes = pgTable('doc_note', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  readerId: text('reader_id').notNull(),
  name: text('name').notNull(),
  text: text('text').notNull(),
  hidden: boolean('hidden').notNull().default(false),
  at: timestamp('at').notNull().defaultNow(),
}, (t) => [index('doc_note_case_code').on(t.caseId, t.code, t.at)]);

/** "Kabari aku": readers waiting for a sealed case. */
export const waitlist = pgTable('waitlist', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  readerId: text('reader_id'),
  at: timestamp('at').notNull().defaultNow(),
  notifiedAt: timestamp('notified_at'),
}, (t) => [uniqueIndex('waitlist_case_email').on(t.caseId, t.email)]);

/** Serial mode: one document a morning, by email. */
export const serials = pgTable('serial', {
  readerId: text('reader_id').notNull(),
  caseId: integer('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  active: boolean('active').notNull().default(true),
  lastSentAt: timestamp('last_sent_at'),
  lastCode: text('last_code'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.readerId, t.caseId] })]);
