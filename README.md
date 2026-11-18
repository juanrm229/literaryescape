# literary escape

Interactive literary cases (*perkara*): stories told as archives you have to open, read, and solve. Every document is designed to look like the real object it stands for: a newspaper clipping, minutes in a lined book, an envelope you open, a cassette that plays, a WhatsApp screen, an online news page with its comment section.

## Case 01 · Nyewu

*An archive of death notices that never arrived.* 97 documents across 10 files (Berkas 0–IX). Berkas IX is locked, and the key is a list of names.

### Features
- **"Ambil perkara ini?" (Take the case?)**: the case's front door. Pressing ✓ cannot be undone.
- **Sequential reading**: each Berkas opens once the last document of the previous one has been read.
- **Document skins**: newspaper, typewritten report, minutes and ledgers (lined paper), letters in an envelope with stamp and postmark, Mbah Rukmini's notebook, cassette and phone recording players (Web Audio: tape hiss, an oar stroke every 4 seconds, 9 seconds of static), the photo you can flip (I-07), the clickable map (I-08), the footprint sketch (IV-09), WhatsApp, the news portal and comments, the hardcover thesis, Gita's field notes in green ink.
- **Editor notes in the margins**: Warta's notes in red pencil, Gita's in green pen, Pak Wiryo's slips taped to envelopes.
- **Perangko (stamps)**:
  1. *Read postmark*: every document gets a TERBACA stamp with the Javanese date (day + pasaran) of the day you read it.
  2. *Berkas stamps*: 10 stamps, awarded each time a Berkas is finished.
  3. *Kartu kenal (identity cards)*: 19 stamps from Berkas VIII.
  4. *Kabar stamps*: the final puzzle. An envelope addressed to "Laut" (the sea) with 26 blank stamps. You write the names yourself, then "say" each one (*Segara wis nyimpen jenengmu. Wis ya.*), read the tembang (song), and press **Kabari** (send the news).
- **Meja Penyidik (investigator's desk)**: a checklist, a 41-name board (status: unknown/waiting/arrived), a pasaran calendar, and notes.
- **"Aku percaya ini nyata" (I believe this is real) switch**: wet footprints appear and the Berkas IX form locks itself (law 5). "Ini cuma cerita" (it's only a story) turns it off.
- **Real calendar**: on a malam Jumat Kliwon (a Thursday night whose Friday falls on Kliwon), the page is speckled with salt and faint oars can be heard. The windu countdown runs to 11 Feb 2027; IX-04 only appears after 12 Feb 2027 *and* if the puzzle has been solved.
- **Answers are not stored in plaintext**: names are hashed, and IX-03/IX-04 are encrypted with a key that only exists once all 26 names have been found.

## Structure
```
content/nyewu/*.md      archive source (one file per Berkas) — edit here
scripts/build.mjs       md -> site/data/nyewu.js (splits documents, hashes answers, encrypts IX-03/04)
scripts/bundle.mjs      site/ -> dist/literary-escape.html (single self-contained file)
site/                   the site to deploy (static, no framework)
bible/                  world bible — CONTAINS THE ANSWER KEY, do not deploy
```

## Running it
```
npm run serve     # build + serve site/ at http://localhost:8080
npm run bundle    # build + one HTML file in dist/
```
Only deploy the `site/` folder (e.g. GitHub Pages from a workflow, or Netlify/Vercel with `site` as the publish dir). Do not publish the repo root, because `content/` and `bible/` contain spoilers.

Testing parameters: `?unlock=all` (open every Berkas), `?kliwon=1` (force Kliwon mode), `?today=2027-02-13` (simulate a date), `?reset=1` (wipe progress).

## Adding a case
Add `content/<case>/`, a config in `site/assets/js/case-<case>.js` (skins, labels, hints), and an entry in `scripts/build.mjs`. The renderer, stamps, tape player, and router are case-agnostic.
