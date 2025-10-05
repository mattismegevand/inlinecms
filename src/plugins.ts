/**
 * InlineCMS Plugins - All in one file (tinygrad-style)
 * Image upload, Post management, Modals, API - ~400 lines total
 */

// ============================================================================
// Types
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Post { slug: string; title: string; date: string; draft: boolean; path: string; frontmatter: Record<string, any>; }

// ============================================================================
// Toast/Modal Manager (inline, minimal)
// ============================================================================

function showToast(type: ToastType, title: string, message: string) {
  let container = document.querySelector('.cms-toasts') as HTMLElement;
  if (!container) {
    container = document.createElement('div');
    container.className = 'cms-toasts';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `cms-toast cms-toast-${type}`;
  toast.innerHTML = `
    <span>${icons[type]}</span>
    <div><b>${title}</b><p>${message}</p></div>
    <button onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);

  // Add styles if needed
  if (!document.querySelector('#cms-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'cms-toast-styles';
    style.textContent = `
      .cms-toasts { position: fixed; top: 80px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; }
      .cms-toast { display: flex; gap: 12px; align-items: center; background: white; border-radius: 8px; padding: 12px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 300px; animation: slideIn 0.3s; }
      .cms-toast span { font-size: 20px; }
      .cms-toast div { flex: 1; }
      .cms-toast b { font-size: 14px; display: block; margin-bottom: 4px; }
      .cms-toast p { font-size: 13px; color: #666; margin: 0; }
      .cms-toast button { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
      .cms-toast-success { border-left: 4px solid #10b981; }
      .cms-toast-error { border-left: 4px solid #ef4444; }
      @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    `;
    document.head.appendChild(style);
  }
}

// Ensure modal styles are present (used by both showModal and custom modals)
function ensureModalStyles() {
  if (!document.querySelector('#cms-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'cms-modal-styles';
    style.textContent = `
      .cms-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001; animation: fadeIn 0.2s; }
      .cms-modal-content { background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
      .cms-modal-content h3 { margin: 0 0 16px 0; font-size: 20px; }
      .cms-modal-body { margin-bottom: 20px; }
      .cms-modal-buttons { display: flex; gap: 12px; justify-content: flex-end; }
      .cms-btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
      .cms-btn-primary { background: #3b82f6; color: white; }
      .cms-btn-secondary { background: #f1f5f9; color: #64748b; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    `;
    document.head.appendChild(style);
  }
}

function createModalContainer(): HTMLDivElement {
  ensureModalStyles();
  const modal = document.createElement('div');
  modal.className = 'cms-modal';
  // Inline fallback to guarantee overlay even if CSS fails/missing
  const s = modal.style;
  s.setProperty('position', 'fixed', 'important');
  s.setProperty('inset', '0px', 'important');
  s.setProperty('background', 'rgba(0,0,0,0.5)', 'important');
  s.setProperty('display', 'flex', 'important');
  s.setProperty('align-items', 'center', 'important');
  s.setProperty('justify-content', 'center', 'important');
  s.setProperty('z-index', '10001', 'important');
  return modal;
}

function showModal(title: string, content: string, onConfirm?: () => void) {
  const modal = createModalContainer();
  modal.innerHTML = `
    <div class="cms-modal-content">
      <h3>${title}</h3>
      <div class="cms-modal-body">${content}</div>
      <div class="cms-modal-buttons">
        <button class="cms-btn cms-btn-secondary" data-action="cancel">Cancel</button>
        ${onConfirm ? '<button class="cms-btn cms-btn-primary" data-action="confirm">Confirm</button>' : ''}
      </div>
    </div>
  `;

  modal.querySelector('[data-action="cancel"]')!.addEventListener('click', () => modal.remove());
  if (onConfirm) {
    modal.querySelector('[data-action="confirm"]')!.addEventListener('click', () => {
      onConfirm();
      modal.remove();
    });
  }

  document.body.appendChild(modal);
}

// ============================================================================
// Post API
// ============================================================================

class PostAPI {
  async list(): Promise<Post[]> {
    const res = await fetch('/__list');
    const data = await res.json();
    return data.posts || [];
  }

  async create(title: string, slug: string, frontmatter: Record<string, any> = {}): Promise<{ success: boolean; path?: string; error?: string }> {
    const res = await fetch('/__create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, frontmatter })
    });
    return res.json();
  }

  async delete(path: string): Promise<{ success: boolean }> {
    const res = await fetch('/__delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    return res.json();
  }

  async getFrontmatter(path: string): Promise<Record<string, any>> {
    const res = await fetch('/__get-frontmatter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    return data.frontmatter || {};
  }

  async updateFrontmatter(path: string, frontmatter: Record<string, any>): Promise<void> {
    await fetch('/__update-frontmatter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, frontmatter })
    });
  }

  async getSchema(): Promise<Record<string, string>> {
    const res = await fetch('/__schema');
    const data = await res.json();
    return data.schema || {};
  }
}

// ============================================================================
// Image Plugin
// ============================================================================

export function setupImagePlugin(editor: any) {
  const root = editor.root;

  const insertAtPoint = (e: DragEvent, node: Node) => {
    const anyDoc: any = document as any;
    let range: Range | null = null;
    if (anyDoc.caretRangeFromPoint) range = anyDoc.caretRangeFromPoint(e.clientX, e.clientY);
    else if (anyDoc.caretPositionFromPoint) {
      const pos = anyDoc.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    }
    if (range) {
      range.collapse(true);
      range.insertNode(node);
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        r.deleteContents();
        r.insertNode(node);
      } else {
        root.appendChild(node);
      }
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    root.classList.remove('cms-drag-over');

    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      for (const file of files) await uploadImage(file, file.name, e);
      return;
    }

    // Fallback: dragging from another tab/site often provides a URL
    const uri = e.dataTransfer?.getData('text/uri-list') || '';
    if (uri && /^https?:\/\//.test(uri)) {
      try {
        const res = await fetch(uri, { mode: 'cors' });
        const blob = await res.blob();
        const name = uri.split('/').pop() || 'image';
        await uploadImage(blob, name, e);
        return;
      } catch {
        editor.updateStatus({ state: 'error', text: '❌ Image fetch failed' });
      }
    }
  };

  const uploadImage = async (fileOrBlob: File | Blob, suggestedName?: string, e?: DragEvent) => {
    editor.updateStatus({ state: 'saving', text: '📁 Uploading...' });
    const formData = new FormData();
    let file: File;
    if (fileOrBlob instanceof File) file = fileOrBlob;
    else file = new File([fileOrBlob], suggestedName || 'image.png', { type: fileOrBlob.type || 'image/png' });
    formData.append('file', file);

    try {
      const res = await fetch('/__upload', { method: 'POST', body: formData });
      const { url } = await res.json();

      const img = document.createElement('img');
      img.src = url;
      img.alt = file.name;
      img.style.maxWidth = '100%';

      if (e) insertAtPoint(e, img); else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
        } else {
          root.appendChild(img);
        }
      }

      editor.updateStatus({ state: 'saved', text: '✅ Uploaded' });
      setTimeout(() => editor.updateStatus({ state: 'editing', text: '✏️ Editing' }), 1500);
      editor.debouncedSave();
    } catch (err) {
      editor.updateStatus({ state: 'error', text: '❌ Upload failed' });
    }
  };

  root.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    root.classList.add('cms-drag-over');
  });
  root.addEventListener('dragleave', () => root.classList.remove('cms-drag-over'));
  root.addEventListener('drop', handleDrop);
  root.addEventListener('paste', (e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) uploadImage(file);
    }
  });
}

// ============================================================================
// Post Management Plugin
// ============================================================================

export function setupPostManagement() {
  // Avoid duplicating the sidebar if already present for this page
  if (document.querySelector('.cms-sidebar')) return;
  const api = new PostAPI();

  // Create sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'cms-sidebar';
  // Persist across Astro ClientRouter navigations by giving it a stable id
  // The matching placeholder is injected during `astro:before-swap` in src/main.ts
  try { sidebar.setAttribute('transition:persist', 'inlinecms-sidebar'); } catch {}
  sidebar.innerHTML = `
    <div class="cms-sidebar-header">
      <div class="cms-brand"><span class="cms-brand-dot"></span>InlineCMS</div>
      <div class="cms-grip" aria-hidden>⋮⋮</div>
    </div>
    <div class="cms-sidebar-group">
      <button class="cms-sidebar-btn" data-action="new"><span class="cms-ico">＋</span><span>New</span></button>
      <button class="cms-sidebar-btn" data-action="list"><span class="cms-ico">☰</span><span>All Posts</span></button>
      <button class="cms-sidebar-btn" data-action="frontmatter"><span class="cms-ico">⚙︎</span><span>Settings</span></button>
    </div>
    <div class="cms-sidebar-sep"></div>
    <button class="cms-sidebar-btn cms-btn-danger" data-action="delete"><span class="cms-ico">✕</span><span>Delete</span></button>
  `;
  document.body.appendChild(sidebar);

  // Restore saved position if present
  try {
    const saved = localStorage.getItem('cms-sidebar-pos');
    if (saved) {
      const { left, top } = JSON.parse(saved);
      if (typeof left === 'number' && typeof top === 'number') {
        sidebar.style.left = `${left}px`;
        sidebar.style.top = `${top}px`;
        sidebar.style.transform = '';
      }
    }
  } catch {}

  // Handlers
  const handleNew = () => {
    const modal = createModalContainer();
    modal.innerHTML = `
      <div class="cms-modal-content">
        <h3>Create New Post</h3>
        <div class="cms-modal-body">
          <label>Title: <input type="text" id="post-title" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;"></label>
          <label style="margin-top: 12px; display: block;">Slug: <input type="text" id="post-slug" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;"></label>
        </div>
        <div class="cms-modal-buttons">
          <button class="cms-btn cms-btn-secondary" data-action="cancel">Cancel</button>
          <button class="cms-btn cms-btn-primary" data-action="create">Create</button>
        </div>
      </div>
    `;

    modal.querySelector('[data-action="cancel"]')!.addEventListener('click', () => modal.remove());
    modal.querySelector('[data-action="create"]')!.addEventListener('click', async () => {
      const title = (document.getElementById('post-title') as HTMLInputElement).value;
      const slug = (document.getElementById('post-slug') as HTMLInputElement).value;
      if (!title || !slug) return;

      const result = await api.create(title, slug);
      if (result.success && result.path) {
        showToast('success', 'Created', 'Post created successfully');
        window.location.href = result.path;
      } else {
        showToast('error', 'Error', result.error || 'Failed to create post');
      }
      modal.remove();
    });

    document.body.appendChild(modal);
  };

  const handleList = async () => {
    const posts = await api.list();
    const modal = createModalContainer();
    modal.innerHTML = `
      <div class="cms-modal-content" style="max-width: 700px;">
        <h3>All Posts (${posts.length})</h3>
        <div class="cms-modal-body" style="max-height: 400px; overflow-y: auto;">
          ${posts.map(p => `
            <div style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="window.location.href='${p.path}'">
              <div>
                <b>${p.title}</b>
                <div style="font-size: 12px; color: #666;">${p.slug} • ${p.draft ? 'Draft' : 'Published'}</div>
              </div>
              <div style="font-size: 12px; color: #999;">${p.date}</div>
            </div>
          `).join('')}
        </div>
        <div class="cms-modal-buttons">
          <button class="cms-btn cms-btn-secondary" data-action="close">Close</button>
        </div>
      </div>
    `;

    modal.querySelector('[data-action="close"]')!.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
  };

  const handleFrontmatter = async () => {
    const fm = await api.getFrontmatter(location.pathname);
    const schema = await api.getSchema();

    const modal = createModalContainer();
    const fields = Object.entries(fm).map(([key, val]) => `
      <label style="display: block; margin-bottom: 12px;">
        ${key}:
        <input type="${schema[key] === 'date' ? 'date' : 'text'}"
               data-key="${key}"
               value="${val}"
               style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
      </label>
    `).join('');

    modal.innerHTML = `
      <div class="cms-modal-content">
        <h3>Edit Frontmatter</h3>
        <div class="cms-modal-body" style="max-height: 400px; overflow-y: auto;">${fields}</div>
        <div class="cms-modal-buttons">
          <button class="cms-btn cms-btn-secondary" data-action="cancel">Cancel</button>
          <button class="cms-btn cms-btn-primary" data-action="save">Save</button>
        </div>
      </div>
    `;

    modal.querySelector('[data-action="cancel"]')!.addEventListener('click', () => modal.remove());
    modal.querySelector('[data-action="save"]')!.addEventListener('click', async () => {
      const inputs = modal.querySelectorAll('input[data-key]');
      const newFm: Record<string, any> = {};
      inputs.forEach((input: any) => {
        newFm[input.dataset.key] = input.value;
      });

      await api.updateFrontmatter(location.pathname, newFm);
      showToast('success', 'Saved', 'Frontmatter updated');
      modal.remove();
      setTimeout(() => location.reload(), 1000);
    });

    document.body.appendChild(modal);
  };

  const handleDelete = async () => {
    showModal('Delete Post?', 'This action cannot be undone.', async () => {
      await api.delete(location.pathname);
      showToast('success', 'Deleted', 'Post deleted');
      setTimeout(() => window.location.href = '/', 1500);
    });
  };

  // Event listeners
  sidebar.querySelector('[data-action="new"]')!.addEventListener('click', handleNew);
  sidebar.querySelector('[data-action="list"]')!.addEventListener('click', handleList);
  sidebar.querySelector('[data-action="frontmatter"]')!.addEventListener('click', handleFrontmatter);
  sidebar.querySelector('[data-action="delete"]')!.addEventListener('click', handleDelete);

  // Drag to reposition (pointer events)
  const header = sidebar.querySelector('.cms-sidebar-header') as HTMLElement;
  let dragging = false;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;

  const onPointerDown = (e: PointerEvent) => {
    // Only left button or primary touch
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    const rect = sidebar.getBoundingClientRect();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    header.setPointerCapture?.(e.pointerId);
    sidebar.classList.add('cms-sidebar-dragging');
    // Avoid accidental text selection while dragging
    (document.body as any).style.userSelect = 'none';
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const rect = sidebar.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = startLeft + dx;
    let top = startTop + dy;
    // Clamp to viewport with 8px margin
    left = Math.max(8, Math.min(vw - width - 8, left));
    top = Math.max(8, Math.min(vh - height - 8, top));
    sidebar.style.left = `${left}px`;
    sidebar.style.top = `${top}px`;
    sidebar.style.transform = '';
  };

  const endDrag = (e?: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try { e && header.releasePointerCapture?.(e.pointerId); } catch {}
    sidebar.classList.remove('cms-sidebar-dragging');
    (document.body as any).style.userSelect = '';
    // Persist position
    const left = parseFloat(sidebar.style.left || '20');
    const top = parseFloat(sidebar.style.top || '0');
    try { localStorage.setItem('cms-sidebar-pos', JSON.stringify({ left, top })); } catch {}
  };

  header.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', endDrag);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n' && !e.shiftKey) { e.preventDefault(); handleNew(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'L') { e.preventDefault(); handleList(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'F') { e.preventDefault(); handleFrontmatter(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); handleDelete(); }
  });

  // Add sidebar styles
  if (!document.querySelector('#cms-sidebar-styles')) {
    const style = document.createElement('style');
    style.id = 'cms-sidebar-styles';
    style.textContent = `
      :root { --cms-accent: #6366f1; }
      .cms-sidebar { position: fixed; left: 20px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 10px; min-width: 200px; z-index: 9998; padding: 14px; border-radius: 16px; background: rgba(255,255,255,0.75); border: 1px solid rgba(100,116,139,0.18); box-shadow: 0 12px 30px rgba(2,6,23,0.12); backdrop-filter: blur(12px) saturate(1.2); }
      @media (prefers-color-scheme: dark) { .cms-sidebar { background: rgba(15,23,42,0.55); border-color: rgba(148,163,184,0.18); box-shadow: 0 12px 34px rgba(0,0,0,0.45); } }
      .cms-sidebar:hover { box-shadow: 0 16px 36px rgba(2,6,23,0.16); }
      .cms-sidebar-header { display: flex; align-items: center; justify-content: space-between; cursor: grab; user-select: none; }
      .cms-sidebar-dragging .cms-sidebar-header { cursor: grabbing; }
      .cms-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; letter-spacing: .2px; }
      .cms-brand-dot { width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, var(--cms-accent), #22d3ee); box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }
      .cms-grip { font-size: 14px; color: #94a3b8; letter-spacing: 2px; }
      @media (prefers-color-scheme: dark) { .cms-grip { color: #64748b; } }
      .cms-sidebar-group { display: flex; flex-direction: column; gap: 8px; }
      .cms-sidebar-sep { height: 1px; background: linear-gradient(90deg, transparent, rgba(148,163,184,0.35), transparent); margin: 2px 2px 0; }
      .cms-sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; background: linear-gradient(180deg, rgba(241,245,249,0.8), rgba(241,245,249,0.6)); color: #0f172a; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform .08s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease; text-align: left; }
      .cms-sidebar-btn:hover { transform: translateY(-1px); background: linear-gradient(180deg, rgba(226,232,240,0.9), rgba(226,232,240,0.7)); border-color: rgba(99,102,241,0.35); box-shadow: 0 6px 14px rgba(2,6,23,0.06); }
      .cms-sidebar-btn:active { transform: translateY(0); }
      .cms-ico { display:inline-flex; align-items:center; justify-content:center; width: 22px; height: 22px; border-radius: 7px; background: linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.08)); color: var(--cms-accent); font-size: 12px; }
      @media (prefers-color-scheme: dark) { .cms-sidebar-btn { background: linear-gradient(180deg, rgba(30,41,59,0.9), rgba(30,41,59,0.7)); color: #e2e8f0; } .cms-sidebar-btn:hover { background: linear-gradient(180deg, rgba(51,65,85,0.95), rgba(30,41,59,0.8)); } }
      .cms-btn-danger { background: linear-gradient(180deg, rgba(254,226,226,0.9), rgba(254,226,226,0.7)) !important; color: #b91c1c; }
      .cms-btn-danger:hover { background: linear-gradient(180deg, rgba(254,202,202,0.95), rgba(254,202,202,0.8)) !important; border-color: rgba(239,68,68,0.35); }
      @media (prefers-color-scheme: dark) { .cms-btn-danger { background: linear-gradient(180deg, rgba(127,29,29,0.65), rgba(69,10,10,0.65)) !important; color: #fecaca; } }
      .cms-drag-over { border-color: var(--cms-accent) !important; background: rgba(99,102,241,0.08) !important; }
    `;
    document.head.appendChild(style);
  }
}
