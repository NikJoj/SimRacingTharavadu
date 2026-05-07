# 🔐 Admin Panel Setup Guide

## Overview

This guide will help you set up and configure the admin backdoor login system for Sim Racing Tharavadu. The admin panel provides a secure interface for managing events, leagues, registrations, and race result synchronization.

## 🎯 Features

### ✅ Implemented Features

1. **Secure Authentication**
   - Simple username/password login
   - Session token management (2-hour expiration)
   - Protected admin routes

2. **Event Management**
   - View all events
   - Create new events
   - Edit existing events
   - Delete events (soft delete)
   - Search and filter

3. **League Management**
   - View all leagues
   - Create new leagues
   - Edit existing leagues
   - Delete leagues (soft delete)
   - Configure blob store folders

4. **Registration Management**
   - View all registrations
   - Filter by event/league
   - Edit registration details
   - Delete registrations
   - Export to CSV

5. **Race Result Sync**
   - Manual sync from Assetto Corsa API
   - View sync history
   - League-specific syncing
   - Automatic blob storage

6. **Dashboard**
   - Statistics overview
   - Recent activity feed
   - Quick action buttons

## 📋 Prerequisites

- Vercel account (for deployment)
- Google Sheets with Apps Script access
- Existing SimRacingTharavadu project setup

## 🚀 Installation Steps

### Step 1: Deploy to Vercel

1. **Set Environment Variables** in Vercel Dashboard:
   ```bash
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_secure_password
   JWT_SECRET=your_random_secret_key_min_32_chars
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
   ```

   **Important Security Notes:**
   - Use a strong, unique password
   - Generate a random JWT_SECRET (at least 32 characters)
   - Never commit these values to Git
   - Change default credentials immediately

2. **Deploy the project**:
   ```bash
   vercel --prod
   ```

### Step 2: Update Google Apps Script

1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. Replace the entire `Code.gs` content with the code from `google-apps-script-admin.js`
4. Save the script (Ctrl+S or Cmd+S)
5. Click **Deploy > New deployment**
6. Select type: **Web app**
7. Configure:
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy**
9. Copy the web app URL
10. Update `APPS_SCRIPT_URL` in `js/config.js` with this URL

### Step 3: Update Google Sheets Structure

Ensure your Google Sheet has the following sheets with these columns:

#### Registrations Sheet
```
timestamp | firstName | lastName | driverTag | nationality | email | whatsapp | discord | platform | wheel | experience | skillLevel | carClass | event | league | type
```

#### Events Sheet (if not already present)
```
id | name | sim | status | track | startDate | endDate | format | drivers | maxDrivers | rounds | season | description | trackMod | carMod | practiceServer | carOptions
```

#### League Sheet (if not already present)
```
id | name | sim | status | startDate | endDate | format | season | championshipId | blobStore
```

### Step 4: Test the Setup

1. Navigate to `https://your-domain.com/login.html`
2. Login with your credentials
3. Verify you can access the admin dashboard
4. Test each feature:
   - View events and leagues
   - View registrations
   - Try syncing a race result (if you have leagues with blob store configured)

## 🔒 Security Best Practices

### 1. Change Default Credentials

The default credentials are:
- Username: `admin`
- Password: `srt2026admin`

**⚠️ CHANGE THESE IMMEDIATELY** by setting environment variables in Vercel.

### 2. Use Strong Passwords

- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, and symbols
- Avoid common words or patterns

### 3. Secure JWT Secret

Generate a random secret key:
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use an online generator (ensure it's from a trusted source)
```

### 4. Regular Security Audits

- Review access logs regularly
- Change passwords periodically
- Monitor for suspicious activity
- Keep dependencies updated

### 5. IP Whitelisting (Optional)

For additional security, you can restrict admin access to specific IP addresses by modifying `api/admin-auth.js`:

```javascript
const ALLOWED_IPS = ['your.ip.address.here'];

export default async function handler(req, res) {
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  if (!ALLOWED_IPS.includes(clientIp)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // ... rest of the code
}
```

## 📖 Usage Guide

### Accessing the Admin Panel

1. Navigate to: `https://your-domain.com/login.html`
2. Enter your credentials
3. Click "Login to Dashboard"
4. You'll be redirected to the admin dashboard

### Managing Events

**Create Event:**
1. Go to Events section
2. Click "➕ Create Event"
3. Fill in the form:
   - Event Name (required)
   - Simulator (required)
   - Status (upcoming/ongoing/closed)
   - Track (required)
   - Start/End dates (required)
   - Format (required)
   - Max Drivers (required)
   - Car Options (comma-separated)
   - Description
4. Click "Save Event"

**Edit Event:**
1. Find the event in the table
2. Click the ✏️ (edit) icon
3. Modify the fields
4. Click "Save Event"

**Delete Event:**
1. Find the event in the table
2. Click the 🗑️ (delete) icon
3. Confirm deletion
4. Event status will be changed to "closed"

### Managing Leagues

Similar to events, but with league-specific fields:
- Championship ID (from Assetto Corsa API)
- Blob Store Folder (for race result storage)

### Managing Registrations

**View Registrations:**
1. Go to Registrations section
2. Use the filter dropdown to filter by event/league
3. Use the search box to find specific drivers

**Edit Registration:**
1. Click the ✏️ icon next to a registration
2. Modify the details
3. Save changes

**Delete Registration:**
1. Click the 🗑️ icon
2. Confirm deletion

**Export Registrations:**
1. Click "📥 Export CSV"
2. CSV file will be downloaded with all registrations

### Syncing Race Results

**Manual Sync:**
1. Go to Race Sync section
2. Select a league from the dropdown
3. Click "🔄 Sync Latest Race"
4. Wait for confirmation
5. View the synced race in the history

**View Sync History:**
- All synced races are displayed in the "Sync History" panel
- Shows track, league, date, and session type

## 🔧 Troubleshooting

### Login Issues

**Problem:** "Invalid credentials" error
- **Solution:** Verify environment variables are set correctly in Vercel
- Check that `ADMIN_USERNAME` and `ADMIN_PASSWORD` match your input

**Problem:** "Session expired" message
- **Solution:** Login again. Sessions expire after 2 hours for security

### Data Not Loading

**Problem:** Events/Leagues not showing
- **Solution:** 
  1. Check Google Sheets URLs in `js/config.js`
  2. Verify sheets are published (File > Share > Publish to web)
  3. Check browser console for errors

**Problem:** Registrations not loading
- **Solution:**
  1. Verify Apps Script is deployed as web app
  2. Check `APPS_SCRIPT_URL` in `js/config.js`
  3. Test the Apps Script URL directly in browser

### Race Sync Issues

**Problem:** "No race results found"
- **Solution:** Ensure there's a recent RACE session in Assetto Corsa API

**Problem:** "Failed to store race result"
- **Solution:**
  1. Verify `BLOB_READ_WRITE_TOKEN` is set in Vercel
  2. Check blob store folder name matches league configuration
  3. Review Vercel function logs

### Apps Script Errors

**Problem:** "Script execution failed"
- **Solution:**
  1. Check Apps Script logs (View > Logs)
  2. Verify sheet names match exactly
  3. Ensure all required columns exist
  4. Re-deploy the web app

## 🔄 Updating the System

### Adding New Features

1. Modify the relevant files:
   - `admin.html` - Add UI elements
   - `js/admin.js` - Add JavaScript logic
   - `css/admin.css` - Add styles
   - `google-apps-script-admin.js` - Add backend logic

2. Test locally if possible

3. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

4. Update Apps Script if backend changes were made

### Updating Credentials

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Update the values
5. Redeploy the project

## 📊 API Endpoints

### Authentication
- `POST /api/admin-auth` - Login/validate token

### Admin Operations (via Apps Script)
- `GET ?action=getRegistrations` - Fetch all registrations
- `POST action=updateRegistration` - Update a registration
- `POST action=deleteRegistration` - Delete a registration
- `POST action=createEvent` - Create new event
- `POST action=updateEvent` - Update event
- `POST action=deleteEvent` - Delete event
- `POST action=createLeague` - Create new league
- `POST action=updateLeague` - Update league
- `POST action=deleteLeague` - Delete league

### Race Sync
- `GET /api/store-latest-result?league=LEAGUE_NAME` - Sync latest race
- `GET /api/get-stored-result?league=LEAGUE_NAME` - Get synced races
- `GET /api/get-stored-result?list=leagues` - List all leagues

## 🎨 Customization

### Changing Theme Colors

Edit `css/admin.css` and modify the CSS variables:
```css
:root {
  --red: #dc2626;
  --text: #f5f5f5;
  --muted: #9ca3af;
  --border: rgba(255, 255, 255, 0.1);
  --bg: #0a0a0a;
}
```

### Adding Custom Actions

1. Add button in `admin.html`
2. Create handler function in `js/admin.js`
3. Add backend logic in `google-apps-script-admin.js` if needed

### Modifying Session Timeout

Edit `js/config.js`:
```javascript
ADMIN: {
  SESSION_TIMEOUT: 7200000, // Change this value (in milliseconds)
}
```

## 📞 Support

If you encounter issues:

1. Check browser console for errors (F12)
2. Review Vercel function logs
3. Check Apps Script execution logs
4. Verify all environment variables are set
5. Ensure Google Sheets are properly configured

## 🔐 Default Credentials (Development Only)

**⚠️ FOR TESTING ONLY - CHANGE IN PRODUCTION**

- Username: `admin`
- Password: `srt2026admin`

These are fallback values in the code. Always set proper credentials via environment variables in production.

## ✅ Checklist

Before going live, ensure:

- [ ] Changed default admin credentials
- [ ] Set strong JWT_SECRET
- [ ] Configured all environment variables in Vercel
- [ ] Updated Google Apps Script
- [ ] Tested login functionality
- [ ] Tested all CRUD operations
- [ ] Verified race sync works
- [ ] Exported test registration data
- [ ] Reviewed security settings
- [ ] Documented custom changes

## 🎉 You're All Set!

Your admin panel is now ready to use. Access it at:
- Login: `https://your-domain.com/login.html`
- Dashboard: `https://your-domain.com/admin.html` (requires login)

---

**Made with Bob** 🤖