// workspaces.js — workspace list, creation, and selection
const Workspaces = (() => {
  let _current = null;

  function getCurrent() { return _current; }

  async function load() {
    const list = document.getElementById('workspace-list');
    list.innerHTML = '<div class="loading-text">Loading…</div>';
    try {
      const workspaces = await API.get('/workspaces');
      list.innerHTML = '';
      if (workspaces.length === 0) {
        list.innerHTML = '<div class="empty-hint">No workspaces yet.</div>';
        return;
      }
      workspaces.forEach(ws => {
        const item = document.createElement('div');
        item.className = 'workspace-item' + (_current && _current.wid === ws.wid ? ' active' : '');
        item.dataset.wid = ws.wid;
        item.innerHTML = `
          <div class="ws-avatar">${escapeHtml(ws.name.charAt(0).toUpperCase())}</div>
          <div class="ws-info">
            <div class="ws-name">${escapeHtml(ws.name)}</div>
            ${ws.is_admin ? '<div class="ws-role">admin</div>' : ''}
          </div>`;
        item.addEventListener('click', () => selectWorkspace(ws));
        list.appendChild(item);
      });

      // Populate search workspace filter
      const filter = document.getElementById('search-workspace-filter');
      if (filter) {
        filter.innerHTML = '<option value="">All Workspaces</option>';
        workspaces.forEach(ws => {
          const opt = document.createElement('option');
          opt.value = ws.wid;
          opt.textContent = ws.name;
          filter.appendChild(opt);
        });
      }
    } catch (err) {
      list.innerHTML = `<div class="error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  function selectWorkspace(ws) {
    _current = ws;
    document.querySelectorAll('.workspace-item').forEach(el => {
      el.classList.toggle('active', el.dataset.wid == ws.wid);
    });
    document.getElementById('channel-section').style.display = '';
    document.getElementById('channel-section-title').textContent = escapeHtml(ws.name);
    Channels.loadForWorkspace(ws.wid);
    // Reset message area
    document.getElementById('channel-view').classList.add('hidden');
    document.getElementById('welcome-pane').classList.remove('hidden');
  }

  function init() {
    // New workspace button
    document.getElementById('new-workspace-btn').addEventListener('click', () => {
      document.getElementById('modal-new-workspace').classList.remove('hidden');
    });

    document.getElementById('form-new-workspace').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('ws-error');
      errEl.classList.add('hidden');
      try {
        await API.post('/workspaces', {
          name: document.getElementById('ws-name').value,
          description: document.getElementById('ws-desc').value || undefined
        });
        closeModal('modal-new-workspace');
        document.getElementById('ws-name').value = '';
        document.getElementById('ws-desc').value = '';
        await load();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });
  }

  return { init, load, getCurrent, selectWorkspace };
})();
