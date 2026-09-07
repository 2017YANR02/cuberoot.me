ALTER TABLE drive_nodes ADD COLUMN member_shared BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE drive_nodes ADD CONSTRAINT drive_member_shared_folder CHECK (NOT member_shared OR kind = 'folder');
