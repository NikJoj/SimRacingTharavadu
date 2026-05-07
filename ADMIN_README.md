# 🔐 Admin Panel - Quick Reference

## Access Points

- **Login Page**: `/login.html`
- **Admin Dashboard**: `/admin.html` (requires authentication)

## Default Credentials (⚠️ CHANGE IMMEDIATELY)

```
Username: admin
Password: srt2026admin
```

## Quick Setup (3 Steps)

### 1. Set Environment Variables in Vercel

```bash
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_random_32char_secret
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### 2. Update Google Apps Script

1. Copy content from `google-apps-script-admin.js`
2. Paste into your Google Sheet's Apps Script (Extensions > Apps Script)
3. Deploy as Web App
4. Update `APPS_SCRIPT_URL` in `js/config.js`

### 3. Deploy to Vercel

```bash
vercel --prod
```

## Features

✅ **Event Management** - Create, edit, delete events  
✅ **League Management** - Manage championships and seasons  
✅ **Registration Management** - View, edit, export registrations  
✅ **Race Result Sync** - Sync from Assetto Corsa API to blob storage  
✅ **Dashboard** - Statistics and recent activity  
✅ **Secure Authentication** - Token-based with 2-hour sessions  

## File Structure

```
/login.html                      # Admin login page
/admin.html                      # Admin dashboard
/css/admin.css                   # Admin styles
/js/admin.js                     # Admin JavaScript
/api/admin-auth.js               # Authentication API
/google-apps-script-admin.js     # Apps Script (copy to Google Sheets)
/ADMIN_SETUP_GUIDE.md           # Detailed setup guide
```

## Important Security Notes

1. **Change default credentials immediately**
2. **Use strong passwords** (12+ characters, mixed case, numbers, symbols)
3. **Generate random JWT_SECRET** (32+ characters)
4. **Never commit credentials to Git**
5. **Use environment variables for all secrets**

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Can't login | Check environment variables in Vercel |
| Data not loading | Verify Google Sheets URLs and Apps Script deployment |
| Race sync fails | Check BLOB_READ_WRITE_TOKEN and league blob store name |
| Session expired | Login again (sessions last 2 hours) |

## API Endpoints

### Authentication
- `POST /api/admin-auth` - Login and token validation

### Race Sync
- `GET /api/store-latest-result?league=LEAGUE_NAME` - Sync race
- `GET /api/get-stored-result?league=LEAGUE_NAME` - Get races

### Apps Script (via APPS_SCRIPT_URL)
- `?action=getRegistrations` - Fetch registrations
- `action=createEvent` - Create event
- `action=updateEvent` - Update event
- `action=deleteEvent` - Delete event
- `action=createLeague` - Create league
- `action=updateLeague` - Update league
- `action=deleteLeague` - Delete league

## Google Sheets Structure

### Registrations Sheet
Required columns: `timestamp`, `driverTag`, `discord`, `carClass`, `event`, `league`, `type`

### Events Sheet
Required columns: `id`, `name`, `sim`, `status`, `track`, `startDate`, `endDate`, `format`, `drivers`, `maxDrivers`, `carOptions`

### League Sheet
Required columns: `id`, `name`, `sim`, `status`, `season`, `championshipId`, `blobStore`

## Usage Examples

### Sync Race Result
1. Go to Race Sync section
2. Select league from dropdown
3. Click "🔄 Sync Latest Race"
4. View result in sync history

### Create Event
1. Go to Events section
2. Click "➕ Create Event"
3. Fill form and save
4. Event appears in table

### Export Registrations
1. Go to Registrations section
2. Click "📥 Export CSV"
3. CSV downloads automatically

## Support

For detailed instructions, see `ADMIN_SETUP_GUIDE.md`

For issues:
1. Check browser console (F12)
2. Review Vercel function logs
3. Check Apps Script execution logs
4. Verify environment variables

---

**Made with Bob** 🤖