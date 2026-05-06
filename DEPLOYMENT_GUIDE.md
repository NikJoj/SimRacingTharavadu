# 🚀 Deployment Guide - Serverless API Setup

This guide will help you deploy your SimRacingTharavadu website with serverless API functions to Vercel.

## 📋 Prerequisites

- GitHub account
- Vercel account (free) - [Sign up here](https://vercel.com/signup)
- Your code pushed to GitHub repository

## 🎯 Quick Start (5 minutes)

### Step 1: Push Code to GitHub

```bash
# If not already done
git add .
git commit -m "Add serverless API functions"
git push origin main
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. Click **"Import Git Repository"**
4. Select your `SimRacingTharavadu` repository
5. Vercel will auto-detect the configuration
6. Click **"Deploy"**

That's it! ✅

### Step 3: Your Site is Live

After deployment (takes ~1 minute), you'll get:
- **Frontend:** `https://your-project.vercel.app`
- **API Endpoints:**
  - `https://your-project.vercel.app/api/standings`
  - `https://your-project.vercel.app/api/championships`
  - `https://your-project.vercel.app/api/live-leaderboard`
  - `https://your-project.vercel.app/api/live-basic`
  - `https://your-project.vercel.app/api/results`

## 🔧 Configuration

### Update Championship ID (if needed)

Edit `js/config.js`:
```javascript
ASSETTO_CHAMPIONSHIP_ID: "your-championship-id-here"
```

Then redeploy:
```bash
git add js/config.js
git commit -m "Update championship ID"
git push origin main
```

Vercel will automatically redeploy! 🎉

## 🧪 Testing Your API

### Test in Browser
Open these URLs in your browser:
```
https://your-project.vercel.app/api/standings?championshipId=1bb2f11c-d4db-45e8-9505-97cd6ec1e806
https://your-project.vercel.app/api/championships
```

### Test with cURL
```bash
curl https://your-project.vercel.app/api/standings?championshipId=YOUR_ID
```

### Test with JavaScript
```javascript
fetch('https://your-project.vercel.app/api/standings?championshipId=YOUR_ID')
  .then(res => res.json())
  .then(data => console.log(data));
```

## 🏠 Local Development

### Option 1: Using Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Run development server:**
   ```bash
   vercel dev
   ```

3. **Access locally:**
   - Frontend: `http://localhost:3000`
   - API: `http://localhost:3000/api/standings`

### Option 2: Simple HTTP Server (Frontend Only)

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -p 8000
```

**Note:** API functions won't work with simple HTTP server. Use Vercel CLI for full functionality.

## 📁 Project Structure

```
SimRacingTharavadu/
├── api/                          ← Serverless functions
│   ├── standings.js              ← Championship standings
│   ├── championships.js          ← List championships
│   ├── live-leaderboard.js       ← Live timing
│   ├── live-basic.js             ← Basic live info
│   ├── results.js                ← Race results
│   └── README.md                 ← API documentation
├── js/                           ← Frontend JavaScript
│   ├── config.js                 ← Updated with API endpoints
│   ├── leaderboard.js            ← Updated to use serverless API
│   └── ...
├── css/                          ← Stylesheets
├── index.html                    ← Main page
├── vercel.json                   ← Vercel configuration
└── DEPLOYMENT_GUIDE.md           ← This file
```

## 🔄 Continuous Deployment

Every time you push to GitHub, Vercel automatically:
1. Detects the changes
2. Builds your project
3. Deploys the new version
4. Updates your live site

**No manual deployment needed!** 🎉

## 🌐 Custom Domain (Optional)

### Add Your Own Domain

1. Go to your project in Vercel dashboard
2. Click **"Settings"** → **"Domains"**
3. Add your domain (e.g., `simracingtharavadu.com`)
4. Follow DNS configuration instructions
5. Done! Your site will be available at your custom domain

## 📊 Monitoring

### View Logs
1. Go to Vercel dashboard
2. Select your project
3. Click **"Functions"** tab
4. View real-time logs and errors

### Check Performance
- Vercel provides analytics for free
- Monitor API response times
- Track bandwidth usage

## 🐛 Troubleshooting

### API Returns 404
**Problem:** API endpoints not found  
**Solution:** 
- Ensure `vercel.json` is in root directory
- Check `api/` folder exists with `.js` files
- Redeploy: `git push origin main`

### API Returns 500
**Problem:** Server error  
**Solution:**
- Check Vercel function logs
- Verify Assetto Corsa server is online
- Test championship ID is correct

### CORS Errors
**Problem:** Still seeing CORS errors  
**Solution:**
- Ensure you're using `/api/...` endpoints, not direct Assetto URLs
- Check `js/config.js` has `USE_CORS_PROXY: false`
- Clear browser cache

### Local Development Not Working
**Problem:** `vercel dev` fails  
**Solution:**
```bash
# Reinstall Vercel CLI
npm uninstall -g vercel
npm install -g vercel

# Login again
vercel login

# Try again
vercel dev
```

## 💰 Pricing

### Vercel Free Tier Includes:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Serverless functions
- ✅ Automatic HTTPS
- ✅ Custom domains
- ✅ Analytics

**Perfect for your racing league site!** 🏎️

### When to Upgrade:
- If you exceed 100GB bandwidth/month
- If you need team collaboration features
- If you want advanced analytics

## 🔐 Environment Variables (Advanced)

If you need to store sensitive data:

1. Go to Vercel dashboard → Project → **Settings** → **Environment Variables**
2. Add variables (e.g., API keys)
3. Access in functions:
   ```javascript
   const apiKey = process.env.API_KEY;
   ```

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Serverless Functions Guide](https://vercel.com/docs/functions)
- [API Documentation](./api/README.md)
- [Assetto Corsa API Wiki](https://wiki.emperorservers.com/assetto-corsa-server-manager/web-api)

## 🎉 Success Checklist

- [ ] Code pushed to GitHub
- [ ] Deployed to Vercel
- [ ] Frontend loads correctly
- [ ] API endpoints return data
- [ ] Leaderboard displays championship standings
- [ ] No CORS errors in browser console
- [ ] Custom domain configured (optional)

## 🆘 Need Help?

1. Check [api/README.md](./api/README.md) for API documentation
2. Review Vercel function logs
3. Test API endpoints directly in browser
4. Check browser console for errors

---

**Congratulations!** 🎊 Your racing league website is now live with a serverless backend!

Made with ❤️ for SimRacingTharavadu