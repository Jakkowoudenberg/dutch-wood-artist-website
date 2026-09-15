import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse, parseFragment, serialize, serializeOuter } from 'parse5';
import { imageSize } from 'image-size';

// The gallery templates remain the single source of the approved story text.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
const origin = 'https://dutchwoodartist.com';
const pages = JSON.parse(await readFile(resolve(root, 'seo/pages.json'), 'utf8'));
const storyPaths = Object.fromEntries(pages.map(page => [page.key, page.path]));
storyPaths.why = storyPaths.commissions + '#why';
storyPaths['inssaei-photos'] = storyPaths.inssaei + '#photographs';
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const hasClass = (node, name) => (attr(node, 'class') || '').split(/\s+/).includes(name);
function setAttr(node, name, value) {
  const current = node.attrs.find(item => item.name === name);
  if (current) current.value = String(value);
  else node.attrs.push({ name, value: String(value) });
}
function removeAttr(node, name) { node.attrs = node.attrs.filter(item => item.name !== name); }
function walk(node, callback, templates = true) {
  callback(node);
  for (const child of node.childNodes || []) walk(child, callback, templates);
  if (templates && node.content) walk(node.content, callback, templates);
}
function findAll(node, predicate, templates = true) {
  const found = [];
  walk(node, item => { if (predicate(item)) found.push(item); }, templates);
  return found;
}
function find(node, predicate) {
  const result = findAll(node, predicate)[0];
  if (!result) throw new Error('Required gallery content is missing.');
  return result;
}
function remove(node) {
  node.parentNode.childNodes = node.parentNode.childNodes.filter(child => child !== node);
}
function append(parent, node) { node.parentNode = parent; parent.childNodes.push(node); }
function appendHtml(parent, html) {
  for (const node of [...parseFragment(html).childNodes]) append(parent, node);
}
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const fullUrl = path => origin + path;
const source = await readFile(resolve(root, 'index.html'), 'utf8');
const sourceDoc = parse(source);
const archive = find(sourceDoc, node => attr(node, 'id') === 'original-stories').content;
const stories = {};
const tabs = { manifesto: 'Manifesto', why: 'Why', artist: 'The Artist', commissions: 'Commissions', uwfl: 'UWFL project', gemikigai: 'Gemikigai', 'between-doors': 'Between Doors', contact: 'Contact' };
for (const [key, tab] of Object.entries(tabs)) {
  const section = find(archive, node => attr(node, 'data-tab') === tab);
  stories[key] = serialize(find(section, node => hasClass(node, 'col')));
}
const works = find(find(archive, node => attr(node, 'data-tab') === 'Works'), node => hasClass(node, 'col'));
const workNodes = works.childNodes.filter(node => node.tagName);
let figureCount = 0;
const split = workNodes.findIndex(node => node.tagName === 'figure' && ++figureCount === 2);
if (split < 0) throw new Error('The two work stories could not be separated.');
stories.nightwatch = workNodes.slice(1, split).map(serializeOuter).join('\n');
stories.inssaei = workNodes.slice(split).map(serializeOuter).join('\n');
stories.book = serialize(find(sourceDoc, node => attr(node, 'data-news') === 'book'));

const sizes = new Map();
for (const name of await readdir(resolve(root, 'images'))) {
  if (/\.(png|jpe?g|webp)$/i.test(name)) sizes.set('/images/' + name, imageSize(await readFile(resolve(root, 'images', name))));
}
function normalizeImages(doc, story = false) {
  let first = true;
  walk(doc, node => {
    if (node.tagName !== 'img') return;
    const src = attr(node, 'src');
    if (!src || /^(?:https?:|data:)/.test(src)) return;
    const path = '/' + src.replace(/^\//, '');
    const size = sizes.get(path);
    if (!size) throw new Error('Missing image or dimensions: ' + src);
    setAttr(node, 'src', path);
    setAttr(node, 'width', size.width);
    setAttr(node, 'height', size.height);
    if (story) {
      const hiddenCover = hasClass(node, 'bg') || hasClass(node, 'logo');
      setAttr(node, 'loading', first && !hiddenCover ? 'eager' : 'lazy');
      if (first && !hiddenCover) { setAttr(node, 'fetchpriority', 'high'); first = false; }
      setAttr(node, 'decoding', 'async');
    }
  });
}

const home = {
  path: '/', label: 'Dutch Wood Artist', type: 'home',
  title: 'Art Floors & Wood Art | Jakko Woudenberg — Dutch Wood Artist',
  description: 'One-of-a-kind art floors and monumental wood art by Jakko Woudenberg. Bespoke commissions for architects, interior designers and distinctive spaces.',
  image: '/images/og-image.jpg', imageAlt: 'Dutch Wood Artist — monumental artworks in wood'
};
const personId = origin + '/artist/#jakko-woudenberg';
const siteId = origin + '/#website';
function structuredData(page) {
  const url = fullUrl(page.path), pageId = url + '#webpage';
  const person = {
    '@type': 'Person', '@id': personId, name: 'Jakko Woudenberg', url: origin + '/artist/',
    jobTitle: 'Master parquet craftsman and monumental artist',
    description: 'Dutch master parquet craftsman and monumental artist, based in Schagen, the Netherlands.',
    image: origin + '/images/Foto_Jakko_op_visgraat_met_nachtwacht_schilderij.jpg',
    brand: { '@type': 'Brand', name: 'Dutch Wood Artist', url: origin + '/' },
    address: { '@type': 'PostalAddress', addressLocality: 'Schagen', addressCountry: 'NL' },
    award: ['Vakwerk Award 2020', 'WFB Design Award 2020', 'CFJ Award 2021']
  };
  const website = { '@type': 'WebSite', '@id': siteId, url: origin + '/', name: 'Dutch Wood Artist', alternateName: 'DWA', inLanguage: 'en', publisher: { '@id': personId } };
  const webPage = {
    '@type': page.type === 'profile' ? 'ProfilePage' : page.type === 'contact' ? 'ContactPage' : 'WebPage',
    '@id': pageId, url, name: page.title, description: page.description, inLanguage: 'en',
    isPartOf: { '@id': siteId }, about: { '@id': personId },
    primaryImageOfPage: { '@type': 'ImageObject', url: fullUrl(page.image), caption: page.imageAlt }
  };
  const graph = [website, person, webPage];
  if (page.path !== '/') {
    const breadcrumbId = url + '#breadcrumb';
    webPage.breadcrumb = { '@id': breadcrumbId };
    graph.push({ '@type': 'BreadcrumbList', '@id': breadcrumbId, itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Dutch Wood Artist', item: origin + '/' },
      { '@type': 'ListItem', position: 2, name: page.label, item: url }
    ] });
  }
  if (page.type === 'profile') webPage.mainEntity = { '@id': personId };
  if (page.type === 'artwork') {
    const id = url + '#artwork';
    webPage.mainEntity = { '@id': id };
    graph.push({ '@type': 'VisualArtwork', '@id': id, name: page.label, url,
      description: page.description, image: fullUrl(page.image), creator: { '@id': personId }, artMedium: 'Wood',
      ...(page.key === 'inssaei' ? { artform: 'Art floor', contentLocation: { '@type': 'Place', name: 'Krinkels HQ, Breda' }, award: ['Vakwerk Awards — category and overall winner, 2020', 'WFB Design Awards — Best Stair and Best Commercial Floor, 2020', 'CFJ Awards — Best International, 2021'] } : { artform: 'Monumental wood art' })
    });
  }
  if (page.type === 'service') {
    const id = url + '#commissions';
    webPage.mainEntity = { '@id': id };
    graph.push({ '@type': 'Service', '@id': id, name: 'Bespoke art floor commissions', serviceType: 'Commissioned wooden art floors', description: page.description, url, provider: { '@id': personId }, image: fullUrl(page.image) });
  }
  if (page.type === 'article') {
    const id = url + '#article';
    webPage.mainEntity = { '@id': id };
    graph.push({ '@type': 'Article', '@id': id, headline: page.label, description: page.description, url, inLanguage: 'en', author: { '@id': personId }, publisher: { '@id': personId }, image: fullUrl(page.image), mainEntityOfPage: { '@id': pageId } });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
function metadata(page, preview = false) {
  const size = sizes.get(page.image);
  return `<title>${escape(page.title)}</title>
  <meta name="description" content="${escape(page.description)}">
  <meta name="robots" content="${preview ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'}">
  <link rel="canonical" href="${fullUrl(page.path)}">
  <meta property="og:type" content="${page.type === 'article' ? 'article' : 'website'}">
  <meta property="og:site_name" content="Dutch Wood Artist">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${fullUrl(page.path)}">
  <meta property="og:title" content="${escape(page.title)}">
  <meta property="og:description" content="${escape(page.description)}">
  <meta property="og:image" content="${fullUrl(page.image)}">
  <meta property="og:image:alt" content="${escape(page.imageAlt)}">
  <meta property="og:image:width" content="${size.width}">
  <meta property="og:image:height" content="${size.height}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(page.title)}">
  <meta name="twitter:description" content="${escape(page.description)}">
  <meta name="twitter:image" content="${fullUrl(page.image)}">
  <meta name="twitter:image:alt" content="${escape(page.imageAlt)}">
  <script type="application/ld+json">${json(structuredData(page))}</script>`;
}

await rm(out, { recursive: true, force: true });
await mkdir(resolve(out, 'assets'), { recursive: true });
const css = serialize(find(sourceDoc, node => node.tagName === 'style'));
const storyCss = await readFile(resolve(root, 'seo/story.css'), 'utf8');
async function stylesheet(name, content) {
  const path = `/assets/${name}.${createHash('sha256').update(content).digest('hex').slice(0, 12)}.css`;
  await writeFile(resolve(out, '.' + path), content);
  return path;
}
const siteCssPath = await stylesheet('site', css);
const storyCssPath = await stylesheet('story', storyCss);

function configureHead(doc, page, preview = false) {
  const head = find(doc, node => node.tagName === 'head');
  for (const node of [...head.childNodes]) {
    if (node.tagName === 'title' || node.tagName === 'style' ||
      (node.tagName === 'link' && attr(node, 'rel') === 'canonical') ||
      (node.tagName === 'meta' && (['description', 'robots'].includes(attr(node, 'name')) || (attr(node, 'name') || '').startsWith('twitter:') || (attr(node, 'property') || '').startsWith('og:'))) ||
      (node.tagName === 'script' && attr(node, 'type') === 'application/ld+json')) remove(node);
  }
  appendHtml(head, metadata(page, preview));
  appendHtml(head, `<link rel="stylesheet" href="${siteCssPath}">`);
  const icon = find(head, node => attr(node, 'rel') === 'icon');
  setAttr(icon, 'href', '/images/icon-192.png');
}
for (const name of ['index.html', 'preview-gallery.html']) {
  const doc = parse(await readFile(resolve(root, name), 'utf8'));
  configureHead(doc, home, name !== 'index.html');
  normalizeImages(doc);
  walk(doc, node => {
    const key = attr(node, 'data-story');
    if (key) {
      if (!storyPaths[key]) throw new Error('Unknown story: ' + key);
      node.tagName = node.nodeName = 'a';
      removeAttr(node, 'type');
      setAttr(node, 'href', storyPaths[key]);
    }
    if (hasClass(node, 'chapter')) removeAttr(node, 'inert');
  });
  const body = find(doc, node => node.tagName === 'body');
  const appScript = body.childNodes.find(node => node.tagName === 'script' && !attr(node, 'type'));
  const routes = parseFragment(`<script type="application/json" id="story-paths">${json(storyPaths)}</script>`).childNodes[0];
  routes.parentNode = body;
  body.childNodes.splice(body.childNodes.indexOf(appScript), 0, routes);
  await writeFile(resolve(out, name), serialize(doc));
}

const headerDoc = parseFragment(serializeOuter(find(sourceDoc, node => node.tagName === 'header')));
remove(find(headerDoc, node => attr(node, 'id') === 'open-index'));
walk(headerDoc, node => {
  const chapter = attr(node, 'data-chapter');
  if (chapter) {
    const path = { artist: '/artist/', commissions: '/art-floors/', news: '/news/a-book-in-the-making/', contact: '/contact/' }[chapter] || '/#' + chapter;
    setAttr(node, 'href', path);
    removeAttr(node, 'data-chapter');
  }
});
normalizeImages(headerDoc);
const header = serialize(headerDoc);
const footer = `<footer class="story-footer"><nav aria-label="Explore Dutch Wood Artist">${pages.map(page => `<a href="${page.path}">${escape(page.label)}</a>`).join('')}<a href="/">Explore the gallery</a></nav><p>Jakko Woudenberg · Dutch Wood Artist® · Schagen, The Netherlands</p></footer>`;

for (const page of pages) {
  const content = parseFragment(stories[page.key]);
  if (page.promote) {
    const heading = find(content, node => node.tagName === page.promote);
    heading.tagName = heading.nodeName = 'h1';
  } else if (page.heading) {
    const heading = parseFragment(`<h1>${escape(page.heading)}</h1>`).childNodes[0];
    const eyebrow = content.childNodes.findIndex(node => hasClass(node, 'eyebrow'));
    heading.parentNode = content;
    content.childNodes.splice(eyebrow >= 0 ? eyebrow + 1 : 0, 0, heading);
  }
  walk(content, node => { if (node.tagName === 'h3') node.tagName = node.nodeName = 'h2'; });
  if (page.key === 'commissions') appendHtml(content, `<section id="why">${stories.why}</section>`);
  if (page.key === 'inssaei') appendHtml(content, `<section id="photographs"><h2>Photographs</h2><p class="eyebrow">INSSAEI · Krinkels HQ, Breda</p>${['03', '04', '01', '05', '06', '07'].map(n => `<figure><img src="/images/Krinkels_${n}_Robbert_Vogtlander.jpg" alt="INSSAEI at Krinkels, photograph ${n}"><figcaption>© Robbert Vogtlander</figcaption></figure>`).join('')}</section>`);
  const related = {
    manifesto: [['/art-floors/#why', 'Why the work exists']],
    artist: [['/manifesto/', 'Read the manifesto']],
    inssaei: [['/art-floors/', 'Explore commissions'], ['/contact/', 'Begin a conversation']],
    nightwatch: [['https://www.thenightwatchinwood.com/', 'Visit the artwork website ↗'], ['/news/a-book-in-the-making/', 'A book in the making']],
    commissions: [['/work/inssaei/', 'Explore INSSAEI'], ['/contact/', 'Begin a conversation']],
    uwfl: [['https://app.unitedwoodfloorlayers.com/', 'Explore United Wood Floor Layers ↗']],
    book: [['/work/the-night-watch-in-wood/', 'Read the artwork’s story']],
  }[page.key] || [];
  if (related.length) appendHtml(content, `<nav class="reader-related" aria-label="Related stories">${related.map(([href, label]) => `<a href="${href}"${href.startsWith('https:') ? ' target="_blank" rel="noopener"' : ''}>${escape(label)}</a>`).join('')}</nav>`);
  normalizeImages(content, true);
  if (findAll(content, node => node.tagName === 'h1').length !== 1) throw new Error('Expected one article heading for ' + page.key);
  const doc = parse(source);
  configureHead(doc, page);
  const head = find(doc, node => node.tagName === 'head');
  appendHtml(head, `<link rel="stylesheet" href="${storyCssPath}">`);
  const html = `<!doctype html><html lang="en" class="story-page">${serializeOuter(head)}<body><a class="skip-link" href="#story">Skip to the story</a>${header}<main class="story-shell" id="story"><nav class="story-breadcrumb" aria-label="Breadcrumb"><a href="/">Dutch Wood Artist</a><span aria-hidden="true">/</span><span aria-current="page">${escape(page.label)}</span></nav><article class="reader-content story-article">${serialize(content)}</article><div class="reader-related"><a class="text-link" href="/#${page.chapter}">← Back to the work</a></div></main>${footer}</body></html>`;
  const file = resolve(out, '.' + page.path, 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

for (const name of ['images', 'preview.html', 'privacy.html', 'success.html', 'robots.txt', '_headers', 'manifest.json', 'googlef0d31f940bfa34d2.html']) await cp(resolve(root, name), resolve(out, name), { recursive: true });
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[home, ...pages].map(page => `  <url><loc>${fullUrl(page.path)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(resolve(out, 'sitemap.xml'), sitemap);
const llms = `# Dutch Wood Artist® — Jakko Woudenberg\n\n> One-of-a-kind art floors and monumental wood art by Jakko Woudenberg, a master parquet craftsman and artist based in Schagen, the Netherlands. Wood is his medium; the human journey is his subject.\n\nThe site presents artworks, commissioned art floors, the artist’s own statements and projects in development. The linked pages contain the full public stories in HTML. Each commission is made for one specific place.\n\n## Work and commissions\n\n${pages.filter(page => ['commissions', 'inssaei', 'nightwatch'].includes(page.key)).map(page => `- [${page.label}](${fullUrl(page.path)}): ${page.description}`).join('\n')}\n\n## Artist and stories\n\n${pages.filter(page => ['artist', 'manifesto', 'book'].includes(page.key)).map(page => `- [${page.label}](${fullUrl(page.path)}): ${page.description}`).join('\n')}\n\n## Projects\n\n${pages.filter(page => ['uwfl', 'between-doors', 'gemikigai'].includes(page.key)).map(page => `- [${page.label}](${fullUrl(page.path)}): ${page.description}`).join('\n')}\n\n## Contact\n\n- [Contact](${origin}/contact/): Call, WhatsApp or send an email to discuss a commission.\n- [Gallery](${origin}/): The visual introduction to the work.\n- [Sitemap](${origin}/sitemap.xml)\n`;
await writeFile(resolve(out, 'llms.txt'), llms);
// An optional build-scoped key supports IndexNow without storing it in the repository.
if (process.env.INDEXNOW_KEY) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(process.env.INDEXNOW_KEY)) throw new Error('Invalid IndexNow verification key.');
  await writeFile(resolve(out, process.env.INDEXNOW_KEY + '.txt'), process.env.INDEXNOW_KEY);
}
console.log(`Built the gallery and ${pages.length} readable pages, with sitemap, metadata and structured data.`);
