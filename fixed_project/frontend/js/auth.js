// auth.js — handles login, register, logout, and session check
const Auth = (() => {
  let _currentUser = null;

  function getCurrentUser() { return _currentUser; }

  async function checkSession() {
    try {
      const data = await API.get('/auth/me');
      _currentUser = data.user;
      _updateSidebarUser();
      return true;
    } catch {
      return false;
    }
  }

  function _updateSidebarUser() {
    if (!_currentUser) return;
    const name = _currentUser.nickname || _currentUser.username;
    const el = document.getElementById('sidebar-username');
    const av = document.getElementById('user-avatar-initials');
    if (el) el.textContent = escapeHtml(name);
    if (av) av.textContent = name.charAt(0).toUpperCase();
  }

  function init() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-form').classList.add('active');
      });
    });

    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('login-error');
      errEl.classList.add('hidden');
      try {
        const data = await API.post('/auth/login', {
          email: document.getElementById('login-email').value,
          password: document.getElementById('login-password').value
        });
        _currentUser = data.user;
        _updateSidebarUser();
        App.showApp();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });

    // Register
    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('register-error');
      errEl.classList.add('hidden');
      try {
        const data = await API.post('/auth/register', {
          email: document.getElementById('reg-email').value,
          username: document.getElementById('reg-username').value,
          nickname: document.getElementById('reg-nickname').value || undefined,
          password: document.getElementById('reg-password').value
        });
        _currentUser = data.user;
        _updateSidebarUser();
        App.showApp();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try { await API.post('/auth/logout'); } catch {}
      _currentUser = null;
      App.showAuth();
    });
  }

  return { init, checkSession, getCurrentUser };
})();
