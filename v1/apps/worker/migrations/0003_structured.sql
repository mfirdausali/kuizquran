-- v0.9 hydrate: persist the `structured` flag so server→client pull can restore
-- it faithfully. Free-play (Open practice) events carry structured=0 and must
-- stay evidence-only (invariant #4/#5); structured-session events carry 1.
-- Existing rows predate this column → structured IS NULL, which the client and
-- engine treat as the default (structured = true, i.e. NOT free-play). Only the
-- flag for events uploaded before this migration is unrecoverable; all new
-- events carry the true value.
ALTER TABLE events ADD COLUMN structured INTEGER; -- 0 = free-play, 1 = structured, NULL = legacy (default structured)
