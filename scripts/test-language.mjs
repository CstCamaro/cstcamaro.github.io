import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {renderSite} from './render.mjs';
import {getMessages} from './locales.mjs';

const config = JSON.parse(await fs.readFile(new URL('../site.config.json',import.meta.url),'utf8'));
const shared = {date:'2026-10-19',category:'Research',summary:'Test summary',tags:[],minutes:1,toc:[]};
// Render in memory so test articles can never appear in the published output.
const posts = [
  {...shared,lang:'en',slug:'audit-en',translationKey:'audit',title:'English audit note',html:'<p>English research evidence.</p>'},
  {...shared,lang:'zh',slug:'audit-zh',translationKey:'audit',title:'中文审计笔记',html:'<p>中文研究证据。</p>'},
  {...shared,lang:'en',slug:'english-only',title:'English only',html:'<p>Not translated.</p>'}
];
const pages = new Map();
for (const lang of ['en','zh']) await renderSite({config,allPosts:posts,lang,write:async (route,content)=>pages.set(route,content)});
assert.ok(pages.get('posts/audit-en/index.html').includes('data-language="zh" href="/zh/posts/audit-zh/"'));
assert.ok(pages.get('zh/posts/audit-zh/index.html').includes('data-language="en" href="/posts/audit-en/"'));
assert.ok(pages.get('posts/english-only/index.html').includes('data-language="zh" href="/zh/"'));
assert.ok(!pages.get('index.html').includes('中文审计笔记'));
assert.ok(!pages.get('zh/index.html').includes('English audit note'));
assert.ok(!pages.get('feed.xml').includes('中文审计笔记'));
assert.ok(!pages.get('zh/feed.xml').includes('English audit note'));

function runBootstrap(route, preference) {
  const source=pages.get(route).match(/<script>(.*?)<\/script>/s)[1];
  let redirect;
  const document={documentElement:{dataset:{}}};
  vm.runInNewContext(source,{document,localStorage:{getItem:key=>key==='language'?preference:null},location:{search:'',hash:'',replace:url=>{redirect=url;}}});
  return redirect;
}
assert.equal(runBootstrap('index.html',null),undefined,'First visit must stay English');
assert.equal(runBootstrap('index.html','zh'),'/zh/','Remember an explicit Chinese preference');
assert.equal(runBootstrap('index.html','en'),undefined);
assert.equal(runBootstrap('about/index.html','zh'),undefined,'Do not override direct page URLs');
assert.equal(runBootstrap('zh/index.html','en'),undefined);

const client=await fs.readFile(new URL('../assets/app.js',import.meta.url),'utf8');
for (const lang of ['en','zh']) {
  const events=new Map(), labels=new Map(), storage=new Map();
  const links=['en','zh'].map(language=>({dataset:{language},addEventListener:(_,callback)=>events.set(language,callback)}));
  const theme={setAttribute:(key,value)=>labels.set(key,value),addEventListener:(_,callback)=>events.set('theme',callback)};
  const dictionary=getMessages(lang);
  const document={
    documentElement:{dataset:{theme:'dark'}},
    querySelector:selector=>selector==='#ui-messages'?{textContent:JSON.stringify(dictionary)}:selector==='.theme-toggle'?theme:null,
    querySelectorAll:selector=>selector==='[data-language]'?links:[]
  };
  vm.runInNewContext(client,{document,window:{},localStorage:{setItem:(key,value)=>storage.set(key,value)}});
  events.get('zh')(); assert.equal(storage.get('language'),'zh');
  events.get('en')(); assert.equal(storage.get('language'),'en');
  assert.equal(labels.get('aria-label'),dictionary.lightTheme);
  events.get('theme')(); assert.equal(labels.get('aria-label'),dictionary.darkTheme);
}
console.log('Language behavior verified: English default, remembered selection, translated article pairs, untranslated fallback, separate feeds and localized theme controls.');
