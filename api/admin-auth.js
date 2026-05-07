/**
 * Serverless Function: Admin Authentication
 * Simple authentication endpoint for admin backdoor login
 * 
 * Environment Variables Required:
 * - ADMIN_USERNAME: Admin username
 * - ADMIN_PASSWORD: Admin password (plain text for simplicity, consider hashing in production)
 * - JWT_SECRET: Secret key for token generation
 * 
 * Usage: POST /api/admin-auth with { username, password }
 */

import crypto from 'crypto';

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

  try {
    const { username, password, action } = req.body;

    // Validate token action
    if (action === 'validate') {
      const { token } = req.body;
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      try {
        const decoded = verifyToken(token);
        return res.status(200).json({ 
          valid: true, 
          username: decoded.username,
          expiresAt: decoded.exp 
        });
      } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    // Login action
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Get credentials from environment variables
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'srt2026admin';

    // Verify credentials
    if (username === adminUsername && password === adminPassword) {
      // Generate token
      const token = generateToken(username);
      
      return res.status(200).json({
        success: true,
        token,
        username,
        expiresIn: 7200 // 2 hours in seconds
      });
    }

    // Invalid credentials
    return res.status(401).json({ error: 'Invalid credentials' });

  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
}

/**
 * Generate a simple JWT-like token
 */
function generateToken(username) {
  const secret = process.env.JWT_SECRET || 'srt-admin-secret-key-2026';
  const expiresAt = Date.now() + (2 * 60 * 60 * 1000); // 2 hours
  
  const payload = {
    username,
    exp: expiresAt,
    iat: Date.now()
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64');

  return `${payloadB64}.${signature}`;
}

/**
 * Verify token
 */
function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'srt-admin-secret-key-2026';
  const [payloadB64, signature] = token.split('.');

  if (!payloadB64 || !signature) {
    throw new Error('Invalid token format');
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64');

  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  // Decode payload
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());

  // Check expiration
  if (payload.exp < Date.now()) {
    throw new Error('Token expired');
  }

  return payload;
}

// Made with Bob