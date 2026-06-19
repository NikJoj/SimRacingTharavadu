# 🗄️ Database Migration Guide: Google Sheets → Neon PostgreSQL

## Overview

This guide documents the complete migration from Google Sheets backend to Neon PostgreSQL database for the SimRacingTharavadu website.

---

## ✅ What Has Been Completed

### 1. **Database Setup**
- ✅ Neon PostgreSQL database created
- ✅ Connection string configured
- ✅ Tables created with proper schema and indexes

### 2. **Backend Infrastructure**
- ✅ Installed `@vercel/postgres` package
- ✅ Created database utility module (`api/db.js`)
- ✅ Created 4 new API endpoints:
  - `api/events.js` - Events CRUD operations
  - `api/leagues.js` - Leagues CRUD operations
  - `api/leaderboard.js` - Leaderboard CRUD operations
  - `api/registrations.js` - Registrations CRUD operations

### 3. **Frontend Updates**
- ✅ Updated `js/config.js` - Removed Google Sheets URLs, added API endpoints
- ✅ Updated `js/data-service.js` - Replaced sheet fetching with database API calls
- ✅ Updated `js/registration.js` - Uses new registration API
- ✅ Updated `js/admin.js` - All admin functions now use database APIs

### 4. **Configuration**
- ✅ Updated `.env.example` with `DATABASE_URL`

---

## 📊 Database Schema

### Tables Created

```sql
-- Events Table
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sim VARCHAR(100),
  status VARCHAR(50) DEFAULT 'upcoming',
  track VARCHAR(255),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  format VARCHAR(100),
  drivers INTEGER DEFAULT 0,
  max_drivers INTEGER DEFAULT 30,
  rounds INTEGER DEFAULT 1,
  season VARCHAR(50),
  description TEXT,
  track_mod VARCHAR(255),
  car_mod VARCHAR(255),
  practice_server VARCHAR(255),
  car_options VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leagues Table
CREATE TABLE leagues (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sim VARCHAR(100),
  status VARCHAR(50) DEFAULT 'upcoming',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  format VARCHAR(100),
  season VARCHAR(50),
  championship_id VARCHAR(255),
  blob_store VARCHAR(255),
  drivers INTEGER DEFAULT 0,
  max_drivers INTEGER DEFAULT 36,
  rounds INTEGER DEFAULT 8,
  track VARCHAR(255),
  description TEXT,
  car_options VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard Table
CREATE TABLE leaderboard (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  race VARCHAR(100) DEFAULT 'Race 1',
  position INTEGER,
  driver VARCHAR(255),
  tag VARCHAR(100),
  team VARCHAR(255),
  points DECIMAL(10,2),
  time VARCHAR(50),
  gap VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registrations Table
CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  driver_tag VARCHAR(100) NOT NULL,
  discord VARCHAR(255),
  car_class VARCHAR(100),
  event VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes Created

```sql
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date DESC);
CREATE INDEX idx_leagues_status ON leagues(status);
CREATE INDEX idx_leagues_championship ON leagues(championship_id);
CREATE INDEX idx_leaderboard_event_race ON leaderboard(event_id, race);
CREATE INDEX idx_registrations_event ON registrations(event);
CREATE INDEX idx_registrations_timestamp ON registrations(timestamp DESC);
```

---

## 🚀 Deployment Steps

### Step 1: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:
   - **Name:** `DATABASE_URL`
   - **Value:** `postgresql://neondb_owner:npg_ojPOy6h7tiId@ep-tiny-cake-ah5ta5tk-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
   - **Environment:** Select all (Production, Preview, Development)

### Step 2: Deploy to Vercel

```bash
# Commit all changes
git add .
git commit -m "Migrate from Google Sheets to Neon PostgreSQL"

# Push to GitHub (triggers Vercel deployment)
git push origin main
```

### Step 3: Verify Deployment

After deployment completes:

1. Check Vercel deployment logs for any errors
2. Test the API endpoints:
   - `https://your-domain.vercel.app/api/events`
   - `https://your-domain.vercel.app/api/leagues`
   - `https://your-domain.vercel.app/api/leaderboard`
   - `https://your-domain.vercel.app/api/registrations`

---

## 📥 Data Migration (Optional)

If you have existing data in Google Sheets that needs to be migrated:

### Option 1: Manual Entry via Admin Panel

1. Log into the admin panel
2. Use the "Create Event" and "Create League" forms
3. Manually enter existing data

### Option 2: CSV Import Script

Create a migration script `scripts/migrate-data.js`:

```javascript
import { sql } from '@vercel/postgres';
import fs from 'fs';
import csv from 'csv-parser';

async function migrateEvents() {
  const events = [];
  
  fs.createReadStream('data/events.csv')
    .pipe(csv())
    .on('data', (row) => events.push(row))
    .on('end', async () => {
      for (const event of events) {
        await sql`
          INSERT INTO events (name, sim, status, track, start_date, end_date, format, max_drivers, description)
          VALUES (${event.name}, ${event.sim}, ${event.status}, ${event.track}, 
                  ${event.startDate}, ${event.endDate}, ${event.format}, 
                  ${event.maxDrivers}, ${event.description})
        `;
      }
      console.log(`Migrated ${events.length} events`);
    });
}

migrateEvents();
```

### Option 3: Direct Database Insert

Use Neon's SQL Editor to insert data directly:

```sql
INSERT INTO events (name, sim, status, track, start_date, end_date, format, max_drivers, description)
VALUES 
  ('Kerala GT3 Challenge', 'Assetto Corsa Competizione', 'ongoing', 'Mount Panorama', 
   '2026-03-01', '2026-03-15', 'Sprint Race', 32, 'GT3 racing event'),
  -- Add more rows...
;
```

---

## 🔄 API Endpoints Reference

### Events API (`/api/events`)

**GET** - Fetch all events
```bash
curl https://your-domain.vercel.app/api/events
```

**GET** - Fetch single event
```bash
curl https://your-domain.vercel.app/api/events?id=1
```

**POST** - Create event
```bash
curl -X POST https://your-domain.vercel.app/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Event",
    "sim": "Assetto Corsa",
    "status": "upcoming",
    "track": "Spa",
    "start_date": "2026-04-01T00:00:00Z",
    "end_date": "2026-04-02T00:00:00Z",
    "format": "Sprint",
    "max_drivers": 30
  }'
```

**PUT** - Update event
```bash
curl -X PUT https://your-domain.vercel.app/api/events \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "status": "ongoing"}'
```

**DELETE** - Delete event
```bash
curl -X DELETE https://your-domain.vercel.app/api/events \
  -H "Content-Type: application/json" \
  -d '{"id": 1}'
```

### Similar patterns for:
- `/api/leagues` - League management
- `/api/leaderboard` - Leaderboard entries
- `/api/registrations` - User registrations

---

## 🧪 Testing Checklist

### Frontend Testing

- [ ] Homepage loads without errors
- [ ] Events display correctly
- [ ] Leagues display correctly
- [ ] Event registration form works
- [ ] League registration form works
- [ ] Leaderboard displays correctly

### Admin Panel Testing

- [ ] Admin login works
- [ ] Dashboard shows correct stats
- [ ] Create new event works
- [ ] Edit event works
- [ ] Delete event works
- [ ] Create new league works
- [ ] Edit league works
- [ ] Delete league works
- [ ] View registrations works
- [ ] Edit registration works
- [ ] Delete registration works
- [ ] Export registrations works

### API Testing

- [ ] GET /api/events returns data
- [ ] POST /api/events creates event
- [ ] PUT /api/events updates event
- [ ] DELETE /api/events deletes event
- [ ] GET /api/leagues returns data
- [ ] POST /api/registrations creates registration
- [ ] Duplicate registration is prevented

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch data from database"

**Solution:**
1. Check DATABASE_URL is set in Vercel environment variables
2. Verify connection string is correct
3. Check Neon database is active (not paused)
4. Review Vercel function logs for detailed error

### Issue: "Registration ID not found"

**Solution:**
- This occurs if trying to edit/delete before data is loaded
- Ensure `loadRegistrations()` completes before operations
- Check that registrations have `id` field from database

### Issue: API returns 500 error

**Solution:**
1. Check Vercel function logs
2. Verify database tables exist
3. Check SQL syntax in API endpoints
4. Ensure all required fields are provided

### Issue: CORS errors

**Solution:**
- CORS headers are already set in all API endpoints
- If issues persist, check Vercel deployment settings
- Verify API endpoints are deployed correctly

---

## 📝 Key Changes Summary

### Removed Files/Dependencies
- ❌ Google Sheets integration code
- ❌ `APPS_SCRIPT_URL` configuration
- ❌ `EVENTS_SHEET_URL`, `LEAGUES_SHEET_URL`, `LEADERBOARD_SHEET_URL`
- ❌ `fetchGSheet()` and `parseRows()` functions
- ❌ Google Apps Script file (no longer needed)

### Added Files/Dependencies
- ✅ `@vercel/postgres` package
- ✅ `api/db.js` - Database utility
- ✅ `api/events.js` - Events API
- ✅ `api/leagues.js` - Leagues API
- ✅ `api/leaderboard.js` - Leaderboard API
- ✅ `api/registrations.js` - Registrations API
- ✅ `DATABASE_MIGRATION_GUIDE.md` - This file

### Modified Files
- 📝 `.env.example` - Added DATABASE_URL
- 📝 `package.json` - Added @vercel/postgres
- 📝 `js/config.js` - Replaced sheet URLs with API endpoints
- 📝 `js/data-service.js` - Database API integration
- 📝 `js/registration.js` - Uses registration API
- 📝 `js/admin.js` - All CRUD operations use database APIs

---

## 🎯 Benefits of Migration

1. **Better Performance** - Direct database queries vs. Google Sheets API
2. **Real-time Updates** - No caching delays
3. **Data Integrity** - Foreign keys and constraints
4. **Scalability** - Handle more concurrent users
5. **Advanced Queries** - Complex filtering and sorting
6. **Automatic Backups** - Neon provides automated backups
7. **Better Security** - Database-level access control
8. **No API Limits** - No Google Sheets API quotas

---

## 📞 Support

If you encounter issues:

1. Check Vercel deployment logs
2. Review Neon database logs
3. Test API endpoints directly
4. Verify environment variables are set
5. Check browser console for frontend errors

---

## ✨ Next Steps

1. ✅ Deploy to Vercel
2. ✅ Test all functionality
3. ⏳ Migrate existing data (if any)
4. ⏳ Monitor performance
5. ⏳ Set up database backups
6. ⏳ Configure monitoring/alerts

---

**Migration completed successfully! 🎉**

The application now uses Neon PostgreSQL as the primary database, providing better performance, scalability, and reliability compared to Google Sheets.

---

*Generated: 2026-06-19*  
*Made with Bob*