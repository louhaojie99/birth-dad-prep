(() => {
  'use strict';
  const body = document.body;
  const chapters = Array.from(document.querySelectorAll('.chapter'));
  const navLinks = Array.from(document.querySelectorAll('.chapter-nav a'));
  const modes = Array.from(document.querySelectorAll('[data-set-mode]'));
  const previous = document.querySelector('#previous');
  const next = document.querySelector('#next');
  const fullscreen = document.querySelector('#fullscreen');
  const menuButton = document.querySelector('#menu-toggle');
  const sidebar = document.querySelector('#sidebar');
  const mobile = window.matchMedia('(max-width: 900px)');
  const appendix = document.querySelector('#appendix');
  const progress = document.querySelector('#deck-progress');
  const toast = document.querySelector('#toast');
  let mode = 'ppt';
  let current = 0;
  let scrollFrame = 0;
  let toastTimer;

  function announce(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function sync() {
    chapters.forEach((chapter, i) => {
      chapter.classList.toggle('is-active', i === current);
      // Hidden chapters must also leave the accessibility tree and tab order.
      chapter.hidden = mode === 'ppt' && i !== current;
    });
    navLinks.forEach((link, i) => {
      if (i === current) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    document.querySelector('#page-number').textContent = String(current + 1).padStart(2, '0');
    document.querySelector('#current-title').textContent = chapters[current].dataset.shortTitle;
    document.querySelector('#slide-status').textContent = `第 ${current + 1} 页，共 ${chapters.length} 页：${chapters[current].dataset.shortTitle}`;
    previous.disabled = current === 0;
    next.disabled = current === chapters.length - 1;
    progress.setAttribute('aria-valuenow', String(current + 1));
    progress.setAttribute('aria-valuetext', `第 ${current + 1} 页，共 ${chapters.length} 页`);
    progress.querySelector('.progress-fill').style.width = `${((current + 1) / chapters.length) * 100}%`;
  }

  function updateHash() {
    // Some file:// browsers disallow replaceState; navigation remains usable.
    try { history.replaceState(null, '', `#${chapters[current].id}`); } catch (_) { /* no-op */ }
  }

  function goTo(index, { focus = false, scroll = true } = {}) {
    if (index < 0 || index >= chapters.length) return;
    const changed = current !== index;
    current = index;
    sync();
    updateHash();
    if (mode === 'ppt' && changed) chapters[current].scrollTop = 0;
    if (mode === 'normal' && scroll) chapters[current].scrollIntoView({ behavior: 'instant', block: 'start' });
    if (focus) chapters[current].querySelector('h1, h2').focus({ preventScroll: true });
  }

  function visibleChapter() {
    const marker = document.querySelector('.topbar').getBoundingClientRect().bottom + 100;
    let index = 0;
    chapters.forEach((chapter, i) => {
      if (chapter.getBoundingClientRect().top <= marker) index = i;
    });
    return index;
  }

  function setMode(value) {
    if (value === mode) return;
    if (mode === 'normal') current = visibleChapter();
    mode = value;
    body.dataset.mode = mode;
    appendix.hidden = mode === 'ppt';
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.setMode === mode)));
    sync();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (mode === 'normal') chapters[current].scrollIntoView({ behavior: 'instant', block: 'start' });
    updateHash();
  }

  function setMenu(open, restoreFocus = false) {
    body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    sidebar.inert = mobile.matches && !open;
    if (open) navLinks[current].focus();
    else if (restoreFocus) menuButton.focus();
  }

  modes.forEach(button => button.addEventListener('click', () => setMode(button.dataset.setMode)));
  previous.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', () => goTo(current + 1));
  document.querySelectorAll('a[data-chapter]').forEach(link => {
    link.addEventListener('click', event => {
      const index = chapters.findIndex(chapter => `#${chapter.id}` === link.getAttribute('href'));
      if (index < 0) return;
      event.preventDefault();
      setMenu(false);
      goTo(index, { focus: true });
    });
  });
  menuButton.addEventListener('click', () => setMenu(!body.classList.contains('menu-open'), true));
  document.querySelector('#menu-backdrop').addEventListener('click', () => setMenu(false, true));
  mobile.addEventListener('change', () => setMenu(false));
  document.addEventListener('keydown', event => {
    const menuOpen = body.classList.contains('menu-open');
    if (event.key === 'Escape' && menuOpen) { setMenu(false, true); return; }
    if (menuOpen && event.key === 'Tab') {
      const focusable = Array.from(sidebar.querySelectorAll('a, button'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    const editing = event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]');
    if (editing || menuOpen || mode !== 'ppt' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });

  window.addEventListener('scroll', () => {
    if (mode !== 'normal' || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (mode !== 'normal') return;
      const index = visibleChapter();
      if (index !== current) { current = index; sync(); }
    });
  }, { passive: true });
  window.addEventListener('hashchange', () => {
    const index = chapters.findIndex(chapter => `#${chapter.id}` === location.hash);
    if (index >= 0) goTo(index);
  });

  fullscreen.addEventListener('click', async () => {
    if (!document.documentElement.requestFullscreen) {
      announce('当前浏览器不支持全屏，仍可使用完整演示视图。');
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) { announce('暂时无法进入全屏，演示和翻页仍可正常使用。'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
    fullscreen.title = active ? '退出全屏' : '进入全屏';
  });

  const checkboxes = Array.from(document.querySelectorAll('[data-check]'));
  const storageKey = 'dad-to-be-guide.checklist.v1';
  let saved = {};
  let canSave = true;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  } catch (_) { canSave = false; }
  function updateChecklist() {
    const count = checkboxes.filter(checkbox => checkbox.checked).length;
    document.querySelector('#check-count').textContent = String(count).padStart(2, '0');
    document.querySelector('#check-message').textContent = count === checkboxes.length ? '全部事项已确认。' : '勾选已完成事项。';
    document.querySelector('#storage-note').textContent = canSave ? '勾选记录仅保存在当前浏览器中。' : '当前浏览器无法保存记录；本次勾选仍然有效。';
  }
  checkboxes.forEach(checkbox => {
    checkbox.checked = saved[checkbox.dataset.check] === true;
    checkbox.addEventListener('change', () => {
      saved[checkbox.dataset.check] = checkbox.checked;
      try { localStorage.setItem(storageKey, JSON.stringify(saved)); canSave = true; }
      catch (_) { canSave = false; }
      updateChecklist();
    });
  });
  const initial = chapters.findIndex(chapter => `#${chapter.id}` === location.hash);
  if (initial >= 0) current = initial;
  setMenu(false);
  updateChecklist();
  sync();
})();
