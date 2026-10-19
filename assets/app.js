const $ = (s, root = document) => root.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const t = JSON.parse($('#ui-messages').textContent);
$$('[data-language]').forEach(link=>link.addEventListener('click',()=>{
  try {localStorage.setItem('language',link.dataset.language);} catch {}
}));
const toast = message => {
  const el = $('.toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(()=>el.classList.remove('visible'),2500);
};
const themeToggle = $('.theme-toggle');
function updateThemeLabel() {themeToggle.setAttribute('aria-label',document.documentElement.dataset.theme === 'light' ? t.darkTheme : t.lightTheme);}
updateThemeLabel();
themeToggle.addEventListener('click',()=> {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme; try {localStorage.setItem('theme',theme);} catch {}
  updateThemeLabel();
});
const search = $('#search'); let category = 'all';
function filterPosts() {
  const query = search.value.trim().toLowerCase(); let count = 0;
  $$('[data-post]').forEach(post=> {
    const match = (category === 'all' || post.dataset.category === category) && post.dataset.search.includes(query);
    post.hidden = !match; if (match) count++;
  });
  $('.empty-state').hidden = count !== 0;
  $('.filter-status').textContent = query || category !== 'all' ? t.results.replace('{count}', count) : '';
  $$('[data-filter]').forEach(button=> {
    const active = button.dataset.filter === category;
    button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
  });
}
if (search) {
  search.addEventListener('input',filterPosts);
  $$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;filterPosts();}));
  $$('[data-topic]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.topic;filterPosts();$('#journal').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}));
  $('.reset-search').addEventListener('click',()=>{category='all';search.value='';filterPosts();search.focus();});
  document.addEventListener('keydown',e=>{
    if(e.key==='/' && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {e.preventDefault();search.focus();}
  });
}
$$('.copy-code').forEach(button=>button.addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText($('pre code',button.closest('.code-block')).textContent);toast(t.codeCopied);} catch {toast(t.codeFailed);}
}));
$('.share-link')?.addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(location.href.split('#')[0]);toast(t.linkCopied);} catch {toast(t.linkFailed);}
});
if ('IntersectionObserver' in window) {
  const tocLinks = $$('.article-toc nav a');
  const observer = new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting) tocLinks.forEach(link=>{
      const current = link.hash === '#'+entry.target.id;
      link.classList.toggle('current',current);
      if(current) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
    });
  }),{rootMargin:'-12% 0px -65% 0px'});
  $$('.prose h1,.prose h2,.prose h3').forEach(heading=>observer.observe(heading));
}
