# Rio Wirawan — Android Developer Portfolio

Static portfolio site built with Astro, strict TypeScript, and Three.js (used directly, without React). It deploys to GitHub Pages:
**https://oriorasajambu.github.io/android-portfolio/**

## Local development

Requires Node 24 (see `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:4321/android-portfolio/
npm run verify     # type check, build, budgets, links, browser tests
```

Each command:

| Script | Purpose |
|---|---|
| `npm run build` / `npm run preview` | Static build to `dist/` and a local preview served under the Pages base path |
| `npm run check` | `astro check` (TypeScript + content schemas) |
| `npm run check:budget` | Compressed transfer budgets (initial ≤600KB, JS ≤75KB, 3D ≤1MB, desktop 10s ≤1.6MB) |
| `npm run check:links` | Every internal href/src resolves under `/android-portfolio/`, including `#anchors` |
| `npm test` | Playwright tests (first run: `npx playwright install chromium`) |
| `npm run cv:build` / `npm run check:cv` | Regenerate and verify the public CV (needs Python with `pypdf`) |

## Editing content

All public text comes from `src/content/`. The schemas in `src/content.config.ts` validate it at build time.

- `profile.json` holds the name, title, summary, email, experience, education, courses and links. The homepage, footer and public CV all read from it. Add a profile link only after you have checked that its URL is correct.
- `studies/*.md` holds the feature studies. The frontmatter holds the structured facts (context, contribution, team boundary, responsibilities, technologies). The Markdown body is the narrative. A file's name becomes its URL slug, under `/work/<slug>/`.
- `walkthrough.json` holds the three illustrative screens per feature. Each step also has up to three numbered `pins`; `x` and `y` are percentages of the screen. The pins appear on the phone in 2D and 3D, and their text fills the "What to notice" list. The 2D gallery, the no-JS sequence and the Three.js textures all read from it.

**Content rules.** Only publish claims that have been confirmed. Leave out metrics, test authorship or ownership that have not been verified; don't add placeholders for them. Never copy production code, internal contracts, endpoints, screenshots or confidential diagrams.

### Illustrations and asset labels

Phone screens (`public/showcase/`) and study diagrams (`public/diagrams/`) are original drawings that use synthetic data. They come from `scripts/gen-illustrations.mjs`:

```bash
node scripts/gen-illustrations.mjs
```

Every walkthrough step has a `kind` of either `illustration` or `approved-image`, and the site shows that label next to the image. The showcase, the study sequences and the diagrams are always labelled as illustrations. Phone screens carry no bank branding.

### Public CV

`public/rio-wirawan-cv.pdf` is generated from `profile.json`. It has no phone number, no street address, and no source metadata:

```bash
npm run cv:build && npm run check:cv
```

`check:cv` reads exact private values (the old phone number and address) from `private/cv-forbidden.txt`. That file is gitignored and exists only on the author's machine. On any other clone, and in CI, only the generic checks run. `check:cv` does two things. It extracts the PDF text to confirm the expected content is there and the private details are not. It also confirms that the only metadata keys are Title and Author. After regenerating, check the PDF visually as well. The original CV is kept **outside** this repository.

The social image `public/og.png` comes from `node scripts/build-og.mjs`.

## Architecture

- **Pages:** `/`, `/work/qr-payments/`, `/work/card-management/` and `/404.html`. A sitemap is at `/sitemap.xml`.
- **Base path:** `astro.config.mjs` sets `site` and `base: '/android-portfolio'`. Internal URLs are built with `withBase()` (`src/lib/url.ts`), so the routes, textures, fonts, CV, canonical URLs, sitemap and social image all stay consistent.
- **Showcase:** `src/components/Showcase.astro` renders all six screens as HTML. With JavaScript enabled, `src/scripts/showcase.ts` shows one screen at a time, driven by the shared store in `src/scripts/viewer-state.ts`. That store holds the selected feature, step, display mode and status.
- **3D:** `src/scripts/phone-scene.ts` is loaded only through a dynamic `import()`.
  - It renders only on demand and pauses while offscreen or in a background tab.
  - The pixel ratio is capped at 1.5 on desktop and 1 on mobile.
  - It releases every resource on teardown.
  - When it starts on its own: on desktop, after the page loads and the showcase is visible.
  - When it waits for the visitor to choose "Enable 3D": on narrow viewports, coarse pointers, Save-Data and reduced motion.
  - Fallback: if WebGL 2 is missing, a texture fails, the renderer fails or the context is lost, the site returns to the matching 2D screen and keeps the selection.
- **Theme:** an inline head script applies the stored or system theme before first paint. Storage access is wrapped so it can never throw.

## Deployment

The workflow is `.github/workflows/deploy.yml`.

1. Every push to `main` runs the type check, build, budgets, link check and browser tests. Only if all of them pass does it deploy to GitHub Pages.
2. Pages is configured with **Source: GitHub Actions**.

### Rollback

Each build uploads its Pages artifact and keeps it for 30 days. To roll back to an earlier version without rebuilding:

1. Go to **Actions → Deploy to GitHub Pages** and open the last good run.
2. Re-run **only the `deploy` job**. It reuses that run's artifact.

The CLI equivalent:

```bash
gh run rerun <run-id> --job <deploy-job-id>
```

Once the artifact has expired, revert the bad commit and push it to `main` instead.

### Dependency updates

```bash
npm outdated
npm install <pkg>@<version>
npm run verify
```

Commit `package-lock.json` along with the change. When you upgrade Three.js, also check the 3D budget and the context-loss tests.

### Later: Firebase Hosting (not set up)

To move later:

1. Create a Firebase project.
2. `firebase init hosting` with `public: dist`.
3. Set `base: '/'` and the new `site` in `astro.config.mjs`.
4. Update `SITE`/`BASE` in `scripts/check-links.mjs` and `scripts/check-budget.mjs`, and the CV link in `scripts/build-cv.mjs`.
5. Deploy with `firebase deploy`, or with a GitHub Action that uses a service-account secret.

v1 has no GCP resources and no second deployment.

## Validation status

Automated (Playwright, Chromium with SwiftShader WebGL) covers:

- navigation, direct study URLs and refresh, and the 404 page
- feature and step selection, including 2D/3D continuity
- theme preference, and theme behaviour when storage is unavailable
- WebGL being unavailable, texture and module failure, retry, and context loss
- reduced motion, Save-Data, narrow and touch viewports, and resizing
- the CV download, and the clipboard fallback
- complete content with JavaScript disabled

**Not yet validated (needs manual checks on real devices):**

- Android Chrome on a midrange device, including the ≥30fps target for the 3D view
- iOS Safari
- Firefox and desktop Safari
- Screen-reader reading order (TalkBack, VoiceOver and NVDA)
- Real-user Core Web Vitals. Lab checks do not establish field percentiles.
