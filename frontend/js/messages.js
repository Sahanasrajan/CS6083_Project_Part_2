// messages.js — load and send messages
const Messages = (() => {
  let _currentCID = null;
  let _polling = null;

  function _formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function _renderMessage(msg) {
    const name = msg.username;
    return `
      <div class="message" data-msgid="${msg.msgid}">
        <div class="msg-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
        <div class="msg-body">
          <div class="msg-meta">
            <span class="msg-author">${escapeHtml(name)}</span>
            <span class="msg-time">${_formatTime(msg.posted_time)}</span>
          </div>
          <div class="msg-text">${escapeHtml(msg.msg)}</div>
        </div>
      </div>`;
  }

  async function loadForChannel(cID, channelName) {
    _currentCID = cID;
    if (_polling) { clearInterval(_polling); _polling = null; }

    const area = document.getElementById('messages-area');
    const loading = document.getElementById('messages-loading');
    area.innerHTML = '';
    area.appendChild(loading);
    loading.classList.remove('hidden');
    loading.textContent = 'Loading messages…';

    // Update placeholder
    document.getElementById('message-input').placeholder = `Message #${channelName}`;

    try {
      const messages = await API.get(`/messages/${cID}?limit=100`);
      loading.classList.add('hidden');
      if (messages.length === 0) {
        area.innerHTML = '<div class="empty-hint" style="padding:2rem;text-align:center">No messages yet. Be the first!</div>';
      } else {
        area.innerHTML = messages.map(_renderMessage).join('');
      }
      area.scrollTop = area.scrollHeight;
    } catch (err) {
      loading.textContent = 'Failed to load messages: ' + err.message;
    }

    // Poll for new messages every 5 seconds
    _polling = setInterval(async () => {
      if (_currentCID !== cID) return;
      const msgs = await API.get(`/messages/${cID}?limit=100`).catch(() => null);
      if (!msgs) return;
      const existing = area.querySelectorAll('.message').length;
      if (msgs.length > existing) {
        const newMsgs = msgs.slice(existing);
        const atBottom = area.scrollHeight - area.scrollTop <= area.clientHeight + 80;
        newMsgs.forEach(m => { area.insertAdjacentHTML('beforeend', _renderMessage(m)); });
        if (atBottom) area.scrollTop = area.scrollHeight;
      }
    }, 5000);
  }

  async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !_currentCID) return;
    input.value = '';
    input.style.height = 'auto';

    try {
      const msg = await API.post(`/messages/${_currentCID}`, { msg: text });
      const area = document.getElementById('messages-area');
      // Remove empty hint if present
      const hint = area.querySelector('.empty-hint');
      if (hint) hint.remove();
      area.insertAdjacentHTML('beforeend', _renderMessage(msg));
      area.scrollTop = area.scrollHeight;
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    }
  }

  function init() {
    const input = document.getElementById('message-input');
    const btn   = document.getElementById('send-btn');

    btn.addEventListener('click', sendMessage);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-grow textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    });
  }

  return { init, loadForChannel };
})();
