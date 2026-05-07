# Poster Sync to GitHub - Setup Guide

This guide explains how to set up the automatic poster sync feature that uploads event and league posters directly to your GitHub repository when creating or updating them via the admin dashboard.

## 🎯 Overview

When you create or edit an event/league in the admin dashboard, you can now upload a poster image that will be automatically synced to your GitHub repository with the correct filename:
- **Events**: `poster<id>.png` (e.g., poster1.png, poster2.png)
- **Leagues**: `leaguePoster<id>.png` (e.g., leaguePoster1.png, leaguePoster2.png)

## 📋 Prerequisites

1. A GitHub account with access to your repository
2. Your repository deployed on Vercel
3. Admin access to Vercel project settings

## 🔧 Setup Steps

### Quick Setup (Automated) ⚡

If you have Vercel CLI installed, you can use our automated setup script:

```bash
# Make sure you're logged in to Vercel
vercel login

# Run the automated setup
npm run setup:github
```

The script will:
- ✅ Guide you through entering your GitHub credentials
- ✅ Automatically set all required environment variables in Vercel
- ✅ Configure for production, preview, and development environments
- ✅ Validate your inputs

**Requirements:**
- Vercel CLI installed (`npm install -g vercel`)
- Logged in to Vercel (`vercel login`)
- GitHub Personal Access Token (see Step 1 below)

---

### Manual Setup (Step-by-Step) 📝

If you prefer manual setup or the automated script doesn't work, follow these steps:

### Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Direct link: https://github.com/settings/tokens

2. Click **"Generate new token"** → **"Generate new token (classic)"**

3. Configure the token:
   - **Note**: `SimRacingTharavadu Poster Sync`
   - **Expiration**: Choose your preferred expiration (recommend: No expiration or 1 year)
   - **Scopes**: Select **`repo`** (Full control of private repositories)
     - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`

4. Click **"Generate token"**

5. **IMPORTANT**: Copy the token immediately (it starts with `ghp_`)
   - You won't be able to see it again!
   - Store it securely

### Step 2: Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
   - URL: https://vercel.com/your-username/sim-racing-tharavadu

2. Navigate to **Settings** → **Environment Variables**

3. Add the following environment variables:

   | Variable Name | Value | Environment |
   |--------------|-------|-------------|
   | `GITHUB_TOKEN` | `ghp_your_token_here` | Production, Preview, Development |
   | `GITHUB_OWNER` | Your GitHub username | Production, Preview, Development |
   | `GITHUB_REPO` | `SimRacingTharavadu` | Production, Preview, Development |
   | `GITHUB_BRANCH` | `main` | Production, Preview, Development |

   **Example values:**
   ```
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   GITHUB_OWNER=yourusername
   GITHUB_REPO=SimRacingTharavadu
   GITHUB_BRANCH=main
   ```

4. Click **"Save"** for each variable

### Step 3: Redeploy Your Application

After adding environment variables, you need to redeploy:

1. Go to **Deployments** tab in Vercel
2. Click the **"..."** menu on the latest deployment
3. Select **"Redeploy"**
4. Wait for deployment to complete

## ✅ Testing the Feature

### Test Event Poster Upload

1. Log in to your admin dashboard
2. Navigate to **Events** section
3. Click **"Create Event"**
4. Fill in all required fields
5. In the **"Event Poster"** field:
   - Click **"Choose File"**
   - Select a PNG or JPG image (max 5MB)
   - You'll see a preview of the image
6. Click **"Save Event"**
7. Wait for the success message
8. Check your GitHub repository - you should see a new file `poster<id>.png`

### Test League Poster Upload

1. Navigate to **Leagues** section
2. Click **"Create League"**
3. Fill in all required fields
4. In the **"League Poster"** field:
   - Click **"Choose File"**
   - Select a PNG or JPG image (max 5MB)
   - You'll see a preview of the image
5. Click **"Save League"**
6. Wait for the success message
7. Check your GitHub repository - you should see a new file `leaguePoster<id>.png`

## 🔍 Verification

After uploading a poster, verify it was synced:

1. Go to your GitHub repository: `https://github.com/yourusername/SimRacingTharavadu`
2. Look for the new poster file in the root directory
3. Click on the file to view it
4. Check the commit history to see the automated commit message

## 🐛 Troubleshooting

### Issue: "Failed to sync poster to GitHub"

**Possible causes:**
1. **Invalid GitHub Token**
   - Verify the token is correct in Vercel environment variables
   - Check if the token has expired
   - Ensure the token has `repo` scope

2. **Wrong Repository Information**
   - Verify `GITHUB_OWNER` matches your GitHub username exactly
   - Verify `GITHUB_REPO` matches your repository name exactly
   - Check for typos

3. **Network Issues**
   - Try again after a few moments
   - Check Vercel function logs for detailed error messages

### Issue: "Image size must be less than 5MB"

**Solution:**
- Compress your image using tools like:
  - TinyPNG: https://tinypng.com/
  - Squoosh: https://squoosh.app/
  - ImageOptim (Mac): https://imageoptim.com/

### Issue: Poster uploaded but event/league not saved

**Possible causes:**
- Google Sheets API issue
- Network timeout

**Solution:**
1. Check if the event/league was created in Google Sheets
2. If yes, the poster should be in GitHub
3. If no, try creating again

### Viewing Logs

To see detailed error logs:

1. Go to Vercel Dashboard → Your Project
2. Click on **"Logs"** or **"Functions"**
3. Look for `/api/sync-poster` function logs
4. Check for error messages

## 📝 Important Notes

### File Naming Convention

- **Events**: Always use `poster<id>.png` format
  - Example: `poster1.png`, `poster2.png`, `poster3.png`
  
- **Leagues**: Always use `leaguePoster<id>.png` format
  - Example: `leaguePoster1.png`, `leaguePoster2.png`

### Supported Image Formats

- PNG (recommended)
- JPG/JPEG
- Maximum file size: 5MB

### Updating Existing Posters

When editing an event/league:
1. The poster field is optional
2. Leave it empty to keep the existing poster
3. Upload a new image to replace the existing poster
4. The old poster will be overwritten in GitHub

### GitHub Commit Messages

Automated commits will have messages like:
- `Add poster1.png for event via admin dashboard`
- `Add leaguePoster2.png for league via admin dashboard`
- `Update poster3.png for event via admin dashboard`

## 🔒 Security Best Practices

1. **Never commit your GitHub token to the repository**
   - Always use Vercel environment variables
   - Never hardcode tokens in your code

2. **Use token with minimal required permissions**
   - Only `repo` scope is needed
   - Don't grant unnecessary permissions

3. **Rotate tokens periodically**
   - Generate new tokens every 6-12 months
   - Update Vercel environment variables when rotating

4. **Monitor repository activity**
   - Check GitHub commit history regularly
   - Review automated commits for any anomalies

## 📚 Additional Resources

- [GitHub Personal Access Tokens Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [GitHub Contents API Documentation](https://docs.github.com/en/rest/repos/contents)

## 🆘 Support

If you encounter issues not covered in this guide:

1. Check Vercel function logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a small image file first
4. Ensure your GitHub token hasn't expired

## ✨ Feature Summary

- ✅ Automatic poster upload to GitHub
- ✅ Proper file naming based on ID
- ✅ Image preview before upload
- ✅ File size validation (max 5MB)
- ✅ Format validation (PNG/JPG only)
- ✅ Automatic commit with descriptive message
- ✅ Support for both create and update operations
- ✅ Error handling with user-friendly messages

---

**Last Updated**: 2026-05-07
**Version**: 1.0.0