# Polynesian Gig Songbook

A tiny, dependency-free Markdown songbook built for phones, rehearsals, and gigs.

## What it does

- Automatically discovers Markdown songs in `content/original/` and `content/francais/`.
- Pairs original and French files by filename so each song appears **once** in the menu.
- Switches the currently displayed song between **ORIGINAL** and **FR** with one toggle.
- Collapsible song menu on desktop and a slide-out drawer on mobile.
- Song search plus previous / next controls.
- Adjustable lyrics size, remembered on the device.
- Remembers the selected language and desktop menu state.
- Optional screen wake lock for stage use.
- Caches the songbook after the first visit so it can keep working if the connection drops.
- Deploys automatically to GitHub Pages on every push to `main`.

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

FIRST LINE  
SECOND LINE  
THIRD LINE

## REFRAIN

REFRAIN LINE  
ANOTHER LINE
```

The numeric prefix controls menu order and is ignored when pairing the two language versions. For example, these files are treated as the same song:

```text
content/original/07-new-song.md
content/francais/07-new-song.md
```

A song may exist in only one folder; in that case the language toggle is disabled for that song.

Commit and push. The GitHub Action rebuilds the menu automatically — there is no manifest to edit by hand.

## Preview locally

Requires Node 22+.

```bash
npm run preview
```

Then open:

```text
http://localhost:4173
```

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
│   ├── index.html
│   └── styles.css
└── package.json
```

The generated `dist/` folder is intentionally ignored by Git. GitHub Actions creates it for deployment.
