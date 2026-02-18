# CM Yuva × On2Cook — Lead Qualification Portal

## File Structure

```
/
├── index.html          ← Landing page
├── portal.html         ← Lead scoring portal
├── server.js           ← Node.js backend (Google Sheets proxy)
├── package.json
├── .env.example        ← Copy to .env and fill in
├── assets/
│   └── logo.png        ← YOUR LOGO (add here, update HTML)
├── css/
│   ├── base.css        ← Shared variables, nav, footer, animations
│   ├── index.css       ← Landing page styles
│   └── portal.css      ← Portal app styles
└── js/
    ├── config.js       ← Supabase client + SECTIONS/RED_FLAGS constants
    ├── db.js           ← All Supabase read/write operations
    ├── portal.js       ← Lead list, scoring form, save logic
    └── dashboard.js    ← Dashboard rendering (lazy-loaded)
```

---

## Step 1 — Supabase Setup

1. Create a free project at https://supabase.com
2. Go to SQL Editor and run this:

```sql
CREATE TABLE scored_leads (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  lead_id      TEXT NOT NULL UNIQUE,
  lead_name    TEXT,
  lead_city    TEXT,
  lead_alloc   TEXT,
  scores       JSONB   DEFAULT '{}',
  flags        JSONB   DEFAULT '{}',
  notes        TEXT    DEFAULT '',
  total        INTEGER DEFAULT 0,
  flag_count   INTEGER DEFAULT 0,
  status       TEXT    DEFAULT 'pending',
  saved_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX ON scored_leads (lead_id);
CREATE INDEX ON scored_leads (status);
CREATE INDEX ON scored_leads (lead_alloc);

-- Enable Row Level Security (optional — for multi-user auth)
-- ALTER TABLE scored_leads ENABLE ROW LEVEL SECURITY;
```

3. Copy your **Project URL** and **anon/public key** from Settings → API

---

## Step 2 — Google Sheets

1. Open your Google Sheet
2. File → Share → Publish to web
3. Select your sheet → choose **CSV** format → click Publish
4. Copy the URL (looks like `https://docs.google.com/spreadsheets/d/e/XXXXXX/pub?output=csv`)

---

## Step 3 — Environment Setup

```bash
cp .env.example .env
```

Edit `.env`:
```
GOOGLE_SHEET_URL=https://docs.google.com/spreadsheets/d/e/YOUR_ID/pub?output=csv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
PORT=3000
```

Also update `js/config.js` with your Supabase credentials (frontend needs them too).

---

## Step 4 — Add Your Logo

Replace the placeholder divs in both `index.html` and `portal.html`:

```html
<!-- Find this comment and replace the div below it -->
<img src="assets/logo.png" alt="Your Brand" class="nav-logo-img" />
```

Place your logo at `assets/logo.png`. Works with PNG (transparency supported), SVG, WebP.

---

## Step 5 — Run

```bash
npm install
npm start
```

Open: http://localhost:3000

---

## Deploy (Render / Railway / Fly.io)

1. Push to GitHub
2. Connect repo to Render (free tier works)
3. Set environment variables in the dashboard
4. Deploy — your portal runs on a public URL

---

## Column Mapping

The backend auto-maps your Google Sheet columns:

| Sheet Column | Mapped To |
|---|---|
| `id` | `lead.id` |
| `Date` / `Formatted Date` | `lead.date` |
| `full_name` | `lead.full_name` |
| `phone_number` | `lead.phone` |
| `city` / `Target City` | `lead.city` |
| `gender` | `lead.gender` |
| `Age` | `lead.age` |
| `education_level` | `lead.education` |
| `Lead Allocation` | `lead.allocation` |
| `platform` | `lead.platform` |
| `ad_name` | `lead.ad_name` |
| Hindi intent column | `lead.intent` |
| Hindi time_ready column | `lead.time_ready` |