# postmortem●

**Case files you solve by reading.** Interactive literary cases (*perkara*): every story is an archive you open, read, and solve. Each document is designed to look like the real object it stands for: newspaper clippings, minutes, envelopes, cassettes, WhatsApp screens.

### Why "postmortem"
- **post**: mail, stamps, postmarks. The world of this series is the *Seksi Surat Mati* (dead letter office).
- **mortem**: death. Every case starts from a death that hasn't finished yet.
- **postmortem**: an autopsy, a review after the fact. That's what the reader does.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`), **React 19**, **TypeScript** strict |
| Database | **PostgreSQL** + **Drizzle ORM** (typed schema in `src/db/schema.ts`, `drizzle-kit push`) |
| Auth | **Better Auth**: email magic link (Resend) + Google OAuth, sessions in Postgres |
| Audio | Web Audio API (tape hiss, oar strokes every 4 s, static), all generated, no audio files |
| Art | SVG stamps/photo/map/sketch generated on the server |
| Deploy | Vercel + Neon/Supabase (or any Node host + Postgres) |

## Backend features

1. **Answers checked on the server.** The 26 names never reach the browser. `placeName` (Server Action) matches the aliases in the `answer` table; wrong names get a reply code from `wrong_answer` ("Dia sudah sampai.", etc.).
2. **Locked content stays on the server.** IX-03 is only rendered after `sent_at` is set; IX-04 only after solving **and** the server date ≥ `finale.epilogueDate`. Changing the device clock does nothing.
3. **Read order enforced by the server.** A berkas opens only after the last document of the previous berkas has been read. Stamps are awarded by the server.
4. **Accounts + progress sync.** Every visitor gets an anonymous reader (`pm_reader` cookie, set in `proxy.ts`) and progress is stored in the DB right away. On sign-in (magic link/Google), the anonymous progress is claimed or merged into the account → the same on every device.
5. **Global counter.** "N readers have sent the kabar": computed live from `progress.sent_at`, shown on the home screen and in IX-03.
6. **Admin / CMS** at `/admin` (only for `ADMIN_EMAILS`): create a case, change status (`draft` / `sealed` / `live`), upload berkas `.md` files, edit config JSON & answers, see reader/kabar stats.

## Structure

```
content/<slug>/*.md        archive source, one file per berkas (# Berkas IV · Windu / ## IV-01 · Title)
content/<slug>/case.json   metadata + config + answers (seed). CONTAINS THE ANSWER KEY.
bible/                     world bible (spoiler)
scripts/seed.ts            content/ → database
src/db/                    Drizzle schema + client
src/lib/game.ts            reader identity, progress, read-order rules, counter
src/app/actions.ts         Server Actions: markRead, placeName, recite, tembang, sendKabar, desk
src/app/admin/             CMS (pages + actions)
src/lib/render-doc.ts      document skins → HTML (server)
src/lib/md.ts, svg.ts      archive markdown renderer, SVG stamps/art
src/components/            Shell (device frame, toasts, sheets), Home carousel, DocReader, Kabar, Stamps, Desk
```

## Running locally

```bash
cp .env.example .env            # fill in DATABASE_URL + BETTER_AUTH_SECRET + ADMIN_EMAILS
npm install
npm run db:push                 # create the tables
npm run db:seed                 # load Case 01 Nyewu (+ 2 sealed placeholders)
npm run dev                     # http://localhost:3000
```

Without `RESEND_API_KEY`, the magic link is **printed to the server log** (and in dev it can be read at `/api/dev/magic?email=…`). To rehearse the date-based ending: `PM_TODAY=2027-02-13 npm run dev` (ignored in production). Night mode: `?kliwon=1`.

## Deploy (Vercel + Neon)

1. Create a Postgres database on Neon (or Supabase) → copy the connection string (`?sslmode=require`).
2. Import this repo into Vercel. Set the env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (production URL), `ADMIN_EMAILS`, `RESEND_API_KEY` + `EMAIL_FROM` (verified domain), optionally `GOOGLE_CLIENT_ID/SECRET` (redirect URI: `https://<domain>/api/auth/callback/google`).
3. From your machine, once: `DATABASE_URL=<neon> npm run db:push && DATABASE_URL=<neon> npm run db:seed`.
4. Deploy. Sign in with an email from `ADMIN_EMAILS` → `/admin`.

## Adding a case

Via the CMS: `/admin` → *New case* → upload the berkas `.md` files → fill in config (copy from `content/nyewu/case.json` as a template) & answers → set status to `live`. Or via the repo: create `content/<slug>/` with `case.json` + `.md` files, then `npm run db:seed -- <slug>`.
