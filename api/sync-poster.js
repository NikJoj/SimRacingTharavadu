/**
 * Serverless Function: Sync Poster to GitHub
 * Uploads/updates poster images directly to GitHub repository
 * 
 * Usage: POST /api/sync-poster
 * Body: { 
 *   filename: "poster1.png" or "leaguePoster1.png",
 *   content: "base64-encoded-image-data",
 *   message: "Add poster1.png"
 * }
 * 
 * Environment Variables Required:
 * - GITHUB_TOKEN: Personal access token with repo scope
 * - GITHUB_OWNER: Repository owner username
 * - GITHUB_REPO: Repository name
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, content, message } = req.body;

  // Validate required parameters
  if (!filename || !content) {
    return res.status(400).json({
      error: 'Missing required parameters',
      usage: 'POST /api/sync-poster with body: { filename: "poster1.png", content: "base64...", message: "..." }'
    });
  }

  // Validate filename format
  const validFilenamePattern = /^(poster\d+|leaguePoster\d+)\.png$/;
  if (!validFilenamePattern.test(filename)) {
    return res.status(400).json({
      error: 'Invalid filename format',
      expected: 'poster<id>.png or leaguePoster<id>.png (e.g., poster1.png, leaguePoster2.png)'
    });
  }

  // Get GitHub credentials from environment variables
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-username';
  const GITHUB_REPO = process.env.GITHUB_REPO || 'SimRacingTharavadu';
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

  if (!GITHUB_TOKEN) {
    return res.status(500).json({
      error: 'GitHub token not configured',
      message: 'Please set GITHUB_TOKEN environment variable in Vercel'
    });
  }

  try {
    // Step 1: Check if file exists and get its SHA (required for updates)
    let existingSha = null;
    const getFileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;
    
    try {
      const getResponse = await fetch(getFileUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SimRacingTharavadu-Admin'
        }
      });

      if (getResponse.ok) {
        const fileData = await getResponse.json();
        existingSha = fileData.sha;
      }
    } catch (err) {
      // File doesn't exist, which is fine for new files
      console.log('File does not exist yet, will create new file');
    }

    // Step 2: Create or update the file
    const commitMessage = message || `${existingSha ? 'Update' : 'Add'} ${filename} via admin dashboard`;
    
    const updatePayload = {
      message: commitMessage,
      content: content, // Already base64 encoded
      branch: GITHUB_BRANCH
    };

    // Include SHA if updating existing file
    if (existingSha) {
      updatePayload.sha = existingSha;
    }

    const updateResponse = await fetch(getFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'SimRacingTharavadu-Admin'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(errorData.message || 'Failed to sync to GitHub');
    }

    const result = await updateResponse.json();

    return res.status(200).json({
      success: true,
      message: `Successfully ${existingSha ? 'updated' : 'created'} ${filename}`,
      commit: {
        sha: result.commit.sha,
        url: result.commit.html_url,
        message: commitMessage
      },
      file: {
        name: filename,
        url: result.content.html_url,
        download_url: result.content.download_url
      }
    });

  } catch (error) {
    console.error('GitHub sync error:', error);
    return res.status(500).json({
      error: 'Failed to sync poster to GitHub',
      message: error.message,
      details: 'Check server logs for more information'
    });
  }
}

// Made with Bob
