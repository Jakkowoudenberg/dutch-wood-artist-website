import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { parse } from 'parse5';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
const origin = 'https://dutchwoodartist.com';
const read = path => readFile(path, 'utf8');
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
function all(node, predicate, includeTemplates = false) {
  return [ ...(predicate(node) ? [node] : []), ...(node.childNodes || []).flatMap(child => all(child, predicate, includeTemplates)), ...(includeTemplates && node.content ? all(node.content, predicate, true) : []) ];
}
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const clean = value => value.replace(/\s+/g, ' ').trim();
const source = parse(await read(resolve(root, 'index.html')));
const sitemap = await read(resolve(out, 'sitemap.xml'));
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.equal(urls.length, 11, 'The gallery and all ten stories must be in the sitemap.');
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs.');
const documents = new Map();
const titles = new Set(), descriptions = new Set();
for (const url of urls) {
  assert(url.startsWith(origin + '/') && !url.includes('#') && !url.includes('preview'));
  const path = new URL(url).pathname;
  const html = await read(resolve(out, '.' + path, 'index.html'));
  const doc = parse(html);
  documents.set(path, doc);
  const one = predicate => { const matches = all(doc, predicate); assert.equal(matches.length, 1, url); return matches[0]; };
  const title = text(one(node => node.tagName === 'title'));
  const description = attr(one(node => node.tagName === 'meta' && attr(node, 'name') === 'description'), 'content');
  assert(!titles.has(title) && !descriptions.has(description), 'Search metadata must be unique.');
  titles.add(title); descriptions.add(description);
  assert(title.length > 15 && description.length > 60);
  assert.equal(attr(one(node => node.tagName === 'link' && attr(node, 'rel') === 'canonical'), 'href'), url);
  assert.equal(attr(one(node => node.tagName === 'meta' && attr(node, 'name') === 'robots'), 'content'), 'index,follow,max-image-preview:large');
  one(node => node.tagName === 'h1');
  const ids = all(doc, node => attr(node, 'id')).map(node => attr(node, 'id'));
  assert.equal(new Set(ids).size, ids.length, 'Duplicate rendered IDs: ' + url);
  const schema = JSON.parse(text(one(node => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json')));
  assert.equal(schema['@context'], 'https://schema.org');
  assert(schema['@graph'].some(node => node.url === url && /Page|WebSite/.test(node['@type'])));
  for (const script of all(doc, node => node.tagName === 'script' && !attr(node, 'type'))) new Script(text(script));
  if (path !== '/') {
    assert.equal(all(doc, node => node.tagName === 'template').length, 0, 'Story text must be in the initial HTML.');
    assert(clean(text(one(node => node.tagName === 'article'))).length > 100);
  }
  for (const image of all(doc, node => node.tagName === 'img', true)) {
    const src = attr(image, 'src');
    assert(src.startsWith('/images/'));
    await access(resolve(out, '.' + src));
    assert(attr(image, 'alt'));
    assert(Number(attr(image, 'width')) > 0 && Number(attr(image, 'height')) > 0);
  }
}
for (const [path, doc] of documents) {
  for (const link of all(doc, node => node.tagName === 'a' || (node.tagName === 'link' && attr(node, 'rel') === 'stylesheet'))) {
    const href = attr(link, 'href');
    assert(href, 'A link is missing its destination: ' + path);
    if (!href.startsWith('/') && !href.startsWith('#')) continue;
    const target = new URL(href, origin + path);
    if (target.pathname.startsWith('/assets/')) { await access(resolve(out, '.' + target.pathname)); continue; }
    const targetDoc = documents.get(target.pathname);
    assert(targetDoc, 'Unknown internal link: ' + href);
    if (target.hash) assert(all(targetDoc, node => attr(node, 'id') === decodeURIComponent(target.hash.slice(1))).length, 'Missing anchor: ' + href);
  }
}
const home = documents.get('/');
assert.equal(clean(text(all(source, node => node.tagName === 'main')[0])), clean(text(all(home, node => node.tagName === 'main')[0])), 'The gallery copy changed.');
const storyLinks = all(home, node => attr(node, 'data-story'));
assert(storyLinks.length >= 12);
assert(storyLinks.every(node => node.tagName === 'a' && attr(node, 'href').startsWith('/')));
const routeData = JSON.parse(text(all(home, node => attr(node, 'id') === 'story-paths')[0]));
assert.equal(routeData.why, '/art-floors/#why');
assert.equal(routeData['inssaei-photos'], '/work/inssaei/#photographs');
const publicStories = [...documents.entries()].filter(([path]) => path !== '/').map(([, doc]) => clean(text(all(doc, node => node.tagName === 'article')[0])));
const archiveText = all(source, node => node.tagName === 'template').flatMap(template => all(template.content, node => /^(p|h1|h2|h3|figcaption)$/.test(node.tagName || ''))).map(node => clean(text(node))).filter(Boolean);
for (const paragraph of archiveText) assert(publicStories.some(story => story.includes(paragraph)), 'Approved text missing from the public pages: ' + paragraph.slice(0, 90));
const contact = documents.get('/contact/');
assert.deepEqual(all(contact, node => (attr(node, 'class') || '').split(' ').includes('contact-method')).map(node => [clean(text(node)), attr(node, 'href')]), [['Call', 'tel:+31643060097'], ['WhatsApp', 'https://wa.me/31643060097'], ['Send email', 'mailto:info@dutchwoodartist.com']]);
assert(!text(all(contact, node => node.tagName === 'article')[0]).includes('info@'), 'The email address must not be visible.');
const preview = parse(await read(resolve(out, 'preview-gallery.html')));
assert.equal(attr(all(preview, node => attr(node, 'name') === 'robots')[0], 'content'), 'noindex,nofollow');
assert((await read(resolve(out, '_headers'))).includes('X-Robots-Tag: noindex, nofollow'));
assert.equal(await read(resolve(out, 'googlef0d31f940bfa34d2.html')), await read(resolve(root, 'googlef0d31f940bfa34d2.html')));
assert((await read(resolve(out, 'robots.txt'))).includes('Sitemap: ' + origin + '/sitemap.xml'));
console.log(`Checked ${urls.length} crawlable pages, ${archiveText.length} preserved text blocks, internal links, image dimensions, schema, preview exclusion and contact actions.`);
