const $ = (s, root = document) => root.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const toast = message => {
  const el = $('.toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(()=>el.classList.remove('visible'),2500);
};
const themeToggle = $('.theme-toggle');
function updateThemeLabel() {themeToggle.setAttribute('aria-label',document.documentElement.dataset.theme === 'light' ? '切换到深色主题' : '切换到浅色主题');}
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
  $('.filter-status').textContent = query || category !== 'all' ? `找到 ${count} 篇手记` : '';
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
  try {await navigator.clipboard.writeText($('pre code',button.closest('.code-block')).textContent);toast('代码已复制');} catch {toast('复制失败，请手动选择代码复制');}
}));
$('.share-link')?.addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(location.href.split('#')[0]);toast('文章链接已复制');} catch {toast('复制失败，请复制浏览器地址栏中的链接');}
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
