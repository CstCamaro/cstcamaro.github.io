import fs from 'node:fs/promises';
import path from 'node:path';
import {getMessages} from './locales.mjs';
import {renderSite} from './render.mjs';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
const config = JSON.parse(await fs.readFile('site.config.json', 'utf8'));
const outputDirectory = path.resolve(root, 'dist');
if (path.dirname(outputDirectory) !== root || path.basename(outputDirectory) !== 'dist') throw new Error('Invalid build output directory');
await fs.rm(outputDirectory, {recursive:true, force:true});
const base = config.basePath.replace(/\/$/, '');
const url = (p = '') => `${base}/${p}`;
const absolute = p => `${config.url.replace(/\/$/, '')}${url(p)}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeHref = s => /^[a-z][a-z0-9+.-]*:/i.test(s) && !/^(https?:|mailto:)/i.test(s) ? '#' : s;
function inline(s) {
  const snippets = [];
  const hold = html => `\u0000${snippets.push(html) - 1}\u0000`;
  let result = esc(s).replace(/`([^`]+)`/g, (_, code) => hold(`<code>${code}</code>`));
  result = result.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_, text, src) => hold(`<img src="${safeHref(src)}" alt="${text}" loading="lazy" decoding="async">`));
  result = result.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, text, href) => hold(`<a href="${safeHref(href)}">${text}</a>`));
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return result.replace(/\u0000(\d+)\u0000/g, (_, i) => snippets[Number(i)]);
}
function markdown(source, lang) {
  const t = getMessages(lang);
  const lines = source.replace(/\r/g, '').split('\n');
  const toc = [], html = []; let index = 0, headingCount = 0;
  const boundary = s => !s.trim() || /^(#{1,6} |```|> |[-*] |\d+\. |\|)/.test(s);
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim(); const code = []; index++;
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
      if (index === lines.length) throw new Error('Unclosed code fence');
      index++;
      html.push(`<div class="code-block"><div class="code-bar"><span>${esc(language || 'code')}</span><button class="copy-code" type="button">${t.copyCode}</button></div><pre><code>${esc(code.join('\n'))}</code></pre></div>`); continue;
    }
    const heading = line.match(/^(#{1,6}) (.+)$/);
    if (heading) {
      const level = heading[1].length, id = `section-${++headingCount}`;
      if (level <= 3) toc.push({id, title: heading[2], level});
      html.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`); index++; continue;
    }
    if (line.startsWith('> ')) {
      const quote = []; while (index < lines.length && lines[index].startsWith('> ')) quote.push(lines[index++].slice(2));
      html.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`); continue;
    }
    if (/^([-*] |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line), items = [], pattern = ordered ? /^\d+\. / : /^[-*] /;
      while (index < lines.length && pattern.test(lines[index])) items.push(`<li>${inline(lines[index++].replace(pattern, ''))}</li>`);
      const tag = ordered ? 'ol' : 'ul'; html.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    if (line.startsWith('|') && /^\|[\s:|\-]+\|\s*$/.test(lines[index + 1] || '')) {
      const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(v => inline(v.trim()));
      const header = cells(line); index += 2; const rows = [];
      while (index < lines.length && lines[index].startsWith('|')) rows.push(cells(lines[index++]));
      html.push(`<div class="table-wrap"><table><thead><tr>${header.map(v => `<th>${v}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    const paragraph = [line]; index++;
    while (index < lines.length && !boundary(lines[index])) paragraph.push(lines[index++]);
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return {html: html.join('\n'), toc};
}
const posts = [];
for (const filename of (await fs.readdir('posts')).filter(f => f.endsWith('.md') && !f.startsWith('_'))) {
  const source = (await fs.readFile(`posts/${filename}`, 'utf8')).replace(/\r/g, '');
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`Missing front matter: ${filename}`);
  const metadata = {};
  for (const line of match[1].split('\n').filter(Boolean)) {
    const colon = line.indexOf(':'); if (colon < 1) throw new Error(`Invalid metadata: ${filename}`);
    const key = line.slice(0, colon).trim(), value = line.slice(colon + 1).trim();
    try { metadata[key] = JSON.parse(value); } catch { metadata[key] = value; }
  }
  if (metadata.draft) continue;
  for (const key of ['title','date','category','summary']) if (!metadata[key]) throw new Error(`${filename}: missing ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date) || Number.isNaN(Date.parse(metadata.date))) throw new Error(`Invalid date: ${filename}`);
  if (metadata.tags && (!Array.isArray(metadata.tags) || metadata.tags.some(t => typeof t !== 'string'))) throw new Error(`Invalid tags: ${filename}`);
  const lang = metadata.lang || 'zh';
  if (!['en','zh'].includes(lang)) throw new Error(`Invalid lang: ${filename}`);
  if (metadata.translationKey !== undefined && (typeof metadata.translationKey !== 'string' || !metadata.translationKey.trim())) throw new Error(`Invalid translationKey: ${filename}`);
  if (metadata.translationKey && posts.some(p => p.lang === lang && p.translationKey === metadata.translationKey)) throw new Error(`Duplicate translationKey for ${lang}: ${filename}`);
  const body = markdown(match[2], lang);
  const minutes = lang === 'en' ? Math.ceil(match[2].split(/\s+/).length / 200) : Math.ceil(match[2].length / 500);
  posts.push({...metadata, lang, tags: metadata.tags || [], slug: filename.slice(0, -3), minutes: Math.max(1, minutes), ...body});
}
posts.sort((a,b) => b.date.localeCompare(a.date));
await fs.mkdir('dist/assets', {recursive:true});
await fs.cp('assets','dist/assets',{recursive:true});
const write = async (p, content) => {
  const output = path.join('dist', p);
  await fs.mkdir(path.dirname(output), {recursive:true});
  await fs.writeFile(output,content);
};
const pages = [];
for (const lang of ['en','zh']) pages.push(...await renderSite({config, allPosts:posts, write, lang}));
await write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(page=>'<url><loc>'+esc(page)+'</loc></url>').join('') + '</urlset>');
await write('robots.txt', 'User-agent: *\nAllow: /\nSitemap: '+absolute('sitemap.xml')+'\n');
await write('.nojekyll','');
await write('build-manifest.json',JSON.stringify({posts:posts.map(p=>({slug:p.slug,title:p.title,lang:p.lang,translationKey:p.translationKey,demo:!!p.demo})),basePath:base,languages:['en','zh'],defaultLanguage:'en'},null,2));
console.log('Built English and Chinese versions with '+posts.length+' posts, localized RSS, language switching and sitemap.');
