import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'../dist');
const {basePath,posts} = JSON.parse(await fs.readFile(path.join(root,'build-manifest.json'),'utf8'));
async function walk(dir) {const entries = await fs.readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name)))).flat();}
const files = await walk(root);
let links = 0;
for (const file of files.filter(f=>f.endsWith('.html'))) {
  const html = await fs.readFile(file,'utf8');
  assert.match(html,/<html lang="zh-CN">/);
  assert.match(html,/<main id="main"/);
  assert.doesNotMatch(html,/undefined|\[object Object\]/);
  for (const [,target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!target.startsWith(basePath+'/')) continue;
    let localPath = target.slice(basePath.length+1).split('#')[0];
    if (!localPath || localPath.endsWith('/')) localPath += 'index.html';
    const contents = await fs.readFile(path.join(root,localPath),'utf8');
    const hash = target.split('#')[1];
    if (hash) assert.ok(contents.includes(`id="${hash}"`),`Missing fragment ${target}`);
    links++;
  }
}
for (const p of posts) {
  const html = await fs.readFile(path.join(root,'posts',p.slug,'index.html'),'utf8');
  assert.ok(html.includes(p.title));
  if (p.demo) assert.ok(html.includes('模板示例'));
}
const home = await fs.readFile(path.join(root,'index.html'),'utf8');
assert.equal((home.match(/data-post /g)||[]).length,posts.length);
assert.ok(!files.some(f=>f.includes('_template')),'Draft template must not be published');
assert.match(await fs.readFile(path.join(root,'feed.xml'),'utf8'),/<rss version="2.0">/);
console.log(`Checked ${files.filter(f=>f.endsWith('.html')).length} pages, ${links} local links and fragments, ${posts.length} posts, draft exclusion and RSS.`);
