# Dutch Wood Artist

The production site is built by Netlify from `main` with `npm run build` and
published from `dist/`. It is a static site with no server functions, AI chat,
contact form or analytics scripts.

## Editing the site

- `index.html` is the source for the gallery and its approved full stories in
  `original-stories` and `news-stories`.
- `assets/gallery.js` controls the gallery, reader and responsive viewport.
- `seo/pages.json` defines canonical story URLs, search descriptions, social
  images and page types. It does not replace the artist's visible text.
- `seo/story.css` styles the standalone reading pages.
- `scripts/build-seo.mjs` extracts the stories, builds complete HTML pages and
  turns gallery story buttons into real links. Ordinary clicks still open the
  gallery reader; opening a link in a new tab loads its standalone page.
- The build generates the sitemap and `llms.txt` from the same page directory.
  It preserves the Google verification file. Retired preview URLs redirect
  to the gallery, and the former form confirmation redirects to contact.
- Shared styles and gallery JavaScript have content hashes; images have their
  actual dimensions. Executable inline scripts are blocked by the CSP.
- An optional Netlify build variable `INDEXNOW_KEY` writes the matching public
  verification file. It is not required to build or browse the site.

Run `npm ci`, `npm run build` and `npm run check` to reproduce and check the production files. Serve
`dist/` with a static HTTP server; do not publish the source repository root.
Do not edit generated `dist/` files. Keep unknown URLs as real 404 responses;
the static story pages do not need an SPA fallback rewrite.
Use unpublished Netlify draft deploys with `noindex` for review instead of
maintaining duplicate preview source files. Remove obsolete draft deploys
after review. The retired chat needs no API key or provider dependency.

Before publishing, check the generated page content and links, the gallery
reader and history behavior, and the layout on both narrow and wide screens.
Indexing and search positions are determined by search providers. Technical
SEO or an IndexNow receipt does not establish that a page has been indexed.
