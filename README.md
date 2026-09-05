# Polynesian Gig Songbook

A tiny, dependency-free Markdown songbook built for phones, rehearsals, and gigs.

## What it does

- Automatically discovers every `.md` file inside `content/`.
- Groups songs by folder.
- Mobile-friendly song navigation and search.
- Previous / next song controls.
- Adjustable lyrics size, remembered on the device.
- Optional screen wake lock for stage use.
- Caches the songbook after the first visit so it can keep working if the connection drops.
- Deploys automatically to GitHub Pages on every push to `main`.

## Add a song

Just add a Markdown file anywhere under `content/`:

```text
content/
  original/
    07-new-song.md
  francais/
    07-new-song.md
```

Example song:

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

Commit and push. The GitHub Action rebuilds the menu automatically — there is no manifest to edit by hand.

### Folder labels

Each folder can optionally contain `_group.json`:

```json
{
  "title": "PAROLES",
  "order": 1
}
```

If you omit it, the folder name is used as the section title.

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
