-- Snickr Database Schema and Seed Data
-- Project 1 & 2 - CSGY 6083 Spring 2026
-- Sarah Rakhamimov (sr5649) & Kanthimathi Sundararajan (ks8555)

-- Drop tables if they exist (for re-runs)
DROP TABLE IF EXISTS ChannelInvitation CASCADE;
DROP TABLE IF EXISTS WorkspaceInvitation CASCADE;
DROP TABLE IF EXISTS Message CASCADE;
DROP TABLE IF EXISTS ChannelMember CASCADE;
DROP TABLE IF EXISTS Channel CASCADE;
DROP TABLE IF EXISTS WorkspaceMember CASCADE;
DROP TABLE IF EXISTS Workspace CASCADE;
DROP TABLE IF EXISTS Member CASCADE;

-- ============================================================
-- SCHEMA
-- ============================================================

CREATE TABLE Member (
  mID SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Workspace (
  wID SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  creator_mID INTEGER NOT NULL,
  created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_mID) REFERENCES Member(mID) ON DELETE CASCADE
);

CREATE TABLE WorkspaceMember (
  wID INTEGER NOT NULL,
  mID INTEGER NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wID, mID),
  FOREIGN KEY (wID) REFERENCES Workspace(wID) ON DELETE CASCADE,
  FOREIGN KEY (mID) REFERENCES Member(mID) ON DELETE CASCADE
);

CREATE TABLE Channel (
  cID SERIAL PRIMARY KEY,
  wID INTEGER NOT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL,
  creator_mID INTEGER NOT NULL,
  created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wID) REFERENCES Workspace(wID) ON DELETE CASCADE,
  FOREIGN KEY (creator_mID) REFERENCES Member(mID) ON DELETE CASCADE,
  CHECK (type IN ('public', 'private', 'direct'))
);

CREATE TABLE ChannelMember (
  cID INTEGER NOT NULL,
  mID INTEGER NOT NULL,
  joined_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cID, mID),
  FOREIGN KEY (cID) REFERENCES Channel(cID) ON DELETE CASCADE,
  FOREIGN KEY (mID) REFERENCES Member(mID) ON DELETE CASCADE
);

CREATE TABLE Message (
  msgID SERIAL PRIMARY KEY,
  cID INTEGER NOT NULL,
  mID INTEGER NOT NULL,
  msg TEXT NOT NULL,
  posted_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cID) REFERENCES Channel(cID) ON DELETE CASCADE,
  FOREIGN KEY (mID) REFERENCES Member(mID) ON DELETE CASCADE
);

CREATE TABLE WorkspaceInvitation (
  wiID SERIAL PRIMARY KEY,
  wID INTEGER NOT NULL,
  invited_mID INTEGER NOT NULL,
  by_mID INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  invited_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wID) REFERENCES Workspace(wID) ON DELETE CASCADE,
  FOREIGN KEY (invited_mID) REFERENCES Member(mID) ON DELETE CASCADE,
  FOREIGN KEY (by_mID) REFERENCES Member(mID) ON DELETE CASCADE,
  CHECK (status IN ('pending', 'accepted', 'rejected'))
);

CREATE TABLE ChannelInvitation (
  ciID SERIAL PRIMARY KEY,
  cID INTEGER NOT NULL,
  invited_mID INTEGER NOT NULL,
  by_mID INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  invited_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cID) REFERENCES Channel(cID) ON DELETE CASCADE,
  FOREIGN KEY (invited_mID) REFERENCES Member(mID) ON DELETE CASCADE,
  FOREIGN KEY (by_mID) REFERENCES Member(mID) ON DELETE CASCADE,
  CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_message_cid ON Message(cID);
CREATE INDEX idx_message_mid ON Message(mID);
CREATE INDEX idx_message_posted ON Message(posted_time DESC);
CREATE INDEX idx_channel_wid ON Channel(wID);
CREATE INDEX idx_workspacemember_mid ON WorkspaceMember(mID);
CREATE INDEX idx_channelmember_mid ON ChannelMember(mID);

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

-- Accept workspace invitation and add member
CREATE OR REPLACE FUNCTION accept_workspace_invitation(p_wiID INTEGER, p_mID INTEGER)
RETURNS VOID AS $$
DECLARE
  v_wID INTEGER;
BEGIN
  SELECT wID INTO v_wID FROM WorkspaceInvitation
  WHERE wiID = p_wiID AND invited_mID = p_mID AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;

  UPDATE WorkspaceInvitation SET status = 'accepted' WHERE wiID = p_wiID;

  INSERT INTO WorkspaceMember (wID, mID, is_admin)
  VALUES (v_wID, p_mID, FALSE)
  ON CONFLICT (wID, mID) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Accept channel invitation and add member
CREATE OR REPLACE FUNCTION accept_channel_invitation(p_ciID INTEGER, p_mID INTEGER)
RETURNS VOID AS $$
DECLARE
  v_cID INTEGER;
BEGIN
  SELECT cID INTO v_cID FROM ChannelInvitation
  WHERE ciID = p_ciID AND invited_mID = p_mID AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;

  UPDATE ChannelInvitation SET status = 'accepted' WHERE ciID = p_ciID;

  INSERT INTO ChannelMember (cID, mID)
  VALUES (v_cID, p_mID)
  ON CONFLICT (cID, mID) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DATA (from Project 1 submission)
-- ============================================================

-- Members (passwords are bcrypt hashes of 'password123')
INSERT INTO Member (email, username, nickname, password_hash) VALUES
('alice@abc.com',  'alice',  'CEO',             '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
('bob@abc.com',    'bob',    'CFO',             '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
('cathy@abc.com',  'cathy',  'Product Manager', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
('daniel@abc.com', 'daniel', 'SysAdmin',        '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
('ethan@abc.com',  'ethan',  'Data Engineer',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
('frank@abc.com',  'frank',  'Sales Manager',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
('greg@abc.com',   'greg',   'Chairman',        '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- Workspaces
INSERT INTO Workspace (name, description, creator_mID) VALUES
('ABC_Company', 'General company workspace for all employees', 4),
('ABC_CSuite',  'Executive C-Suite workspace',                 1);

-- WorkspaceMembers
-- ABC_Company (all members, alice & daniel are admins)
INSERT INTO WorkspaceMember (wID, mID, is_admin) VALUES
(1, 1, TRUE),  -- Alice CEO (admin)
(1, 2, FALSE), -- Bob CFO
(1, 3, FALSE), -- Cathy PM
(1, 4, TRUE),  -- Daniel SysAdmin (admin)
(1, 5, FALSE), -- Ethan Data Eng
(1, 6, FALSE), -- Frank Sales
(1, 7, FALSE); -- Greg Chairman

-- ABC_CSuite (Greg Chairman admin, Alice CEO admin, Bob CFO)
INSERT INTO WorkspaceMember (wID, mID, is_admin) VALUES
(2, 7, TRUE),  -- Greg Chairman (admin)
(2, 1, TRUE),  -- Alice CEO (admin)
(2, 2, FALSE); -- Bob CFO

-- Channels
INSERT INTO Channel (wID, name, type, creator_mID) VALUES
(1, 'ABC',          'public',  4), -- cID 1
(1, 'Security',     'private', 4), -- cID 2
(1, 'Analytics',    'private', 3), -- cID 3
(1, 'Onboarding',   'private', 4), -- cID 4
(2, 'Revenue',      'private', 7), -- cID 5
(2, 'BoardPrep',    'private', 7), -- cID 6
(1, 'Sales',        'private', 1), -- cID 7
(2, 'DM_CEO_CFO',   'direct',  1), -- cID 8
(1, 'DM_Team_Data', 'direct',  4); -- cID 9

-- ChannelMembers
-- ABC (everyone in company)
INSERT INTO ChannelMember (cID, mID) VALUES (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7);
-- Security (CSuite + SysAdmin)
INSERT INTO ChannelMember (cID, mID) VALUES (2,1),(2,2),(2,4),(2,7);
-- Analytics (CEO, PM, Data Engineer)
INSERT INTO ChannelMember (cID, mID) VALUES (3,1),(3,3),(3,5);
-- Onboarding (CFO & SysAdmin)
INSERT INTO ChannelMember (cID, mID) VALUES (4,2),(4,4);
-- Revenue (CSuite only)
INSERT INTO ChannelMember (cID, mID) VALUES (5,7),(5,1),(5,2);
-- BoardPrep (CSuite only)
INSERT INTO ChannelMember (cID, mID) VALUES (6,7),(6,1),(6,2);
-- Sales (CEO, CFO, Sales Manager)
INSERT INTO ChannelMember (cID, mID) VALUES (7,1),(7,2),(7,6);
-- DM CEO/CFO
INSERT INTO ChannelMember (cID, mID) VALUES (8,1),(8,2);
-- DM SysAdmin/Data/PM
INSERT INTO ChannelMember (cID, mID) VALUES (9,4),(9,5),(9,3);

-- Messages
INSERT INTO Message (cID, mID, msg, posted_time) VALUES
(1, 1, 'Welcome to ABC', NOW() - INTERVAL '10 days'),
(1, 2, 'Budget approved for 2026', NOW() - INTERVAL '9 days'),
(3, 5, 'Matrix model used in data pipeline', NOW() - INTERVAL '6 days'),
(3, 3, 'Product insights are aligned with data trends', NOW() - INTERVAL '5 days'),
(3, 5, 'We should analyze perpendicular coefficients in the cost model', NOW() - INTERVAL '4 days'),
(2, 4, 'Pen test completed successfully', NOW() - INTERVAL '4 days'),
(7, 6, 'Sales strategy updated for new quarter', NOW() - INTERVAL '3 days'),
(7, 1, 'Perpendicular growth observed in regional sales performance last year', NOW() - INTERVAL '2 days'),
(8, 1, 'Let''s review financial projections', NOW() - INTERVAL '2 days'),
(8, 2, 'OK. We can review next week', NOW() - INTERVAL '1 day'),
(9, 4, 'System performance metrics look stable', NOW() - INTERVAL '2 days'),
(9, 5, 'Data pipeline includes platform scalability', NOW() - INTERVAL '1 day'),
(9, 3, 'Product model depends on data pipeline output', NOW() - INTERVAL '1 day');

-- WorkspaceInvitations
INSERT INTO WorkspaceInvitation (wID, invited_mID, by_mID, status, invited_time) VALUES
(2, 2, 7, 'accepted', NOW() - INTERVAL '12 days'), -- Bob invited to CSuite by Greg
(1, 6, 4, 'accepted', NOW() - INTERVAL '15 days'), -- Frank invited to ABC_Company by Daniel
(1, 5, 4, 'pending',  NOW() - INTERVAL '8 days');  -- Ethan pending to ABC_Company

-- ChannelInvitations
INSERT INTO ChannelInvitation (cID, invited_mID, by_mID, status, invited_time) VALUES
(1, 5, 4, 'pending',  NOW() - INTERVAL '8 days'),  -- Ethan invited to ABC by SysAdmin
(2, 5, 4, 'pending',  NOW() - INTERVAL '7 days'),  -- Ethan invited to Security by SysAdmin
(3, 4, 3, 'accepted', NOW() - INTERVAL '10 days'), -- Daniel accepted in Analytics by PM
(7, 6, 1, 'pending',  NOW() - INTERVAL '2 days'),  -- Frank pending in Sales by CEO
(6, 1, 7, 'accepted', NOW() - INTERVAL '9 days');  -- CEO invited to BoardPrep by Chairman
