-- Grant baaki_app access to every non-events table.
-- events stays SELECT + INSERT only (enforced again below).

GRANT SELECT, INSERT, UPDATE, DELETE ON
  users,
  businesses,
  business_members,
  customers,
  invoices,
  invoice_items,
  expenses,
  payments,
  inbox_items,
  otp_challenges,
  sessions,
  reminder_log,
  evidence_files,
  audit_admin
TO baaki_app;

-- Sequences for serial columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO baaki_app;

-- Reaffirm events constraint (belt and braces; 0001 already sets this)
GRANT SELECT, INSERT ON events TO baaki_app;
REVOKE UPDATE, DELETE, TRUNCATE ON events FROM baaki_app;
