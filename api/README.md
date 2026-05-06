# Assetto Corsa Serverless API

This folder contains serverless functions that proxy requests to the Assetto Corsa Championship API, solving CORS issues when calling from the browser.

## 📁 API Endpoints

### 1. Championship Standings
**Endpoint:** `/api/standings`  
**Method:** `GET`  
**Parameters:**
- `championshipId` (required) - The championship UUID

**Example:**
```javascript
fetch('/api/standings?championshipId=1bb2f11c-d4db-45e8-9505-97cd6ec1e806')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:** Championship standings with driver points, positions, etc.

---

### 2. Championships List
**Endpoint:** `/api/championships`  
**Method:** `GET`  
**Parameters:** None

**Example:**
```javascript
fetch('/api/championships')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:** List of all available championships

---

### 3. Live Timing Leaderboard
**Endpoint:** `/api/live-leaderboard`  
**Method:** `GET`  
**Parameters:** None

**Example:**
```javascript
fetch('/api/live-leaderboard')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:** Real-time leaderboard during active races  
**Cache:** 5 seconds (for live data)

---

### 4. Live Timing Basic
**Endpoint:** `/api/live-basic`  
**Method:** `GET`  
**Parameters:** None

**Example:**
```javascript
fetch('/api/live-basic')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:** Basic live timing information  
**Cache:** 5 seconds (for live data)

---

### 5. Race Results List
**Endpoint:** `/api/results`  
**Method:** `GET`  
**Parameters:** None

**Example:**
```javascript
fetch('/api/results')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:** List of completed race results
**Cache:** 2 minutes

---

### 6. Individual Race Result
**Endpoint:** `/api/race-result`
**Method:** `GET`
**Parameters:**
- `file` (required) - The race result filename (e.g., `2020_7_28_19_48_RACE.json`)

**Example:**
```javascript
fetch('/api/race-result?file=2020_7_28_19_48_RACE.json')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:** Detailed race result data for a specific race
**Cache:** 5 minutes

---

### 7. Store Latest Race Result
**Endpoint:** `/api/store-latest-result`
**Method:** `GET` or `POST`
**Parameters:**
- `league` (required) - League name/identifier (e.g., `SRT-GT3-Season-1`)

**Example:**
```javascript
fetch('/api/store-latest-result?league=SRT-GT3-Season-1', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:** Stores the latest RACE result in Vercel Blob Store organized by league
**Features:**
- Automatically fetches the latest race result from `/api/results/list.json`
- Filters for RACE sessions only (excludes PRACTICE and QUALIFYING)
- Stores with league-specific path: `{league}/race-{timestamp}.json`
- Includes league metadata for filtering
- Each race stored with unique timestamp
- Returns blob URLs for stored data

**Response Format:**
```json
{
  "success": true,
  "message": "Latest race result stored successfully",
  "league": "SRT-GT3-Season-1",
  "metadata": {
    "league": "SRT-GT3-Season-1",
    "track": "spa",
    "session_type": "RACE",
    "date": "2020-07-28T19:48:00+01:00",
    "results_json_url": "/results/download/2020_7_28_19_48_RACE.json",
    "results_page_url": "/results/2020_7_28_19_48_RACE",
    "stored_at": "2026-05-06T09:30:00.000Z",
    "blob_url": "https://...",
    "race_timestamp": 1595959680000
  },
  "blob_urls": {
    "result": "https://...",
    "metadata": "https://..."
  }
}
```

---

### 8. Get Stored Race Results
**Endpoint:** `/api/get-stored-result`
**Method:** `GET`
**Parameters:**
- `list` (optional) - Set to `leagues` to list all available leagues
- `league` (optional) - League name to filter results
- `timestamp` (optional) - Specific race timestamp (use with `league`)

**Examples:**

**List all leagues:**
```javascript
fetch('/api/get-stored-result?list=leagues')
  .then(res => res.json())
  .then(data => console.log(data));
// Returns: { success: true, leagues: ["SRT-GT3-Season-1", "SRT-Formula-Series"] }
```

**Get all races for a league:**
```javascript
fetch('/api/get-stored-result?league=SRT-GT3-Season-1')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response Format (all races):**
```json
{
  "success": true,
  "league": "SRT-GT3-Season-1",
  "count": 5,
  "races": [
    {
      "timestamp": 1595959680000,
      "date": "2020-07-28T19:48:00+01:00",
      "track": "spa",
      "session_type": "RACE",
      "blob_url": "https://...",
      "metadata_url": "https://..."
    }
  ]
}
```

**Get specific race:**
```javascript
fetch('/api/get-stored-result?league=SRT-GT3-Season-1&timestamp=1595959680000')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response Format (specific race):**
```json
{
  "success": true,
  "league": "SRT-GT3-Season-1",
  "timestamp": "1595959680000",
  "metadata": {
    "league": "SRT-GT3-Season-1",
    "track": "spa",
    "date": "2020-07-28T19:48:00+01:00"
  },
  "data": { /* full race result data */ }
}
```

**Cache:** 1-5 minutes depending on query type

---

## 🚀 Deployment

### Deploy to Vercel

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add serverless API functions"
   git push origin main
   ```

3. **Deploy via Vercel Dashboard:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the configuration
   - Click "Deploy"

4. **Your API will be available at:**
   ```
   https://your-project.vercel.app/api/standings
   https://your-project.vercel.app/api/championships
   etc.
   ```

### Local Development

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Run locally:**
   ```bash
   vercel dev
   ```

3. **Test endpoints:**
   ```
   http://localhost:3000/api/standings?championshipId=YOUR_ID
   http://localhost:3000/api/championships
   ```

---

## 🔧 Configuration

### Update Championship ID

Edit `js/config.js`:
```javascript
ASSETTO_CHAMPIONSHIP_ID: "your-championship-id-here"
```

### Change API Base URL

For local development:
```javascript
API_BASE_URL: "http://localhost:3000/api"
```

For production (relative paths work when deployed together):
```javascript
API_BASE_URL: "/api"
```

---

## 🛠️ How It Works

### The Problem
Browser security (CORS) blocks direct API calls to external servers:
```
Browser → Assetto Corsa API ❌ (CORS blocked)
```

### The Solution
Serverless functions run on the server side, bypassing CORS:
```
Browser → Serverless Function → Assetto Corsa API ✅
```

### Benefits
- ✅ No CORS issues
- ✅ No need for unreliable proxy services
- ✅ Built-in caching
- ✅ Free hosting on Vercel
- ✅ Automatic scaling
- ✅ Deploy with your frontend

---

## 📝 Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad request (missing parameters)
- `500` - Server error (API unavailable)

---

## 🔒 Security Notes

- All endpoints have CORS enabled (`Access-Control-Allow-Origin: *`)
- No authentication required (public racing data)
- Rate limiting handled by Vercel (free tier: 100GB bandwidth/month)

---

## 📚 Additional Resources

- [Vercel Serverless Functions Docs](https://vercel.com/docs/functions)
- [Assetto Corsa Server Manager API](https://wiki.emperorservers.com/assetto-corsa-server-manager/web-api)
- [Fetch API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

---

## 🐛 Troubleshooting

### API returns 500 error
- Check if Assetto Corsa server is online
- Verify championship ID is correct
- Check Vercel function logs

### Local development not working
- Ensure Vercel CLI is installed: `npm install -g vercel`
- Run `vercel dev` in project root
- Check port 3000 is not in use

### CORS errors still appearing
- Ensure you're using the serverless endpoints, not direct API calls
- Check `js/config.js` has correct API paths
- Clear browser cache

---

Made with ❤️ for SimRacingTharavadu