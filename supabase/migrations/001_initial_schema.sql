-- ============================================================
-- BCMG Election 2026 — Full Database Schema
-- Run this in Supabase SQL Editor or via migration
-- ============================================================

-- ==================== VOTERS TABLE ====================
CREATE TABLE IF NOT EXISTS voters (
  id            BIGSERIAL PRIMARY KEY,
  sr_no         INTEGER NOT NULL,
  enrolment     TEXT NOT NULL UNIQUE,
  year          INTEGER,
  name          TEXT NOT NULL,
  sex           TEXT CHECK (sex IN ('Male', 'Female', 'Other')),
  mobile        TEXT,
  address       TEXT,
  taluka        TEXT,
  district      TEXT,
  cluster_bar   TEXT,
  booth_name    TEXT,
  bar_association TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Full-text search index on name
CREATE INDEX idx_voters_name_trgm ON voters USING gin (name gin_trgm_ops);
CREATE INDEX idx_voters_enrolment ON voters (enrolment);
CREATE INDEX idx_voters_sr_no ON voters (sr_no);
CREATE INDEX idx_voters_district ON voters (district);
CREATE INDEX idx_voters_booth ON voters (booth_name);
CREATE INDEX idx_voters_bar ON voters (bar_association);
CREATE INDEX idx_voters_mobile ON voters (mobile);

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==================== CANDIDATE CONFIG TABLE ====================
CREATE TABLE IF NOT EXISTS candidates (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  ballot_no     TEXT NOT NULL,
  tagline       TEXT DEFAULT 'First / Best Preference',
  phone         TEXT,
  photo_url     TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ==================== CAMPAIGN ANALYTICS TABLE ====================
CREATE TABLE IF NOT EXISTS analytics_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'search', 'view_slip', 'whatsapp_send', 'whatsapp_share', 
    'download_slip', 'bulk_send', 'admin_login'
  )),
  voter_id      BIGINT REFERENCES voters(id) ON DELETE SET NULL,
  voter_name    TEXT,
  voter_enrolment TEXT,
  search_query  TEXT,
  search_type   TEXT,
  results_count INTEGER,
  booth_name    TEXT,
  bar_association TEXT,
  district      TEXT,
  ip_address    INET,
  user_agent    TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analytics_event_type ON analytics_events (event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events (created_at DESC);
CREATE INDEX idx_analytics_voter_id ON analytics_events (voter_id);
CREATE INDEX idx_analytics_booth ON analytics_events (booth_name);

-- ==================== WHATSAPP MESSAGE LOG ====================
CREATE TABLE IF NOT EXISTS whatsapp_log (
  id            BIGSERIAL PRIMARY KEY,
  voter_id      BIGINT REFERENCES voters(id) ON DELETE SET NULL,
  voter_name    TEXT,
  mobile        TEXT NOT NULL,
  message_type  TEXT CHECK (message_type IN ('individual', 'bulk', 'share')),
  status        TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'delivered', 'read', 'failed'
  )),
  provider      TEXT DEFAULT 'wa_link',  -- 'wa_link', 'interakt', 'wati', 'twilio'
  provider_msg_id TEXT,
  error_message TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wa_log_voter ON whatsapp_log (voter_id);
CREATE INDEX idx_wa_log_status ON whatsapp_log (status);
CREATE INDEX idx_wa_log_created ON whatsapp_log (created_at DESC);

-- ==================== ADMIN USERS TABLE ====================
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  role          TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ==================== BOOTH MASTER TABLE ====================
CREATE TABLE IF NOT EXISTS booths (
  id            BIGSERIAL PRIMARY KEY,
  booth_name    TEXT NOT NULL,
  district      TEXT,
  address       TEXT,
  total_voters  INTEGER DEFAULT 0,
  contacted     INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_booths_name ON booths (booth_name);

-- ==================== RLS POLICIES ====================
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Public read for voters (search feature)
CREATE POLICY "Public can search voters" ON voters
  FOR SELECT USING (true);

-- Public read for active candidate
CREATE POLICY "Public can view active candidate" ON candidates
  FOR SELECT USING (is_active = true);

-- Anyone can insert analytics (anonymous tracking)
CREATE POLICY "Anyone can log analytics" ON analytics_events
  FOR INSERT WITH CHECK (true);

-- Only authenticated admins can read analytics
CREATE POLICY "Admins can read analytics" ON analytics_events
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM admin_users WHERE is_active = true)
  );

-- Authenticated users manage candidates
CREATE POLICY "Admins manage candidates" ON candidates
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM admin_users WHERE role = 'admin' AND is_active = true)
  );

-- ==================== FUNCTIONS ====================

-- Fuzzy voter search function
CREATE OR REPLACE FUNCTION search_voters(
  search_query TEXT,
  search_type TEXT DEFAULT 'name',
  result_limit INTEGER DEFAULT 20
)
RETURNS SETOF voters
LANGUAGE plpgsql
AS $$
BEGIN
  IF search_type = 'name' THEN
    RETURN QUERY
      SELECT * FROM voters
      WHERE name ILIKE '%' || search_query || '%'
      ORDER BY similarity(name, search_query) DESC
      LIMIT result_limit;
  ELSIF search_type = 'enrolment' THEN
    RETURN QUERY
      SELECT * FROM voters
      WHERE enrolment ILIKE '%' || search_query || '%'
      ORDER BY enrolment
      LIMIT result_limit;
  ELSIF search_type = 'sr' THEN
    RETURN QUERY
      SELECT * FROM voters
      WHERE sr_no::TEXT LIKE '%' || search_query || '%'
      ORDER BY sr_no
      LIMIT result_limit;
  ELSIF search_type = 'mobile' THEN
    RETURN QUERY
      SELECT * FROM voters
      WHERE mobile LIKE '%' || search_query || '%'
      ORDER BY name
      LIMIT result_limit;
  ELSE
    RETURN QUERY
      SELECT * FROM voters
      WHERE name ILIKE '%' || search_query || '%'
         OR enrolment ILIKE '%' || search_query || '%'
         OR sr_no::TEXT LIKE '%' || search_query || '%'
      ORDER BY similarity(name, search_query) DESC
      LIMIT result_limit;
  END IF;
END;
$$;

-- Dashboard stats function
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_voters', (SELECT COUNT(*) FROM voters),
    'total_searches', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'search'),
    'total_slips_viewed', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'view_slip'),
    'total_whatsapp_sent', (SELECT COUNT(*) FROM whatsapp_log WHERE status IN ('sent', 'delivered', 'read')),
    'total_downloads', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'download_slip'),
    'searches_today', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'search' AND created_at >= CURRENT_DATE),
    'whatsapp_today', (SELECT COUNT(*) FROM whatsapp_log WHERE created_at >= CURRENT_DATE),
    'top_booths', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT booth_name, COUNT(*) as search_count
        FROM analytics_events
        WHERE event_type = 'view_slip' AND booth_name IS NOT NULL
        GROUP BY booth_name
        ORDER BY search_count DESC
        LIMIT 10
      ) t
    ),
    'daily_activity', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT DATE(created_at) as date, event_type, COUNT(*) as count
        FROM analytics_events
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at), event_type
        ORDER BY date DESC
      ) t
    ),
    'booth_coverage', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          v.booth_name,
          COUNT(DISTINCT v.id) as total,
          COUNT(DISTINCT wl.voter_id) as contacted
        FROM voters v
        LEFT JOIN whatsapp_log wl ON wl.voter_id = v.id AND wl.status IN ('sent', 'delivered', 'read')
        WHERE v.booth_name IS NOT NULL
        GROUP BY v.booth_name
        ORDER BY total DESC
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- Booth-wise voter count materialized view (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS booth_voter_counts AS
SELECT 
  booth_name,
  district,
  bar_association,
  COUNT(*) as total_voters,
  COUNT(CASE WHEN mobile IS NOT NULL AND mobile != '' THEN 1 END) as with_mobile
FROM voters
GROUP BY booth_name, district, bar_association
ORDER BY total_voters DESC;

CREATE UNIQUE INDEX idx_booth_counts ON booth_voter_counts (booth_name, district, bar_association);
