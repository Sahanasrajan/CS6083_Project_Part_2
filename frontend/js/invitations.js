// invitations.js — view and respond to pending invitations
const Invitations = (() => {
  let _pollTimer = null;

  function _setBadge(count) {
    const badge = document.getElementById('invite-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  async function load() {
    const content = document.getElementById('invitations-content');
    content.innerHTML = '<div class="loading-text">Loading…</div>';
    try {
      const { workspace, channel } = await API.get('/invitations/pending');
      _setBadge(workspace.length + channel.length);
      content.innerHTML = '';

      if (workspace.length === 0 && channel.length === 0) {
        content.innerHTML = '<div class="empty-hint" style="padding:2rem;text-align:center">No pending invitations.</div>';
        return;
      }

      if (workspace.length > 0) {
        content.insertAdjacentHTML('beforeend', '<h3 class="inv-section-title">Workspace Invitations</h3>');
        workspace.forEach(inv => {
          content.insertAdjacentHTML('beforeend', `
            <div class="invite-card" id="ws-inv-${inv.wiid}">
              <div class="invite-info">
                <strong>${escapeHtml(inv.workspace_name)}</strong>
                <div class="invite-meta">Invited by <em>${escapeHtml(inv.invited_by)}</em></div>
              </div>
              <div class="invite-actions">
                <button class="btn-primary btn-sm" onclick="Invitations.respondWs(${inv.wiid},'accepted')">Accept</button>
                <button class="btn-ghost btn-sm"  onclick="Invitations.respondWs(${inv.wiid},'rejected')">Decline</button>
              </div>
            </div>`);
        });
      }

      if (channel.length > 0) {
        content.insertAdjacentHTML('beforeend', '<h3 class="inv-section-title">Channel Invitations</h3>');
        channel.forEach(inv => {
          content.insertAdjacentHTML('beforeend', `
            <div class="invite-card" id="ch-inv-${inv.ciid}">
              <div class="invite-info">
                <strong>#${escapeHtml(inv.channel_name)}</strong>
                <div class="invite-meta">in ${escapeHtml(inv.workspace_name)} · Invited by <em>${escapeHtml(inv.invited_by)}</em></div>
              </div>
              <div class="invite-actions">
                <button class="btn-primary btn-sm" onclick="Invitations.respondCh(${inv.ciid},'accepted')">Accept</button>
                <button class="btn-ghost btn-sm"  onclick="Invitations.respondCh(${inv.ciid},'rejected')">Decline</button>
              </div>
            </div>`);
        });
      }
    } catch (err) {
      content.innerHTML = `<div class="error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  async function respondWs(wiID, action) {
    try {
      await API.post(`/invitations/workspace/${wiID}/respond`, { action });
      document.getElementById(`ws-inv-${wiID}`)?.remove();
      if (action === 'accepted') Workspaces.load();
      load(); // refresh badge
    } catch (err) { alert(err.message); }
  }

  async function respondCh(ciID, action) {
    try {
      await API.post(`/invitations/channel/${ciID}/respond`, { action });
      document.getElementById(`ch-inv-${ciID}`)?.remove();
      if (action === 'accepted') {
        const ws = Workspaces.getCurrent();
        if (ws) Channels.loadForWorkspace(ws.wid);
      }
      load();
    } catch (err) { alert(err.message); }
  }

  function startPolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(async () => {
      try {
        const { workspace, channel } = await API.get('/invitations/pending');
        _setBadge(workspace.length + channel.length);
      } catch {}
    }, 30000);
  }

  function init() {
    document.getElementById('invitations-btn').addEventListener('click', () => {
      document.getElementById('channel-view').classList.add('hidden');
      document.getElementById('welcome-pane').classList.add('hidden');
      document.getElementById('search-pane').classList.add('hidden');
      document.getElementById('invitations-pane').classList.remove('hidden');
      load();
    });

   document.getElementById('invite-to-workspace-btn')
  .addEventListener('click', () => {
    const ws = Workspaces.getCurrent();
    if (!ws) return alert('Select a workspace first.');

    document.getElementById('modal-invite-ws').classList.remove('hidden');
   });

    // Invite to workspace form
    document.getElementById('form-invite-ws').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('invite-ws-error');
      const sucEl = document.getElementById('invite-ws-success');
      errEl.classList.add('hidden'); sucEl.classList.add('hidden');
      const ws = Workspaces.getCurrent();
      if (!ws) { errEl.textContent = 'Select a workspace first.'; errEl.classList.remove('hidden'); return; }
      try {
        await API.post('/invitations/workspace', {
          wID: ws.wid,
          invitedEmail: document.getElementById('invite-ws-email').value
        });
        sucEl.textContent = 'Invitation sent!';
        sucEl.classList.remove('hidden');
        document.getElementById('invite-ws-email').value = '';
        setTimeout(() => closeModal('modal-invite-ws'), 1500);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });

    // Invite to channel form
    document.getElementById('form-invite-ch').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('invite-ch-error');
      const sucEl = document.getElementById('invite-ch-success');
      errEl.classList.add('hidden'); sucEl.classList.add('hidden');
      const cID = Channels.getCurrent();
      if (!cID) { errEl.textContent = 'Select a channel first.'; errEl.classList.remove('hidden'); return; }
      try {
        await API.post('/invitations/channel', {
          cID,
          invitedEmail: document.getElementById('invite-ch-email').value
        });
        sucEl.textContent = 'Invitation sent!';
        sucEl.classList.remove('hidden');
        document.getElementById('invite-ch-email').value = '';
        setTimeout(() => closeModal('modal-invite-ch'), 1500);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });
  }

  return { init, load, respondWs, respondCh, startPolling };
})();
