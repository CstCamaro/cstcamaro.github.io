import fs from 'node:fs/promises';
import path from 'node:path';

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
function markdown(source) {
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
      html.push(`<div class="code-block"><div class="code-bar"><span>${esc(language || 'code')}</span><button class="copy-code" type="button">复制代码</button></div><pre><code>${esc(code.join('\n'))}</code></pre></div>`); continue;
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
  const body = markdown(match[2]);
  posts.push({...metadata, tags: metadata.tags || [], slug: filename.slice(0, -3), minutes: Math.max(1, Math.ceil(match[2].length / 500)), ...body});
}
posts.sort((a,b) => b.date.localeCompare(a.date));
const categories = [...new Set(posts.map(p => p.category))];
const date = s => s.replaceAll('-', '.');
const icon = (name, size = 20) => {
  const shapes = {arrow:'<path d="M7 17 17 7M7 7h10v10"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',rss:'<circle cx="5" cy="19" r="1"/><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>',git:'<path d="M9 19c-4 1-4-2-6-2m12 4v-3.5c0-1 .1-1.5-.5-2 3.5-.4 7-1.7 7-7A5.5 5.5 0 0 0 20 5c.2-1 0-2-1-3-2 0-3 1-4 1a15 15 0 0 0-6 0C8 3 7 2 5 2c-1 1-1.2 2-1 3a5.5 5.5 0 0 0-1.5 3.5c0 5.3 3.5 6.6 7 7-.6.5-.5 1-.5 2V21"/>'};
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.arrow}</svg>`;
};
function shell(title, active, body, {description = config.description, canonical = '', article = false} = {}) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · ${esc(config.name)}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#111713"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${article ? 'article' : 'website'}"><meta property="og:url" content="${absolute(canonical)}"><link rel="canonical" href="${absolute(canonical)}"><link rel="icon" href="${url('assets/favicon.svg')}" type="image/svg+xml"><link rel="alternate" type="application/rss+xml" title="${esc(config.name)} RSS" href="${url('feed.xml')}"><script>try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'dark'}catch{}</script><link rel="stylesheet" href="${url('assets/style.css')}"><script src="${url('assets/app.js')}" defer></script></head><body><a class="skip-link" href="#main">跳到内容</a><header class="header"><div class="header-inner"><a class="brand" href="${url()}"><span class="brand-mark">c<span>_</span></span><span>${esc(config.name)}<small>SECURITY RESEARCH</small></span></a><nav aria-label="主导航"><a ${active === 'home' ? 'aria-current="page"' : ''} href="${url()}">手记<span>Journal</span></a><a ${active === 'archive' ? 'aria-current="page"' : ''} href="${url('archive/')}">归档<span>Archive</span></a><a ${active === 'about' ? 'aria-current="page"' : ''} href="${url('about/')}">关于<span>About</span></a></nav><div class="header-tools"><a class="icon-button" href="${url('feed.xml')}" aria-label="订阅 RSS">${icon('rss')}</a><button class="icon-button theme-toggle" type="button" aria-label="切换到浅色主题">${icon('sun')}</button><a class="github-link" href="${esc(config.github)}" target="_blank" rel="noopener noreferrer">GitHub ${icon('arrow',15)}</a></div></div></header>${body}<footer class="footer"><div><a class="footer-brand" href="${url()}">c_ <span>${esc(config.name)}</span></a><p>保持好奇，认真验证。<span> Stay curious. Verify everything.</span></p></div><div class="footer-right"><a href="${url('feed.xml')}">RSS 订阅 ${icon('rss',14)}</a><span>© ${new Date().getFullYear()} ${esc(config.author)}</span><span>Written with curiosity.</span></div></footer><div class="toast" role="status" aria-live="polite"></div></body></html>`;
}
const topology = `<svg class="topology" viewBox="0 0 480 330" fill="none" aria-hidden="true"><defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" opacity=".2"/></pattern><linearGradient id="edge"><stop stop-color="#b9e8b0" stop-opacity=".05"/><stop offset=".5" stop-color="#b9e8b0"/><stop offset="1" stop-color="#b9e8b0" stop-opacity=".05"/></linearGradient></defs><path fill="url(#dots)" d="M0 0h480v330H0z"/><g stroke="currentColor" opacity=".13"><path d="m240 35 145 80v115l-145 80-145-80V115Z"/><path d="m240 75 110 62v70l-110 63-110-63v-70Z"/><path d="m240 115 75 42v30l-75 43-75-43v-30Z"/><path d="M240 35v80m145 0-70 42m70 73-70-43m-75 123v-80M95 230l70-43m-70-72 70 42"/></g><g stroke="url(#edge)" stroke-width="1.5"><path d="M20 170h130l45-45h90l45 45h130"/><path d="m60 285 90-90h180l90-90"/></g><g fill="#b9e8b0"><circle cx="150" cy="170" r="4"/><circle cx="330" cy="170" r="4"/><circle cx="240" cy="125" r="4"/><circle cx="240" cy="195" r="4"/></g><rect x="210" y="143" width="60" height="41" rx="8" fill="#17221b" stroke="#7ca67a"/><path d="m229 156-7 7 7 7m22-14 7 7-7 7m-9-17-5 21" stroke="#b9e8b0" stroke-width="1.5"/><g fill="currentColor" opacity=".6" font-family="monospace" font-size="9"><text x="34" y="151">INPUT</text><text x="371" y="151">BOUNDARY</text><text x="193" y="298">TRACE / VERIFY / RECORD</text><text x="332" y="56">0xC57</text></g></svg>`;
const postPath = p => `posts/${p.slug}/`;
const postMeta = p => `<span class="category">${esc(p.category)}</span><span>${date(p.date)}</span><span>${p.minutes} 分钟阅读</span>${p.demo ? '<span class="demo-label">模板示例</span>' : ''}`;
const row = (p,i) => `<article class="post-row" data-post data-category="${esc(p.category)}" data-search="${esc([p.title,p.summary,p.category,...p.tags].join(' ').toLowerCase())}"><span class="post-number">${String(i + 1).padStart(2,'0')}</span><div class="post-row-content"><div class="post-meta">${postMeta(p)}</div><h3><a href="${url(postPath(p))}">${esc(p.title)}</a></h3><p>${esc(p.summary)}</p><div class="tag-list">${p.tags.map(t => `<span># ${esc(t)}</span>`).join('')}</div></div><a class="row-arrow" href="${url(postPath(p))}" aria-label="阅读：${esc(p.title)}">${icon('arrow')}</a></article>`;
await fs.mkdir('dist/assets', {recursive:true});
await fs.cp('assets','dist/assets',{recursive:true});
const write = async (p, content) => { const output = path.join('dist', p); await fs.mkdir(path.dirname(output),{recursive:true}); await fs.writeFile(output,content); };
const featured = posts.find(p => p.featured) || posts[0];
const emptyState = `<div class="empty-state" ${posts.length ? 'hidden' : ''}><span>∅</span><h3>${posts.length ? '暂时没有匹配的手记' : '还没有发布文章'}</h3><p>${posts.length ? '换个关键词，或查看全部分类。' : '新的研究手记，将从这里开始。'}</p><button class="text-link reset-search" ${posts.length ? '' : 'hidden'}>重置筛选 ↗</button></div>`;
await write('index.html',shell(config.title,'home',`<main id="main"><section class="hero container"><div class="hero-copy"><div class="eyebrow"><span class="status-dot"></span> INDEPENDENT SECURITY RESEARCHER</div><h1>探索边界，<br>记录<span class="serif-accent">未知。</span><span class="hero-cursor">_</span></h1><p>在代码与协议之间，寻找被忽略的细节。<br>这里记录安全研究中的发现、实验与思考。</p><div class="hero-links"><a class="button button-primary" href="#journal">阅读研究手记 <span>↓</span></a><a class="text-link" href="${url('about/')}">关于我 ${icon('arrow',15)}</a></div></div><div class="hero-visual"><div class="visual-topline"><span>RESEARCH ENVIRONMENT</span><span class="status-dot"></span></div>${topology}<div class="visual-bottom"><span><i></i> curiosity.mode = always</span><span>[ 01 / ∞ ]</span></div></div><div class="hero-footnote"><span>WEB SECURITY / CODE AUDIT / RESEARCH NOTES</span><span>观察 → 假设 → 验证 → 记录</span></div></section>${featured ? `<section class="featured container"><div class="featured-label"><span class="small-label">EDITOR'S PICK</span><span>本期精选</span><span class="featured-star">✳</span></div><a class="featured-content" href="${url(postPath(featured))}"><div class="post-meta">${postMeta(featured)}</div><h2>${esc(featured.title)}</h2><p>${esc(featured.summary)}</p><span class="featured-action">阅读完整手记 ${icon('arrow',17)}</span></a><div class="featured-index">01<span>FIELD<br>NOTES</span></div></section>` : ''}<section class="journal container" id="journal"><div class="section-title"><div><span class="small-label">THE JOURNAL</span><h2>研究手记<span> / ${String(posts.length).padStart(2,'0')}</span></h2></div><a class="text-link" href="${url('archive/')}">全部归档 ${icon('arrow',15)}</a></div><div class="journal-layout"><div class="journal-main"><div class="filter-bar"><div class="filters" role="group" aria-label="文章分类"><button class="filter active" data-filter="all" aria-pressed="true">全部</button>${categories.map(c => `<button class="filter" data-filter="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}</div><label class="search-box">${icon('search',16)}<input id="search" type="search" placeholder="搜索手记…" aria-label="搜索文章"><kbd>/</kbd></label></div><p class="filter-status" role="status" aria-live="polite"></p><div class="post-list">${posts.map(row).join('')}</div>${emptyState}<div class="list-end"><span></span> EVERY NOTE IS A SMALL STEP FORWARD <span></span></div></div><aside class="sidebar"><div class="profile-card"><span class="small-label">BEHIND THE NOTES</span><div class="avatar">c<span>_</span><i></i></div><h3>${esc(config.name)}</h3><span class="profile-role">Security researcher & builder</span><p>关注 Web 安全与代码审计。<br>把零散的发现，写成可复用的知识。</p><a class="text-link" href="${url('about/')}">更多关于我 ${icon('arrow',15)}</a><div class="profile-footer">${icon('git',17)}<a href="${esc(config.github)}">@${esc(config.name)}</a></div></div><div class="topics-card"><span class="small-label">RESEARCH AREAS</span>${categories.map((c,i) => `<button data-topic="${esc(c)}"><span><small>0${i+1}</small>${esc(c)}</span><span>${String(posts.filter(p => p.category === c).length).padStart(2,'0')} ↗</span></button>`).join('')}</div><a class="rss-card" href="${url('feed.xml')}"><span class="rss-symbol">${icon('rss',23)}</span><h3>让新发现，找到你。</h3><p>通过 RSS 订阅最新研究手记。</p><span class="text-link">订阅 Feed ${icon('arrow',15)}</span></a><div class="sidebar-note">// A notebook, not a highlight reel.<br>// 保留过程，也保留问题。</div></aside></div></section></main>`));
for (let i = 0; i < posts.length; i++) {
  const p = posts[i], next = posts[i+1] || posts[i-1];
  await write(`${postPath(p)}index.html`,shell(p.title,'home',`<main id="main" class="container article-page"><a class="back-link" href="${url()}#journal">← 返回研究手记</a><header class="article-header"><div class="post-meta">${postMeta(p)}</div><h1>${esc(p.title)}</h1><p>${esc(p.summary)}</p><div class="article-byline"><span class="mini-avatar">c_</span><strong>${esc(config.author)}</strong><span>／ ${p.tags.map(esc).join(' · ')}</span></div></header><div class="article-layout"><article class="prose">${p.html}<div class="article-end"><span>— END OF NOTE —</span><p>如果这篇笔记对你有帮助，欢迎交流与补充。</p><button type="button" class="share-link text-link">复制文章链接 ↗</button></div>${next ? `<a class="next-post" href="${url(postPath(next))}"><span class="small-label">CONTINUE READING</span><h3>${esc(next.title)} ${icon('arrow',18)}</h3></a>` : ''}</article><aside class="article-toc"><span class="small-label">ON THIS PAGE</span><nav aria-label="文章目录">${p.toc.map(t => `<a class="toc-level-${t.level}" href="#${t.id}">${esc(t.title)}</a>`).join('')}</nav><a class="toc-top" href="#main">返回顶部 ↑</a></aside></div></main>`,{description:p.summary,canonical:postPath(p),article:true}));
}
const years = [...new Set(posts.map(p => p.date.slice(0,4)))];
await write('archive/index.html',shell('文章归档','archive',`<main id="main" class="container inner-page"><span class="eyebrow">THE COMPLETE INDEX</span><h1>研究归档<span class="serif-accent">。</span></h1><p class="page-intro">每一次观察，每一个问题，都值得留下记录。共 ${posts.length} 篇手记。</p>${years.map(year => `<section class="archive-year"><h2>${year}<small>${posts.filter(p => p.date.startsWith(year)).length} NOTES</small></h2><div>${posts.filter(p => p.date.startsWith(year)).map(p => `<a class="archive-row" href="${url(postPath(p))}"><time datetime="${p.date}">${p.date.slice(5).replace('-',' / ')}</time><h3>${esc(p.title)}</h3><span class="category">${esc(p.category)}</span>${icon('arrow',18)}</a>`).join('')}</div></section>`).join('')}<a class="text-link" href="${url('feed.xml')}">通过 RSS 订阅后续更新 ${icon('rss',16)}</a></main>`,{canonical:'archive/'}));
await write('about/index.html',shell('关于我','about',`<main id="main" class="container inner-page about-page"><span class="eyebrow">THE PERSON BEHIND THE NOTES</span><h1>你好，我是<br><span class="serif-accent">${esc(config.name)}。</span></h1><p class="page-intro">一名网络安全研究员。喜欢追问系统为何如此运行，也喜欢把复杂的问题一点点拆开。</p><div class="about-grid"><section class="prose"><h2>关于这个空间</h2><p>这里是我的研究手记，记录 Web 安全、代码审计，以及日常工具实践中的观察与思考。</p><p>我希望每一篇文章都能交代清楚：问题是什么，如何验证，证据在哪里，以及还有哪些尚未解决的疑问。</p><h2>研究方向</h2><ul><li>Web 安全：理解应用、协议和组件之间的信任边界。</li><li>代码审计：沿着数据流梳理身份、权限与敏感操作。</li><li>工具与实践：让实验更容易复现，让知识更容易积累。</li></ul><h2>保持联系</h2><p>欢迎通过 <a href="${esc(config.github)}">GitHub @${esc(config.name)}</a> 交流。你也可以通过 <a href="${url('feed.xml')}">RSS</a> 订阅后续更新。</p><blockquote>本站文章仅代表个人观点。涉及具体研究的结论，以文中记录的环境、版本和证据为准。</blockquote></section><aside class="about-note"><span class="small-label">RESEARCH PRINCIPLES</span><h2>保持好奇。<br>认真验证。<br>清晰记录。</h2><span class="mono">01 / Ask better questions.<br>02 / Follow the evidence.<br>03 / Share what you learn.</span></aside></div></main>`,{canonical:'about/'}));
await write('404.html',shell('页面未找到','',`<main id="main" class="container inner-page not-found"><span class="eyebrow">404 / OUT OF BOUNDS</span><h1>这条路径，<br>还没有手记。</h1><p class="page-intro">页面可能已移动，或链接地址有误。</p><a class="button button-primary" href="${url()}">返回首页 ↗</a></main>`,{canonical:'404.html'}));
await write('feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(config.name)} · ${esc(config.title)}</title><link>${absolute('')}</link><description>${esc(config.description)}</description><language>zh-cn</language>${posts.map(p => `<item><title>${esc(p.title)}</title><link>${absolute(postPath(p))}</link><guid>${absolute(postPath(p))}</guid><pubDate>${new Date(p.date + 'T00:00:00+08:00').toUTCString()}</pubDate><description>${esc(p.summary)}</description><category>${esc(p.category)}</category></item>`).join('')}</channel></rss>`);
await write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['','about/','archive/',...posts.map(postPath)].map(p => `<url><loc>${esc(absolute(p))}</loc></url>`).join('')}</urlset>`);
await write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${absolute('sitemap.xml')}\n`);
await write('.nojekyll','');
await write('build-manifest.json',JSON.stringify({posts:posts.map(p=>({slug:p.slug,title:p.title,demo:!!p.demo})),basePath:base},null,2));
console.log(`Built ${posts.length} posts, home, archive, about, 404, RSS and sitemap → dist/`);
