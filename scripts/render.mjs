import {getMessages} from './locales.mjs';
import {icon, topology} from './visuals.mjs';

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function renderSite({config, allPosts, write, lang}) {
  const t = {...getMessages(lang), ...config.locales?.[lang]}, otherLang = lang === 'en' ? 'zh' : 'en';
  const base = config.basePath.replace(/\/$/, '');
  const prefix = lang === 'en' ? '' : 'zh/';
  const otherPrefix = otherLang === 'en' ? '' : 'zh/';
  const asset = p => `${base}/${p}`;
  const url = (p = '') => asset(prefix + p);
  const absolute = p => config.url.replace(/\/$/, '') + url(p);
  const writeLocal = (p, content) => write(prefix + p, content);
  const posts = allPosts.filter(p => p.lang === lang);
  const categories = [...new Set(posts.map(p => p.category))];
  const postPath = p => `posts/${p.slug}/`;
  const postMeta = p => `<span class="category">${esc(p.category)}</span><span>${p.date.replaceAll('-', '.')}</span><span>${p.minutes} ${t.minutes}</span>${p.demo ? `<span class="demo-label">${t.demo}</span>` : ''}`;
  const pairedPost = p => p?.translationKey && allPosts.find(other => other.lang === otherLang && other.translationKey === p.translationKey);

  function shell(title, active, body, {description = t.description, canonical = '', article = false, post} = {}) {
    const translated = pairedPost(post);
    const alternatePath = article ? (translated ? postPath(translated) : '') : canonical;
    const otherUrl = asset(otherPrefix + alternatePath);
    const alternateAvailable = !article || !!translated;
    const messages = JSON.stringify(t).replace(/</g,'\\u003c');
    return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'zh-CN'}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(config.name)}</title><meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#111713"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${article ? 'article' : 'website'}">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'zh_CN'}"><meta property="og:url" content="${absolute(canonical)}">
<link rel="canonical" href="${absolute(canonical)}">
<link rel="alternate" hreflang="${lang === 'en' ? 'en' : 'zh-CN'}" href="${absolute(canonical)}">
${alternateAvailable ? `<link rel="alternate" hreflang="${otherLang === 'en' ? 'en' : 'zh-CN'}" href="${config.url.replace(/\/$/,'')}${otherUrl}">` : ''}
<link rel="icon" href="${asset('assets/favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(config.name)} RSS (${lang})" href="${url('feed.xml')}">
<script>try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'dark';if(${JSON.stringify(lang === 'en' && canonical === '')}&&localStorage.getItem('language')==='zh')location.replace(${JSON.stringify(asset('zh/'))}+location.search+location.hash)}catch{}</script>
<link rel="stylesheet" href="${asset('assets/style.css')}"><script id="ui-messages" type="application/json">${messages}</script><script src="${asset('assets/app.js')}" defer></script>
</head><body><a class="skip-link" href="#main">${t.skip}</a>
<header class="header"><div class="header-inner">
<a class="brand" href="${url()}"><span class="brand-mark">c<span>_</span></span><span>${esc(config.name)}<small>SECURITY RESEARCH</small></span></a>
<nav aria-label="${t.navigation}">${[['home','',t.journal],['archive','archive/',t.archive],['about','about/',t.about]].map(([key, route, label])=>`<a ${active === key ? 'aria-current="page"' : ''} href="${url(route)}">${label}</a>`).join('')}</nav>
<div class="header-tools"><a class="icon-button" href="${url('feed.xml')}" aria-label="${t.subscribe}">${icon('rss')}</a>
<button class="icon-button theme-toggle" type="button" aria-label="${t.lightTheme}">${icon('sun')}</button>
<a class="github-link" href="${esc(config.github)}" target="_blank" rel="noopener noreferrer">GitHub ${icon('arrow',15)}</a>
<div class="language-switch" role="group" aria-label="${t.language}"><a lang="en" hreflang="en" data-language="en" href="${lang === 'en' ? url(canonical) : otherUrl}" ${lang === 'en' ? 'aria-current="true"' : ''}>EN</a><span aria-hidden="true">/</span><a lang="zh-CN" hreflang="zh-CN" data-language="zh" href="${lang === 'zh' ? url(canonical) : otherUrl}" ${lang === 'zh' ? 'aria-current="true"' : ''}>中文</a></div>
</div></div></header>
${body}
<footer class="footer"><div><a class="footer-brand" href="${url()}">c_ <span>${esc(config.name)}</span></a><p>${t.motto}</p></div><div class="footer-right"><a href="${url('feed.xml')}">${t.rss} ${icon('rss',14)}</a><span>© ${new Date().getFullYear()} ${esc(config.author)}</span><span>Written with curiosity.</span></div></footer>
<div class="toast" role="status" aria-live="polite"></div></body></html>`;
  }

  const row = (p, index) => `<article class="post-row" data-post data-category="${esc(p.category)}" data-search="${esc([p.title,p.summary,p.category,...p.tags].join(' ').toLowerCase())}">
<span class="post-number">${String(index+1).padStart(2,'0')}</span><div class="post-row-content"><div class="post-meta">${postMeta(p)}</div>
<h3><a href="${url(postPath(p))}">${esc(p.title)}</a></h3><p>${esc(p.summary)}</p><div class="tag-list">${p.tags.map(tag=>`<span># ${esc(tag)}</span>`).join('')}</div></div>
<a class="row-arrow" href="${url(postPath(p))}" aria-label="${t.read} ${esc(p.title)}">${icon('arrow')}</a></article>`;
  const featured = posts.find(p => p.featured) || posts[0];
  const emptyState = `<div class="empty-state" ${posts.length ? 'hidden' : ''}><span>∅</span><h3>${posts.length ? t.noMatches : t.noPosts}</h3><p>${posts.length ? t.noMatchesHint : t.noPostsHint}</p><button class="text-link reset-search" ${posts.length ? '' : 'hidden'}>${t.reset}</button></div>`;

  await writeLocal('index.html', shell(t.title,'home',`<main id="main">
<section class="hero container"><div class="hero-copy"><div class="eyebrow"><span class="status-dot"></span> INDEPENDENT SECURITY RESEARCHER</div>
<h1>${t.heroFirst}<br>${t.heroSecond}<span class="serif-accent">${t.heroAccent}</span><span class="hero-cursor">_</span></h1><p>${t.heroDescription}</p>
<div class="hero-links"><a class="button button-primary" href="#journal">${t.readNotes} <span>↓</span></a><a class="text-link" href="${url('about/')}">${t.aboutMe} ${icon('arrow',15)}</a></div></div>
<div class="hero-visual"><div class="visual-topline"><span>RESEARCH ENVIRONMENT</span><span class="status-dot"></span></div>${topology}<div class="visual-bottom"><span><i></i> curiosity.mode = always</span><span>[ 01 / ∞ ]</span></div></div>
<div class="hero-footnote"><span>WEB SECURITY / CODE AUDIT / RESEARCH NOTES</span><span>${t.method}</span></div></section>
${featured ? `<section class="featured container"><div class="featured-label"><span class="small-label">EDITOR'S PICK</span><span>${t.featured}</span><span class="featured-star">✳</span></div><a class="featured-content" href="${url(postPath(featured))}"><div class="post-meta">${postMeta(featured)}</div><h2>${esc(featured.title)}</h2><p>${esc(featured.summary)}</p><span class="featured-action">${t.readFull} ${icon('arrow',17)}</span></a><div class="featured-index">01<span>FIELD<br>NOTES</span></div></section>` : ''}
<section class="journal container" id="journal"><div class="section-title"><div><span class="small-label">THE JOURNAL</span><h2>${t.notes}<span> / ${String(posts.length).padStart(2,'0')}</span></h2></div><a class="text-link" href="${url('archive/')}">${t.allArchive} ${icon('arrow',15)}</a></div>
<div class="journal-layout"><div class="journal-main"><div class="filter-bar"><div class="filters" role="group" aria-label="${t.categories}"><button class="filter active" data-filter="all" aria-pressed="true">${t.all}</button>${categories.map(category=>`<button class="filter" data-filter="${esc(category)}" aria-pressed="false">${esc(category)}</button>`).join('')}</div>
<label class="search-box">${icon('search',16)}<input id="search" type="search" placeholder="${t.searchPlaceholder}" aria-label="${t.searchLabel}"><kbd>/</kbd></label></div>
<p class="filter-status" role="status" aria-live="polite"></p><div class="post-list">${posts.map(row).join('')}</div>${emptyState}
<div class="list-end"><span></span> EVERY NOTE IS A SMALL STEP FORWARD <span></span></div></div>
<aside class="sidebar"><div class="profile-card"><span class="small-label">BEHIND THE NOTES</span><div class="avatar">c<span>_</span><i></i></div><h3>${esc(config.name)}</h3><span class="profile-role">Security researcher & builder</span><p>${t.profile}</p><a class="text-link" href="${url('about/')}">${t.moreAbout} ${icon('arrow',15)}</a><div class="profile-footer">${icon('git',17)}<a href="${esc(config.github)}">${esc(config.name)}</a></div></div>
<div class="topics-card"><span class="small-label">RESEARCH AREAS</span>${categories.map((category,index)=>`<button data-topic="${esc(category)}"><span><small>0${index+1}</small>${esc(category)}</span><span>${String(posts.filter(p=>p.category===category).length).padStart(2,'0')} ↗</span></button>`).join('')}</div>
<a class="rss-card" href="${url('feed.xml')}"><span class="rss-symbol">${icon('rss',23)}</span><h3>${t.rssTitle}</h3><p>${t.rssDescription}</p><span class="text-link">${t.subscribeFeed} ${icon('arrow',15)}</span></a>
<div class="sidebar-note">// A notebook, not a highlight reel.<br>${t.sidebarNote}</div></aside></div></section></main>`));

  for (let index=0; index<posts.length; index++) {
    const p = posts[index], next = posts[index+1] || posts[index-1];
    await writeLocal(`${postPath(p)}index.html`,shell(p.title,'home',`<main id="main" class="container article-page"><a class="back-link" href="${url()}#journal">${t.back}</a>
<header class="article-header"><div class="post-meta">${postMeta(p)}</div><h1>${esc(p.title)}</h1><p>${esc(p.summary)}</p><div class="article-byline"><span class="mini-avatar">c_</span><strong>${esc(config.author)}</strong><span>／ ${p.tags.map(esc).join(' · ')}</span></div></header>
<div class="article-layout"><article class="prose">${p.html}<div class="article-end"><span>— END OF NOTE —</span><p>${t.articleEnd}</p><button type="button" class="share-link text-link">${t.copyLink}</button></div>
${next ? `<a class="next-post" href="${url(postPath(next))}"><span class="small-label">CONTINUE READING</span><h3>${esc(next.title)} ${icon('arrow',18)}</h3></a>` : ''}</article>
<aside class="article-toc"><span class="small-label">ON THIS PAGE</span><nav aria-label="${t.toc}">${p.toc.map(item=>`<a class="toc-level-${item.level}" href="#${item.id}">${esc(item.title)}</a>`).join('')}</nav><a class="toc-top" href="#main">${t.top}</a></aside></div></main>`,{description:p.summary,canonical:postPath(p),article:true,post:p}));
  }

  const years = [...new Set(posts.map(p=>p.date.slice(0,4)))];
  await writeLocal('archive/index.html',shell(t.archiveTitle,'archive',`<main id="main" class="container inner-page"><span class="eyebrow">THE COMPLETE INDEX</span><h1>${t.archiveTitle}<span class="serif-accent">${lang === 'en' ? '.' : '。'}</span></h1><p class="page-intro">${t.archiveDescription.replace('{count}',posts.length)}</p>
${posts.length ? years.map(year=>`<section class="archive-year"><h2>${year}<small>${posts.filter(p=>p.date.startsWith(year)).length} NOTES</small></h2><div>${posts.filter(p=>p.date.startsWith(year)).map(p=>`<a class="archive-row" href="${url(postPath(p))}"><time datetime="${p.date}">${p.date.slice(5).replace('-',' / ')}</time><h3>${esc(p.title)}</h3><span class="category">${esc(p.category)}</span>${icon('arrow',18)}</a>`).join('')}</div></section>`).join('') : `<p class="archive-empty">${t.archiveEmpty}</p>`}
<a class="text-link" href="${url('feed.xml')}">${t.followRss} ${icon('rss',16)}</a></main>`,{canonical:'archive/'}));

  await writeLocal('about/index.html',shell(t.aboutTitle,'about',`<main id="main" class="container inner-page about-page"><span class="eyebrow">THE PERSON BEHIND THE NOTES</span><h1>${t.hello}<br><span class="serif-accent">${esc(config.name)}${lang === 'en' ? '.' : '。'}</span></h1><p class="page-intro">${t.aboutIntro}</p>
<div class="about-grid"><section class="prose"><h2>${t.aboutSpace}</h2><p>${t.aboutSpaceFirst}</p><p>${t.aboutSpaceSecond}</p><h2>${t.researchAreas}</h2><ul><li>${t.areaWeb}</li><li>${t.areaAudit}</li><li>${t.areaTools}</li></ul><h2>${t.contact}</h2><p>${t.contactBefore}<a href="${esc(config.github)}">GitHub · ${esc(config.name)}</a>${t.contactBetween}<a href="${url('feed.xml')}">RSS</a>${t.contactAfter}</p><blockquote>${t.disclaimer}</blockquote></section>
<aside class="about-note"><span class="small-label">RESEARCH PRINCIPLES</span><h2>${t.principles}</h2><span class="mono">01 / Ask better questions.<br>02 / Follow the evidence.<br>03 / Share what you learn.</span></aside></div></main>`,{canonical:'about/'}));

  await writeLocal('404.html',shell(t.notFound,'',`<main id="main" class="container inner-page not-found"><span class="eyebrow">404 / OUT OF BOUNDS</span><h1>${t.missingHeading}</h1><p class="page-intro">${t.missingDescription}</p><a class="button button-primary" href="${url()}">${t.home}</a></main>`,{canonical:'404.html'}));

  await writeLocal('feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(config.name)} · ${esc(t.title)}</title><link>${absolute('')}</link><description>${esc(t.description)}</description><language>${lang === 'en' ? 'en' : 'zh-cn'}</language>${posts.map(p=>`<item><title>${esc(p.title)}</title><link>${absolute(postPath(p))}</link><guid>${absolute(postPath(p))}</guid><pubDate>${new Date(p.date+'T00:00:00+08:00').toUTCString()}</pubDate><description>${esc(p.summary)}</description><category>${esc(p.category)}</category></item>`).join('')}</channel></rss>`);

  return ['', 'about/', 'archive/', ...posts.map(postPath)].map(route=>absolute(route));
}
