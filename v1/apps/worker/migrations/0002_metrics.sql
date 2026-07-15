-- v0.6 metric instrumentation.
-- events: tap latency (time-per-word) + interruption resume classification.
-- users: the daily-anchor hour (anchor adherence); defaults to the secular
-- day-rollover hour (~04:30) until FR9/v0.8 onboarding lets the user set it.

ALTER TABLE events ADD COLUMN latency INTEGER;
ALTER TABLE events ADD COLUMN resume TEXT;

ALTER TABLE users ADD COLUMN anchor_hour REAL NOT NULL DEFAULT 4.5;
