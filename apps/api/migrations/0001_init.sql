CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  active_version_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  status TEXT NOT NULL,
  price_from_cop INTEGER,
  area_min REAL,
  area_max REAL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  description TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE (tenant_id, slug)
);
CREATE TABLE project_photos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_slug TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT,
  is_test INTEGER NOT NULL DEFAULT 0,
  origin TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX leads_tenant_created ON leads (tenant_id, created_at DESC);
CREATE TABLE site_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  template TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('building', 'ready', 'failed')),
  reason TEXT NOT NULL,
  prompt_summary TEXT,
  build_log TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE integrations (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, provider)
);
CREATE TABLE domains (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  hostname TEXT NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (tenant_id, hostname)
);
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  role TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
