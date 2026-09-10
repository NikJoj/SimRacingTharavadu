/**
 * API: Sync Poster to GitHub
 * Uploads or updates a poster image in the GitHub repository via the GitHub Contents API.
 * Called from the admin dashboard when a new poster is uploaded.
 *
 * POST /api/sync-poster
 * Body: {
 *   filename: "poster1.png" | "leaguePoster1.png",
 *   content:  "<base64-encoded image data>",
 *   message?: "commit message"
 * }
 *
 * Environment variables required:
 *   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (optional, default: main)
 */

import { app } from '@azure/functions';

app.http('sync-poster', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    const body = await request.json();
    const { filename, content, message } = body;

    if (!filename || !content) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required parameters',
          usage: 'POST /api/sync-poster with body: { filename: "poster1.png", content: "base64...", message?: "..." }'
        }
      };
    }

    // Validate filename: poster<n>.png or leaguePoster<n>.png only
    if (!/^(poster\d+|leaguePoster\d+)\.png$/.test(filename)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid filename format', expected: 'poster<N>.png or leaguePoster<N>.png' }
      };
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO || 'SimRacingTharavadu';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

    if (!GITHUB_TOKEN) {
      return { status: 500, jsonBody: { error: 'GITHUB_TOKEN not configured' } };
    }

    try {
      const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;
      const headers = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SimRacingTharavadu-Admin'
      };

      // Check if file exists to get its SHA (required for updates)
      let existingSha = null;
      try {
        const getRes = await fetch(fileUrl, { headers });
        if (getRes.ok) {
          existingSha = (await getRes.json()).sha;
        }
      } catch {
        // File doesn't exist yet — that's fine
      }

      const commitMessage = message || `${existingSha ? 'Update' : 'Add'} ${filename} via admin dashboard`;
      const payload = { message: commitMessage, content, branch: GITHUB_BRANCH };
      if (existingSha) payload.sha = existingSha;

      const updateRes = await fetch(fileUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        throw new Error(err.message || 'GitHub API request failed');
      }

      const result = await updateRes.json();
      return {
        status: 200,
        jsonBody: {
          success: true,
          message: `Successfully ${existingSha ? 'updated' : 'created'} ${filename}`,
          commit: { sha: result.commit.sha, url: result.commit.html_url, message: commitMessage },
          file: { name: filename, url: result.content.html_url, download_url: result.content.download_url }
        }
      };

    } catch (error) {
      context.error('GitHub sync error:', error);
      return { status: 500, jsonBody: { error: 'Failed to sync poster to GitHub', message: error.message } };
    }
  }
});
