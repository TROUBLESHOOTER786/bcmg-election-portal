# BCMG Election 2026 — Production Setup Guide

## Complete Deployment Playbook

---

## 1. Project Architecture

```
bcmg-election/
├── src/
│   ├── lib/
│   │   ├── supabase.js          # Supabase client config
│   │   ├── api.js               # All database operations
│   │   ├── whatsapp.js          # WhatsApp integration (3 providers)
│   │   └── data-import.js       # Excel → Supabase importer
│   ├── pages/
│   │   └── api/whatsapp/
│   │       ├── send.js          # Individual WhatsApp send
│   │       └── bulk-send.js     # Batch WhatsApp send
│   └── components/              # React components (in .jsx artifact)
├── supabase/migrations/
│   └── 001_initial_schema.sql   # Full database schema
├── .env.example                 # Environment variables template
├── package.json
└── SETUP-GUIDE.md               # This file
```

---

## 2. Step-by-Step Setup

### Step 1: Create Supabase Project (5 min)

1. Go to **https://supabase.com** → Sign up / Log in
2. Click **"New Project"**
3. Name it: `bcmg-election-2026`
4. Choose region: **Mumbai (ap-south-1)** for lowest latency
5. Set a strong database password (save it!)
6. Wait for project to provision (~2 min)

### Step 2: Run Database Migration (3 min)

1. In Supabase Dashboard → **SQL Editor**
2. Click **"New Query"**
3. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Click **"Run"**
5. Verify: Go to **Table Editor** → you should see tables: `voters`, `candidates`, `analytics_events`, `whatsapp_log`, `admin_users`, `booths`

### Step 3: Enable Extensions

In SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```
This enables fuzzy text search for voter names.

### Step 4: Create Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. Click **"New Bucket"**
3. Name: `campaign-assets`
4. Set to **Public** (for candidate photos)
5. Click **Create**

### Step 5: Get API Keys

1. Go to **Settings → API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIs...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIs...` (keep secret!)

### Step 6: Set Up Environment

```bash
cp .env.example .env.local
```

Fill in your Supabase keys:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 7: Import Voter Data (10 min)

```bash
# Install dependencies
npm install

# Run the importer with your Excel file
node src/lib/data-import.js path/to/your-voter-list.xlsx
```

The importer will:
- Read your Excel file (supports .xlsx, .xls, .csv)
- Auto-map columns to database fields
- Insert in batches of 500
- Skip duplicates (by enrolment number)
- Show progress and summary

### Step 8: Add Your Candidate

In Supabase SQL Editor:
```sql
INSERT INTO candidates (name, ballot_no, tagline, phone, is_active)
VALUES ('ADV. YOUR NAME', '5', 'First / Best Preference', '919876543210', true);
```

Or use the Settings panel in the app (gear icon, top right).

### Step 9: Deploy to Vercel (5 min)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy to production
vercel --prod
```

---

## 3. WhatsApp Integration Options

### Option A: Free — wa.me Links (Default)

No setup needed. Opens WhatsApp with pre-filled message. Voter taps "Send".

**Limitations**: Requires manual tap to send, no delivery tracking, no bulk capability.

### Option B: Interakt (Recommended for India, ~₹0.50/msg)

1. Sign up at **https://www.interakt.shop**
2. Get API key from Settings → Developer
3. Create a WhatsApp template named `voter_slip_bcmg` with these variables:
   - {{1}} = Voter Name
   - {{2}} = Enrolment Number
   - {{3}} = Booth Name
   - {{4}} = Bar Association
   - {{5}} = Candidate Name
   - {{6}} = Ballot Number
   - {{7}} = Tagline
4. Get template approved by WhatsApp (~24-48 hrs)
5. Add to `.env.local`:
   ```
   NEXT_PUBLIC_WA_PROVIDER=interakt
   INTERAKT_API_KEY=your-api-key
   ```

### Option C: Wati.io (~₹0.70/msg)

1. Sign up at **https://www.wati.io**
2. Similar template setup as Interakt
3. Add API URL and key to `.env.local`

### Option D: Twilio (Most flexible, ~₹0.85/msg)

1. Sign up at **https://www.twilio.com**
2. Enable WhatsApp Sandbox (testing) or apply for production number
3. Add credentials to `.env.local`

---

## 4. Database Tables Reference

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `voters` | Electoral roll data | enrolment (unique), name, mobile, booth_name |
| `candidates` | Your candidate config | name, ballot_no, tagline, photo_url |
| `analytics_events` | All tracking events | event_type, voter_id, search_query |
| `whatsapp_log` | Message send history | voter_id, mobile, status, provider |
| `admin_users` | Dashboard access control | email, role (admin/manager/viewer) |
| `booths` | Booth master data | booth_name, total_voters, contacted |
| `booth_voter_counts` | Materialized view | booth stats (refresh periodically) |

---

## 5. Key Database Functions

| Function | What It Does |
|----------|--------------|
| `search_voters(query, type, limit)` | Fuzzy voter search with pg_trgm |
| `get_dashboard_stats()` | Complete campaign analytics JSON |

---

## 6. Security Considerations

- **RLS (Row Level Security)** is enabled on all tables
- Voters table: Public read-only (anyone can search)
- Analytics: Public insert, admin-only read
- Candidates: Admin-only write
- WhatsApp log: Admin-only access
- **Never expose the service_role key** — it's only used in API routes (server-side)
- The anon key is safe to use in the browser

---

## 7. Scaling for 1.96 Lakh Voters

The schema handles this volume easily:

- **pg_trgm index** on voter names enables fast fuzzy search
- **B-tree indexes** on enrolment, sr_no, mobile for exact lookups
- **Materialized view** for booth stats (refresh after bulk imports)
- Supabase free tier supports up to 500MB database = ~2M voter records

To refresh booth statistics after data changes:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY booth_voter_counts;
```

---

## 8. Post-Deployment Checklist

- [ ] Supabase project created in ap-south-1 (Mumbai)
- [ ] Migration SQL executed successfully
- [ ] pg_trgm extension enabled
- [ ] Storage bucket `campaign-assets` created
- [ ] Voter data imported (check count in Table Editor)
- [ ] Candidate record created
- [ ] Environment variables set in Vercel
- [ ] App deployed and accessible
- [ ] Search working (test with 3-4 names)
- [ ] WhatsApp send working (test with your own number)
- [ ] Admin dashboard showing stats
- [ ] Candidate settings saving correctly
- [ ] WhatsApp Business template approved (if using paid provider)
