-- Provision baaki_app access to the full schema.
-- Runs once per fresh DB. Idempotent (CREATE ROLE already exists from 0001,
-- so grants are the only real work here).

GRANT USAGE ON SCHEMA public TO baaki_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO baaki_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO baaki_app;

-- events stays append-only: revoke UPDATE/DELETE, keep SELECT/INSERT
REVOKE UPDATE, DELETE ON events FROM baaki_app;
GRANT SELECT, INSERT ON events TO baaki_app;

-- Future tables created by the postgres owner inherit these grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO baaki_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO baaki_app;
