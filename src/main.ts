/**
 * InlineCMS - Minimal entry point
 */

import { InlineCMS } from './inlinecms';

// Auto-init on DOM ready
if (typeof window !== 'undefined') {
  let initTimer: number | null = null;
  const initAll = async () => {
    const roots = document.querySelectorAll('[data-markdown]');
    roots.forEach(root => {
      const el = root as HTMLElement;
      if (el.dataset.inlinecmsInitialized === 'true') return;
      el.dataset.inlinecmsInitialized = 'true';
      new InlineCMS(el, {
        contentDir: (window as any).__INLINECMS_CONFIG__?.contentDir || 'src/content/blog',
        autosaveDelay: (window as any).__INLINECMS_CONFIG__?.autosaveDelay || 2000,
        enabled: (window as any).__INLINECMS_CONFIG__?.enabled !== false
      });
    });

    // Ensure management sidebar exists even if no editor root on page
    try {
      const mod = await import('./plugins');
      (mod as any).setupPostManagement?.();
    } catch {}
  };

  // Initial page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Re-init on Astro client-side navigations
  document.addEventListener('astro:page-load', () => initAll());
  document.addEventListener('astro:after-swap', () => initAll());

  // Ensure persistence via placeholder in the incoming document
  // This lets Astro move our existing sidebar across the swap.
  document.addEventListener('astro:before-swap', (ev: any) => {
    const doc: Document | undefined = ev?.newDocument;
    if (!doc) return;
    // If new page doesn’t already include a persisted placeholder, add one.
    if (!doc.querySelector('.cms-sidebar')) {
      const placeholder = doc.createElement('div');
      placeholder.className = 'cms-sidebar';
      try { placeholder.setAttribute('transition:persist', 'inlinecms-sidebar'); } catch {}
      placeholder.style.display = 'none';
      doc.body.appendChild(placeholder);
    }
  });

  // MutationObserver: initialize when new roots enter DOM
  const mo = new MutationObserver(() => {
    if (initTimer) window.clearTimeout(initTimer);
    initTimer = window.setTimeout(() => initAll(), 50);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // History navigation fallback (for other routers)
  const navEvent = () => { if (initTimer) window.clearTimeout(initTimer); initTimer = window.setTimeout(() => initAll(), 0); };
  window.addEventListener('popstate', navEvent);
  const _ps = history.pushState; history.pushState = function(...args) { const r = _ps.apply(this, args as any); navEvent(); return r; } as any;
  const _rs = history.replaceState; history.replaceState = function(...args) { const r = _rs.apply(this, args as any); navEvent(); return r; } as any;
}

export { InlineCMS };
