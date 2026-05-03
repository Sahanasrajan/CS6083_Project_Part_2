# Snickr 🟦

> Enterprise communication platform — CSGY 6083 Spring 2026, Project #2  
> **Sarah Rakhamimov (sr5649) & Kanthimathi Sundararajan (ks8555)**

A Slack-like web application backed by a PostgreSQL relational database.  
Users can register, create workspaces and channels, post messages, send and respond to invitations, and search message history.

---

## Architecture

```
snickr/
├── backend/                  # Node.js + Express REST API
│   ├── server.js             # Entry point
│   ├── db/
│   │   ├── pool.js           # pg connection pool
│   │   └── schema.sql        # Full schema + seed data
│   ├── middleware/
│   │   └── auth.js           # Session auth guard
│   └── routes/
│       ├── auth.js           # /api/auth/*
│       ├── workspaces.js     # /api/workspaces/*
│       ├── channels.js       # /api/channels/*
│       ├── messages.js       # /api/messages/*
│       ├── invitations.js    # /api/invitations/*
│       └── search.js         # /api/search
└── frontend/                 # Vanilla JS SPA (served by Express)
    ├── index.html
    ├── css/main.css
    └── js/
        ├── api.js            # Fetch wrapper
        ├── app.js            # Bootstrap + utilities
        ├── auth.js
        ├── workspaces.js
        ├── channels.js
        ├── messages.js
        ├── invitations.js
        └── search.js
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) v14+

---

## Setup

### 1. Clone & install dependencies

```bash
git clone <your-repo-url>
cd snickr/backend
npm install
```

### 2. Create the database

```bash
psql postgres -c "DROP DATABASE snickr;"
psql postgres -c "CREATE DATABASE snickr;"
psql -d snickr -f db/schema.sql
```

### 3. Configure environment

```bash
# Edit .env with your DB credentials and a session secret
```

### 4. Run the server

```bash
npm run dev     # development (nodemon auto-reload)
# or
npm start       # production
```

Open **http://localhost:3000** in your browser.

---

## Demo Accounts

All demo users have the password: **`password123`**

| Username | Email | Role |
|----------|-------|------|
| alice | alice@abc.com | CEO, admin of both workspaces |
| bob | bob@abc.com | CFO |
| cathy | cathy@abc.com | Product Manager |
| daniel | daniel@abc.com | SysAdmin, admin of ABC_Company |
| ethan | ethan@abc.com | Data Engineer |
| frank | frank@abc.com | Sales Manager |
| greg | greg@abc.com | Chairman, admin of ABC_CSuite |

---

## Features

| Feature | Status |
|---------|--------|
| User registration & login | ✅ |
| Password hashing (bcrypt) | ✅ |
| Session-based authentication | ✅ |
| Create / browse workspaces | ✅ |
| Create channels (public / private / direct) | ✅ |
| Post & view messages | ✅ |
| Invite users to workspaces | ✅ |
| Invite users to channels | ✅ |
| Accept / reject invitations | ✅ |
| Search messages (keyword + workspace filter) | ✅ |
| SQL injection prevention (parameterized queries) | ✅ |
| XSS prevention (input validation + HTML escaping) | ✅ |
| Transactions (workspace/channel creation + invitation acceptance) | ✅ |
| Stored procedures (accept_workspace_invitation, accept_channel_invitation) | ✅ |
| Access control (workspace/channel membership checks) | ✅ |

---

## Security

### SQL Injection
All database queries use **parameterized statements** via the `pg` library's `$1, $2, …` placeholders. No string concatenation is used for queries.  Input is additionally validated with `express-validator` before reaching the DB layer.

### Cross-Site Scripting (XSS)
- Server: `express-validator` sanitizes and escapes all user inputs before they're stored.
- Client: all user-generated content is rendered through the `escapeHtml()` utility, which escapes `&`, `<`, `>`, `"`, and `'` before insertion into the DOM.

### Concurrency / Transactions
Multi-step operations (creating a workspace and auto-enrolling the creator, accepting an invitation and adding the member) are wrapped in explicit `BEGIN / COMMIT / ROLLBACK` transactions to ensure consistency under concurrent usage.

---

## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current session user |

### Workspaces
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workspaces` | List user's workspaces |
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces/:wID` | Workspace details + members |

### Channels
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/channels/workspace/:wID` | List accessible channels |
| POST | `/api/channels` | Create channel |
| GET | `/api/channels/:cID` | Channel details + members |
| POST | `/api/channels/:cID/join` | Join a public channel |

### Messages
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/messages/:cID` | Get messages (paginated) |
| POST | `/api/messages/:cID` | Post a message |

### Invitations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/invitations/pending` | Get pending invitations |
| POST | `/api/invitations/workspace` | Invite user to workspace |
| POST | `/api/invitations/channel` | Invite user to channel |
| POST | `/api/invitations/workspace/:wiID/respond` | Accept/reject workspace invite |
| POST | `/api/invitations/channel/:ciID/respond` | Accept/reject channel invite |

### Search
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q=keyword&wID=1` | Search messages |

---

## Database Schema

See `backend/db/schema.sql` for the full DDL, stored procedures, indexes, and seed data.

Key tables: `Member`, `Workspace`, `WorkspaceMember`, `Channel`, `ChannelMember`, `Message`, `WorkspaceInvitation`, `ChannelInvitation`

---

## License

Academic project — CSGY 6083 NYU, Spring 2026.
