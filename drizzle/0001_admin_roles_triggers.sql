-- Append-only enforcement for the events table.
-- Application role baaki_app can INSERT and SELECT — never UPDATE or DELETE.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'baaki_app') THEN
    CREATE ROLE baaki_app NOLOGIN;
  END IF;
END $$;

-- The role was already created with LOGIN by docker/postgres/init.sql.
-- These grants add the table/sequence access it needs.
GRANT USAGE ON SCHEMA public TO baaki_app;
GRANT SELECT, INSERT ON events TO baaki_app;
GRANT USAGE, SELECT ON SEQUENCE events_seq_seq TO baaki_app;

-- Revoke anything the role may have inherited.
REVOKE UPDATE, DELETE, TRUNCATE ON events FROM baaki_app;

CREATE OR REPLACE FUNCTION forbid_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only; % is not allowed (seq=%)',
    TG_OP,
    COALESCE(OLD.seq, -1)
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS events_no_update ON events;
CREATE TRIGGER events_no_update
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION forbid_event_mutation();

DROP TRIGGER IF EXISTS events_no_delete ON events;
CREATE TRIGGER events_no_delete
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION forbid_event_mutation();
