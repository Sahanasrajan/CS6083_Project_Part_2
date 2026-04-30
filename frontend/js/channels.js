// channels.js — channel list, creation, joining, and selection
const Channels = (() => {
  let _currentCID = null;

  function getCurrent() { return _currentCID; }

  async function loadForWorkspace(wID) {
    const list = document.getElementById('channel-list');
    list.innerHTML = '<div class="loading-text">Loading…</div>';
    try {
      const channels = await API.get(`/channels/workspace/${wID}`);
      list.innerHTML = '';
      if (channels.length === 0) {
        list.innerHTML = '<div class="empty-hint">No channels yet.</div>';
        return;
      }
      channels.forEach(ch => {
        const item = document.createElement('div');
        item.className = 'channel-item' + (ch.cid === _currentCID ? ' active' : '');
        item.dataset.cid = ch.cid;
        const icon = ch.type === 'public' ? '#' : ch.type === 'private' ? '🔒' : '💬';
        item.innerHTML = `
          <span class="ch-icon">${icon}</span>
          <span class="ch-name">${escapeHtml(ch.name)}</span>
          ${!ch.is_member ? '<span class="ch-join-hint">join</span>' : ''}`;
        item.addEventListener('click', () => selectChannel(ch));
        list.appendChild(item);
      });
    } catch (err) {
      list.innerHTML = `<div class="error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  async function selectChannel(ch) {
    // If not a member of a public channel, join first
    if (!ch.is_member && ch.type === 'public') {
      try {
        await API.post(`/channels/${ch.cid}/join`);
        ch.is_member = true;
      } catch (err) {
        alert('Could not join channel: ' + err.message);
        return;
      }
    } else if (!ch.is_member) {
      alert('You are not a member of this channel.');
      return;
    }

    _currentCID = ch.cid;
    document.querySelectorAll('.channel-item').forEach(el => {
      el.classList.toggle('active', el.dataset.cid == ch.cid);
    });

    // Update topbar
    const icon = ch.type === 'public' ? '#' : ch.type === 'private' ? '🔒' : '💬';
    document.getElementById('topbar-channel-icon').textContent = icon;
    document.getElementById('topbar-channel-name').textContent = ch.name;
    document.getElementById('topbar-channel-type').textContent = ch.type + ' channel';

    document.getElementById('welcome-pane').classList.add('hidden');
    document.getElementById('channel-view').classList.remove('hidden');

    Messages.loadForChannel(ch.cid, ch.name);
  }

  function init() {
    document.getElementById('new-channel-btn').addEventListener('click', () => {
      if (!Workspaces.getCurrent()) return alert('Select a workspace first.');
      document.getElementById('modal-new-channel').classList.remove('hidden');
    });

    document.getElementById('form-new-channel').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('ch-error');
      errEl.classList.add('hidden');
      const ws = Workspaces.getCurrent();
      if (!ws) return;
      try {
        await API.post('/channels', {
          wID: ws.wid,
          name: document.getElementById('ch-name').value,
          type: document.getElementById('ch-type').value
        });
        closeModal('modal-new-channel');
        document.getElementById('ch-name').value = '';
        await loadForWorkspace(ws.wid);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });

    // Channel members button
    document.getElementById('channel-members-btn').addEventListener('click', async () => {
      if (!_currentCID) return;
      try {
        const data = await API.get(`/channels/${_currentCID}`);
        const titleEl = document.getElementById('modal-members-title');
        const listEl  = document.getElementById('modal-members-list');
        titleEl.textContent = `Members – #${data.channel.name}`;
        listEl.innerHTML = data.members.map(m => `
          <div class="member-item">
            <div class="member-avatar">${escapeHtml((m.nickname || m.username).charAt(0).toUpperCase())}</div>
            <div>
              <div class="member-name">${escapeHtml(m.nickname || m.username)}</div>
              <div class="member-handle">@${escapeHtml(m.username)}</div>
            </div>
          </div>`).join('');
        document.getElementById('modal-members').classList.remove('hidden');
      } catch (err) {
        alert(err.message);
      }
    });

    // Invite to channel button
    document.getElementById('invite-to-channel-btn').addEventListener('click', () => {
      if (!_currentCID) return;
      document.getElementById('modal-invite-ch').classList.remove('hidden');
    });
  }

  return { init, loadForWorkspace, getCurrent };
})();
