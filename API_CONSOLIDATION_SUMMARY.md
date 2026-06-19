# API Consolidation Summary

## Overview
Successfully consolidated serverless functions from **17 to 12** to comply with Vercel Hobby plan limits.

## Problem
- Vercel Hobby plan allows maximum **12 serverless functions**
- Project had **17 API endpoints** (exceeding limit by 5)
- Deployment was blocked

## Solution
Consolidated related endpoints into unified APIs with query parameter routing:

### 1. **Home API** (`/api/home.js`) - NEW ✨
**Consolidated:** 3 endpoints → 1
- ❌ `/api/events` (GET only)
- ❌ `/api/leagues` (GET only)  
- ❌ `/api/leaderboard` (GET only)
- ✅ `/api/home` (returns all three datasets in one call)

**Benefits:**
- Reduces home page load from 3 API calls to 1
- Faster page load time
- Lower latency

**Usage:**
```javascript
// Before (3 requests)
fetch('/api/events')
fetch('/api/leagues')
fetch('/api/leaderboard')

// After (1 request)
fetch('/api/home')
// Returns: { events: [...], leagues: [...], leaderboard: [...] }
```

---

### 2. **Races API** (`/api/races.js`) - NEW ✨
**Consolidated:** 5 endpoints → 1
- ❌ `/api/fetch-races.js`
- ❌ `/api/race-result.js`
- ❌ `/api/get-stored-result.js`
- ❌ `/api/store-latest-result.js`
- ❌ `/api/sync-selected-races.js`
- ✅ `/api/races` (with action parameter)

**Usage:**
```javascript
// List all races
GET /api/races?action=list

// Get specific race result
GET /api/races?action=result&file=2026_4_29_10_38_RACE.json

// Get stored races for league
GET /api/races?action=stored&league=SRT-GT3-Season-1

// Get specific stored race
GET /api/races?action=stored&league=SRT-GT3-Season-1&timestamp=1595959680000

// List all leagues
GET /api/races?action=leagues

// Store latest race
POST /api/races?action=store&league=SRT-GT3-Season-1

// Sync selected races
POST /api/races?action=sync
Body: { league: "...", races: [...] }
```

---

### 3. **Live API** (`/api/live.js`) - NEW ✨
**Consolidated:** 2 endpoints → 1
- ❌ `/api/live-basic.js`
- ❌ `/api/live-leaderboard.js`
- ✅ `/api/live` (with type parameter)

**Usage:**
```javascript
// Get both basic and leaderboard
GET /api/live
// Returns: { basic: {...}, leaderboard: {...} }

// Get only basic info
GET /api/live?type=basic

// Get only leaderboard
GET /api/live?type=leaderboard
```

---

## Final API Count

### Active Serverless Functions (12 total)
1. ✅ `/api/home.js` - **NEW** (consolidated home page data)
2. ✅ `/api/races.js` - **NEW** (consolidated race operations)
3. ✅ `/api/live.js` - **NEW** (consolidated live timing)
4. ✅ `/api/events.js` - CRUD operations for events
5. ✅ `/api/leagues.js` - CRUD operations for leagues
6. ✅ `/api/leaderboard.js` - CRUD operations for leaderboard
7. ✅ `/api/registrations.js` - Registration management
8. ✅ `/api/admin-auth.js` - Admin authentication
9. ✅ `/api/championships.js` - Championship data
10. ✅ `/api/results.js` - Race results
11. ✅ `/api/standings.js` - Championship standings
12. ✅ `/api/sync-poster.js` - Poster synchronization

### Utility Module (Not Counted)
- `/api/db.js` - Database connection utility (imported by other functions)

### Archived Files (Renamed to .backup)
- `fetch-races.js.backup`
- `race-result.js.backup`
- `get-stored-result.js.backup`
- `store-latest-result.js.backup`
- `sync-selected-races.js.backup`
- `live-basic.js.backup`
- `live-leaderboard.js.backup`

---

## Code Changes

### 1. Frontend Update (`js/data-service.js`)
```javascript
// Before: 3 separate API calls
const [eventsRes, leaguesRes, leaderboardRes] = await Promise.all([
  fetch('/api/events'),
  fetch('/api/leagues'),
  fetch('/api/leaderboard')
]);

// After: 1 consolidated API call
const homeRes = await fetch('/api/home');
const homeData = await homeRes.json();
```

### 2. Config Update (`js/config.js`)
Updated API endpoint configuration to reflect new consolidated structure:
```javascript
API_ENDPOINTS: {
  HOME: '/api/home',  // NEW - consolidated endpoint
  // ... other endpoints
},
ASSETTO_API: {
  LIVE: '/api/live',   // NEW - consolidated
  RACES: '/api/races', // NEW - consolidated
  // ... other endpoints
}
```

### 3. Git Configuration (`.gitignore`)
Added backup file exclusion:
```
# Backup files (old API endpoints kept for reference)
*.backup
```

---

## Deployment Instructions

### Before Deploying
1. ✅ All consolidated APIs created
2. ✅ Frontend updated to use new endpoints
3. ✅ Old files renamed to `.backup`
4. ✅ `.gitignore` updated

### Deploy to Vercel
```bash
# Commit changes
git add .
git commit -m "Consolidate APIs: 17→12 functions for Hobby plan compliance"

# Push to trigger deployment
git push origin main
```

### Verify Deployment
1. Check Vercel dashboard - should show ≤12 functions
2. Test home page loads correctly
3. Verify consolidated endpoints work:
   - `/api/home`
   - `/api/races?action=list`
   - `/api/live`

---

## Rollback Plan (If Needed)

If issues occur, restore original files:
```bash
cd api
mv fetch-races.js.backup fetch-races.js
mv race-result.js.backup race-result.js
mv get-stored-result.js.backup get-stored-result.js
mv store-latest-result.js.backup store-latest-result.js
mv sync-selected-races.js.backup sync-selected-races.js
mv live-basic.js.backup live-basic.js
mv live-leaderboard.js.backup live-leaderboard.js

# Remove consolidated files
rm home.js races.js live.js

# Revert frontend changes
git checkout js/data-service.js js/config.js
```

---

## Performance Benefits

1. **Reduced API Calls:** Home page now makes 1 request instead of 3
2. **Lower Latency:** Parallel data fetching within single endpoint
3. **Better Caching:** Single cache entry for home page data
4. **Cleaner Code:** Related operations grouped logically

---

## Future Considerations

### If You Need More Functions Later:
1. **Upgrade to Pro Plan** ($20/month)
   - Supports up to 100 serverless functions
   - Better performance limits
   - Team collaboration features

2. **Further Consolidation:**
   - Combine CRUD operations (events, leagues, leaderboard) into single `/api/data.js`
   - Merge championship-related endpoints

3. **Move to Edge Functions:**
   - Consider Vercel Edge Functions for frequently accessed endpoints
   - Edge Functions don't count toward serverless function limit

---

## Summary

✅ **Successfully reduced from 17 to 12 serverless functions**  
✅ **Compliant with Vercel Hobby plan limits**  
✅ **Improved performance with consolidated endpoints**  
✅ **Old files preserved as .backup for reference**  
✅ **Ready for deployment**

---

*Generated: 2026-06-19*  
*Made with Bob*