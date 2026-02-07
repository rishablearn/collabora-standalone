-- Initialize Collabora Standalone Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    storage_quota BIGINT DEFAULT 5368709120, -- 5GB default
    storage_used BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Folders table (must be created before files table)
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id, name, parent_id)
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    size BIGINT NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT false,
    parent_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- File versions table for version history
CREATE TABLE IF NOT EXISTS file_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    size BIGINT NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, version)
);

-- File locks table for WOPI locking
CREATE TABLE IF NOT EXISTS file_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID UNIQUE NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    lock_id VARCHAR(255) NOT NULL,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- File shares table for sharing capabilities
CREATE TABLE IF NOT EXISTS file_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id),
    shared_with UUID REFERENCES users(id),
    share_token VARCHAR(255) UNIQUE,
    permission VARCHAR(50) DEFAULT 'view', -- view, edit, comment
    password_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (file_id IS NOT NULL OR folder_id IS NOT NULL)
);

-- Active sessions table
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_parent_folder ON files(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_file ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_file ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- Create default admin user (password: admin123 - CHANGE IN PRODUCTION!)
-- Hash generated with bcrypt, cost factor 12
INSERT INTO users (email, username, password_hash, display_name, role) 
VALUES (
    'admin@localhost',
    'admin',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYR0YV1aQPYG',
    'Administrator',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_folders_updated_at ON folders;
CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
