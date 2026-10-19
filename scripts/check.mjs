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
  const relative = path.relative(root,file).split(path.sep).join('/');
  const english = !relative.startsWith('zh/');
  assert.ok(html.includes(`<html lang="${english ? 'en' : 'zh-CN'}">`));
  assert.match(html,/<main id="main"/);
  assert.doesNotMatch(html,/undefined|\[object Object\]/);
  const dictionary = JSON.parse(html.match(/<script id="ui-messages" type="application\/json">(.*?)<\/script>/s)[1]);
  assert.equal(dictionary.journal,english ? 'Journal' : '手记');
  const languageLinks = [...html.matchAll(/data-language="(en|zh)" href="([^"]+)"/g)];
  assert.equal(languageLinks.length,2);
  assert.ok(languageLinks.some(([,lang,href])=>lang==='en' && !href.startsWith(basePath+'/zh/')));
  assert.ok(languageLinks.some(([,lang,href])=>lang==='zh' && href.startsWith(basePath+'/zh/')));
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
for (const lang of ['en','zh']) {
  const prefix = lang==='en' ? '' : 'zh/';
  const home = await fs.readFile(path.join(root,prefix,'index.html'),'utf8');
  const localizedPosts=posts.filter(p=>p.lang===lang);
  assert.equal((home.match(/data-post /g)||[]).length,localizedPosts.length);
  assert.ok(home.includes(lang==='en'?'No notes published yet':'还没有发布文章') || localizedPosts.length>0);
  const feed = await fs.readFile(path.join(root,prefix,'feed.xml'),'utf8');
  assert.match(feed,/<rss version="2.0">/);
  assert.equal((feed.match(/<item>/g)||[]).length,localizedPosts.length);
  assert.ok(feed.includes(`<language>${lang==='en'?'en':'zh-cn'}</language>`));
  for (const p of localizedPosts) {
    const html=await fs.readFile(path.join(root,prefix,'posts',p.slug,'index.html'),'utf8');
    assert.ok(html.includes(p.title));
    if(p.demo) assert.ok(html.includes(lang==='en'?'Template example':'模板示例'));
  }
}
for (const route of ['index.html','about/index.html','archive/index.html','404.html']) {
  const en = await fs.readFile(path.join(root,route),'utf8');
  const zh = await fs.readFile(path.join(root,'zh',route),'utf8');
  const routePath=route==='index.html'?'':route.replace('index.html','');
  assert.ok(en.includes(`data-language="zh" href="${basePath}/zh/${routePath}"`));
  assert.ok(zh.includes(`data-language="en" href="${basePath}/${routePath}"`));
}
assert.ok(!files.some(f=>f.includes('_template')),'Draft template must not be published');
console.log(`Checked ${files.filter(f=>f.endsWith('.html')).length} bilingual pages, ${links} links and anchors, language switch routes, localized posts and RSS.`);
