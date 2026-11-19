# Writing a case for postmortem

A case is a folder in `content/<slug>/`: one markdown file per berkas, plus `case.json`. The fastest start is to copy `content/lab/` (the Lab demo case shows every skin and every lock) and edit it. You can also do everything from `/admin`.

## 1. Files

```
content/<slug>/
  00-pengantar.md     # Berkas 0
  01-....md           # Berkas I
  ...
  case.json           # metadata, config, answers, puzzles
```

Each berkas file:

```md
# Berkas II · Gembok

## II-01 · Document title

Document body in markdown.
```

The code (`II-01`) is the document's address. Order follows the file order.

General conventions inside every document:
- `&#91;Note…\]` on its own line → an editor's note (archive card). `&#91;Catatan saya: …\]` → red-pencil note. `&#91;Catatan Gita …\]` / anything starting with "pulpen hijau" → green pen.
- `> quote` → blockquote. Blockquote lines in the `**Name** HH:MM text` format → a chat screen.
- `::puzzle[key]` on its own line → a lock/puzzle at that spot.

## 2. Skins (pick per document in `config.skins`)

`"I-01": ["email", "Email", "letter"]`: [skin, label in the archive, icon].

| Skin | Markdown convention |
| --- | --- |
| `newspaper`, `gov`, `report`, `notulen`, `ledger`, `letter`, `rukmini`, `field`, `thesis`, `story`, `journal`, `web`, `receipt`, `note` | Plain markdown; the look comes from the skin. `report` gets a RAHASIA watermark; `receipt` is thermal paper. |
| `email` | Each email is a `### Subject` followed by `From:`, `To:`, `Date:` lines, then the body. |
| `sms` | A blockquote with `**Name** HH:MM text`. Who "me" is: `skinOptions: { "I-02": { "me": "Saya", "title": "Wening" } }`. |
| `chat` | Same as sms, in a modern chat style. |
| `voicemail` | `- **Caller** · when · 0:21 — transcript`. The transcript is read aloud by the device's voice. |
| `feed` | Each post: `### @handle · date`, the text, optional `![caption](url)`, and `♥ 23 · 4 komentar`. |
| `gallery` | `- [caption](url) — note`. Without a url → a colored tile with the caption. |
| `browser` | `### Day`, then `- 22:14 · query or domain.com/path`. |
| `cctv` | `**CAM 02 · 00:47:10** event`. |
| `idcard` | `- Nama: …`, `- Lahir: …` etc. Title & place via `skinOptions`. |
| `route` | `- 20:51 · Place — note`. |
| `phone` | A found phone. Each `### App` becomes an app: Pesan, Galeri, Catatan, Riwayat, Email, Telepon, Lokasi. `skinOptions`: `me`, `time`, `date`. |
| `tape`, `tape-phone` | Transcript with `[00:31]` timestamps; lines `**NAME:** text`; sounds `*[…]*`. Label in `config.tapes`. Text containing "dayung" starts the oars, "sembilan detik" plays 9 s of static. |
| `photo`, `map`, `sketch`, `stampcard` | Built-in exhibits (photo you can flip, clickable map, sketch, identity-card stamp). |

## 3. Locks & puzzles (`case.json → puzzles`)

The `solution` is stored only on the server; the reader never receives it.

```json
{ "key": "loker", "kind": "padlock", "title": "Locker padlock", "prompt": "Four digits.",
  "config": { "length": 4, "charset": "digits" },
  "solution": { "code": "1924", "hints": ["clue 1", "clue 2"], "wrongMessage": "Not yet." },
  "reward": { "message": "Click. The locker opens.", "stamp": { "title": "Loker", "motif": "key", "palette": "ochre", "year": "1924" } } }
```

| kind | config (public) | solution (secret) |
| --- | --- | --- |
| `text` | `placeholder` | `answers: [...]`, optional `replies: { "wrong answer": "specific reply" }` |
| `cipher` | `ciphertext` (Caesar; the reader gets a shift wheel) | `answers: [...]` |
| `padlock` | `length`, `charset: digits/letters` | `code` |
| `date` | `from`, `to` (year range) | `date: "YYYY-MM-DD"` |
| `order` | `items: [{id,text}]`, in the order shown | `order: [ids]` |
| `match` | `left: [{id,text}]`, `right: [{id,text}]` | `pairs: { leftId: rightId }` |
| `hotspot` | `image` (url) or `art: photo/map/sketch`, `alt` | `x`, `y`, `r` (percent of the image) |
| `frequency` | `min`, `max` (MHz) | `freq`, `tol`. The server only sends back signal strength, so the reader hunts by the hiss. |

Every lock has a cooldown after 5 wrong tries (8 seconds), and every attempt is logged for analytics.

**Clue economy** (optional): `config.clues = { "start": 2, "perStamp": 1, "cost": 1 }` means the reader starts with 2 tokens, earns +1 per berkas stamp, and each puzzle clue costs 1.

## 4. Gates (`config.gates`)

By default a berkas opens once the last document of the previous berkas has been read. You can replace that with any rules (all of them must pass):

```json
"gates": {
  "III":    [{ "type": "puzzle", "key": "loker" }],
  "III-02": [{ "type": "kliwon" }],
  "III-03": [{ "type": "date", "at": "2027-02-11T18:00" }],
  "IV":     [{ "type": "read", "code": "III-01" }, { "type": "collective", "threshold": 1000 }]
}
```

`sequential` · `read` · `puzzle` · `date` (WIB) · `kliwon` (only on malam Jumat Kliwon, WIB) · `collective` (N readers worldwide have finished). A berkas code locks the whole berkas; a document code locks one document (it shows up as a padlocked row in the archive).

## 5. Finale: the envelope (optional)

`config.finale` turns one berkas into an envelope: the reader writes names, recites them, reads the tembang, then presses Kabari. Fill in `answers` (names + aliases) and `wrong` (wrong names → reply code). See `content/nyewu/case.json`.

## 6. Publishing

`npm run db:seed -- <slug>` (local), or `/admin` → New case → upload `.md` → paste config/answers/puzzles → status `live`. A `draft` case can be previewed by admins at `/c/<slug>`.

Shipping content edits from the repo: deploys only seed cases that aren't in the database yet (so `/admin` edits are never overwritten). To push a new version of a case from `content/<slug>/`, bump `config.contentVersion` in its `case.json`.

## 7. Before launch: the sealed card

Set status `sealed` and add to config:

```json
{ "opensAt": "2027-01-17T19:00:00+07:00", "teaser": "Satu kalimat yang bikin orang menunggu." }
```

The home card shows a live countdown and a **Kabari aku** waitlist. When you flip the case to `live`, `/admin/<slug>` shows **Kabari N orang**: one email per address, once.

## 8. Things every case gets for free

You don't configure these; they work on any case.

- **Co-op tables** (Desk ▸ Prep ▸ Main bareng): up to 4 readers share one progress. In *Terbagi* mode each berkas' documents are dealt between seats (Berkas 0 and the finale stay shared), so readers have to tell each other what they hold. Write documents that make sense on their own and pay off when combined.
- **Evidence board** (Desk ▸ Papan): readers select any sentence, pin it, and tie red strings between quotes. A good case has sentences that want to be pinned together.
- **Margin notes**: public notes under each document, visible only after reading it. Every answer name/alias and every lock solution is scrubbed to ▮▮▮ on the server, so keep `aliases` complete.
- **Collective gate**: `{ "type": "collective", "threshold": 500 }` on a berkas or document opens it for *everyone* once that many readers have sent the kabar. The archive shows a shared meter.
- **Morning letters** (Desk ▸ Prep ▸ Surat pagi): one document's opening lines by email at 06.00 WIB until the reader is done. Strong first lines matter.
- **Share cards**: earned stamps, rank, and a spoiler-free "kabar sudah sampai" card, rendered as 1080×1920 images.
