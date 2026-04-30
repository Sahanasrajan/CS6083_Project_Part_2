// search.js — search messages across workspaces
const Search = (() => {
  function _renderResult(msg) {
    return `
      <div class="search-result">
        <div class="sr-meta">
          <span class="sr-channel">#${escapeHtml(msg.channel_name)}</span>
          <span class="sr-workspace">${escapeHtml(msg.workspace_name)}</span>
          <span class="sr-time">${new Date(msg.posted_time).toLocaleString()}</span>
        </div>
        <div class="sr-author">${escapeHtml(msg.nickname || msg.username)}</div>
        <div class="sr-text">${escapeHtml(msg.msg)}</div>
      </div>`;
  }

  async function doSearch() {
    const q    = document.getElementById('search-input').value.trim();
    const wID  = document.getElementById('search-workspace-filter').value;
    const resultsEl = document.getElementById('search-results');
    if (!q) return;

    resultsEl.innerHTML = '<div class="loading-text">Searching…</div>';
    try {
      let url = `/search?q=${encodeURIComponent(q)}`;
      if (wID) url += `&wID=${wID}`;
      const results = await API.get(url);
      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="empty-hint" style="padding:1.5rem;text-align:center">No results found.</div>';
      } else {
        resultsEl.innerHTML = results.map(_renderResult).join('');
      }
    } catch (err) {
      resultsEl.innerHTML = `<div class="error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  function init() {
    document.getElementById('search-btn').addEventListener('click', () => {
      document.getElementById('channel-view').classList.add('hidden');
      document.getElementById('welcome-pane').classList.add('hidden');
      document.getElementById('invitations-pane').classList.add('hidden');
      document.getElementById('search-pane').classList.remove('hidden');
      document.getElementById('search-input').focus();
    });

    document.getElementById('do-search-btn').addEventListener('click', doSearch);

    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });
  }

  return { init };
})();
