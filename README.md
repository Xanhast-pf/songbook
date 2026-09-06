# Polynesian Gig Songbook

A tiny, dependency-free Markdown songbook built for phones, rehearsals, and gigs.

## What it does

- Automatically discovers Markdown songs in `content/original/` and `content/francais/`.
- Pairs original and French files by filename so each song appears **once** in the menu.
- Switches the currently displayed song between **ORIGINAL** and **FR** with one toggle.
- Collapsible song menu on desktop and a slide-out drawer on mobile.
- Numbered song navigation with search; keyboard arrow navigation remains available on desktop.
- Standard Markdown links and bare `http(s)` URLs are clickable and open in a new tab.
- **ChordPro-style inline chords** such as `[G]`, `[F#m7]`, `[Bbmaj7]`, and `[D/F#]`.
- Chords render directly **above the word or syllable where the change happens**.
- **CHORDS ON/OFF** control appears automatically when the current Markdown file contains chords.
- **Transpose − / reset / +** changes every supported chord by semitone without modifying the Markdown source.
- Transposition is remembered **per song** on the device.
- Chord visibility, language, font size, column count, desktop menu state, and theme are remembered.
- Light/dark theme toggle; **dark mode is the default** on first visit.
- **1 / 2 / 3-column lyrics layout** for long songs; the preference is remembered and narrow phones fall back to one readable column.
- Optional screen wake lock for stage use.
- Caches the songbook after the first visit so it can keep working if the connection drops.
- Deploys automatically to GitHub Pages on every push to `main`.
- Runs the pinned **Coding Bible v0.27.0** full-project scan before every deployment; error-level findings block Pages deployment.
- Styling follows the project's Coding Bible conventions: semantic tokens, `rem` sizing, a quarter-rem spacing scale, and `px` reserved for precision borders/accessibility helpers.

## Add a song

Put the original and French versions in the matching folders using the **same filename**:

```text
content/
  original/
    07-new-song.md
  francais/
    07-new-song.md
```

Example:

```md
# MY SONG

**ARTIST NAME**

[▶ WATCH ON YOUTUBE](https://www.youtube.com/watch?v=VIDEO_ID)

[G]FIRST LINE WITH A [D]CHORD CHANGE  
[Em]SECOND LINE GOES [C]HERE

## REFRAIN

[G]REFRAIN LINE  
[D]ANOTHER [G]LINE
```

The chord goes immediately before the exact word or syllable where it changes:

```md
[G]TAGI HEVA TE [D]TAI
KI TUA KI VAHO TE [Em]HENUA IHO NEI
[C]KI RUGA RUARAGI TE [G]AO
[D]KUA PO KI RARO [G]NEI
```

On the page, those chord names appear above `TAGI`, `TAI`, `HENUA`, and so on. If **CHORDS** is switched off, the `[G]`, `[D]`, etc. disappear and only the lyrics remain.

### Supported chord notation

Common guitar / ukulele chord names work out of the box, including:

```text
[G]
[Am]
[F#m7]
[Bbmaj7]
[Dsus4]
[Cadd9]
[D/F#]
[N.C.]
```

The transposer handles roots and slash-bass notes. For example, transposing `D/F#` up two semitones displays `E/G#`. The original Markdown is never changed.

Normal Markdown links are not confused with chords:

```md
[▶ WATCH ON YOUTUBE](https://youtube.com/...)
```

The numeric prefix controls menu order and is ignored when pairing the two language versions. For example, these files are treated as the same song:

```text
content/original/07-new-song.md
content/francais/07-new-song.md
```

A song may exist in only one folder; in that case the language toggle is disabled for that song. Chords can be present in either language file, though in practice you will probably place them only in the original lyrics.

Commit and push. The GitHub Action rebuilds the menu automatically — there is no manifest to edit by hand.

## Quality gate

The Pages workflow runs Coding Bible before tests/build:

```yaml
- uses: Xanhast-pf/coding-bible@v0.27.0
  with:
    scope: project
    path: .
    fail-on: error
    sarif: false
```

The release tag is pinned deliberately so the gig site does not change analyzer behavior unexpectedly. Update the tag explicitly when you want to adopt a newer Coding Bible release.

## Preview locally

Requires Node 22+.

```bash
npm run preview
```

Then open:

```text
http://localhost:4173
```

Run the chord/transposition and styling-contract tests with:

```bash
npm test
```

The styling contract keeps `rem` values on quarter-rem increments, limits `px` to one-pixel precision work, and prevents component rules from bypassing the palette tokens. Both light and dark themes consume the same semantic color tokens.

## Publish on GitHub Pages

1. Create a GitHub repository and upload/push this project to the `main` branch.
2. Open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Open the **Actions** tab and let the `Deploy songbook to GitHub Pages` workflow finish.
5. Your Pages URL will appear in the deployment summary and in **Settings → Pages**.

After that, adding or editing Markdown files only requires another push to `main`.

## Structure

```text
.
├── .github/workflows/pages.yml
├── content/
│   ├── original/
│   └── francais/
├── scripts/
│   ├── build.mjs
│   └── serve.mjs
├── site/
│   ├── app.js
│   ├── chords.js
│   ├── index.html
│   └── styles.css
├── test/
│   └── chords.test.mjs
└── package.json
```

The generated `dist/` folder is intentionally ignored by Git. GitHub Actions creates it for deployment.
