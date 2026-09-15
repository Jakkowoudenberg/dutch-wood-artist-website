# Dutch Wood Artist

The production site is built by Netlify from `main` with `npm run build` and
published from `dist/`. The existing functions in `netlify/functions/` are
deployed alongside it.

## Editing the site

- `index.html` is the source for the gallery and its approved full stories in
  `original-stories` and `news-stories`. Keep the matching gallery preview in
  `preview-gallery.html` in sync when changing the visible gallery.
- `seo/pages.json` defines canonical story URLs, search descriptions, social
  images and page types. It does not replace the artist's visible text.
- `seo/story.css` styles the standalone reading pages.
- `scripts/build-seo.mjs` extracts the stories, builds complete HTML pages and
  turns gallery story buttons into real links. Ordinary clicks still open the
  gallery reader; opening a link in a new tab loads its standalone page.
- The build generates the sitemap and `llms.txt` from the same page directory.
  It preserves the Google verification file. Preview URLs stay `noindex`.
- Shared styles have content hashes; images have their actual dimensions.
- An optional Netlify build variable `INDEXNOW_KEY` writes the matching public
  verification file. It is not required to build or browse the site.

Run `npm ci`, `npm run build` and `npm run check` to reproduce and check the production files. Serve
`dist/` with a static HTTP server; do not publish the source repository root.
Do not edit generated `dist/` files. Keep unknown URLs as real 404 responses;
the static story pages do not need an SPA fallback rewrite.

Before publishing, check the generated page content and links, the gallery
reader and history behavior, and the layout on both narrow and wide screens.
Indexing and search positions are determined by search providers. Technical
SEO or an IndexNow receipt does not establish that a page has been indexed.
