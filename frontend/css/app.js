// app.js — bootstraps the SPA

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  // Clear errors inside
  document.querySelectorAll(`#${id} .form-error`).forEach(el => el.classList.add('hidden'));
}

const App = (() => {
  function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
  }

  function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    Workspaces.load();
    Invitations.startPolling();
    // Check for pending invites on load
    setTimeout(async () => {
      try {
        const { workspace, channel } = await API.get('/invitations/pending');
        const count = workspace.length + channel.length;
        if (count > 0) {
          const badge = document.getElementById('invite-badge');
          badge.textContent = count;
          badge.classList.remove('hidden');
        }
      } catch {}
    }, 500);
  }

  function initModals() {
    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

    // Close modal on X button
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        if (overlay) closeModal(overlay.id);
      });
    });
  }

  async function init() {
    initModals();
    Auth.init();
    Workspaces.init();
    Channels.init();
    Messages.init();
    Invitations.init();
    Search.init();

    const loggedIn = await Auth.checkSession();
    if (loggedIn) {
      showApp();
    } else {
      showAuth();
    }
  }

  return { init, showAuth, showApp };
})();

document.addEventListener('DOMContentLoaded', App.init);
