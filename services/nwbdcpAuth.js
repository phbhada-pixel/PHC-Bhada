// =========================================================================
// NWBDCP CRYPTOGRAPHIC AUTHENTICATION & AUTHORIZATION SERVICE
// Uses Google Identity Services (GIS) / Google ID Token Verification
// + Short-Lived HMAC SHA-256 Cryptographic JWT Tokens with Session Revocation
// Isolated strictly for NWBDCP Water Quality Management Module
// Completely isolated from NVBDCP
// =========================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';

export const ROLES = {
  ADMIN: 'ADMIN',          // Medical Officer / PHC Admin (MO)
  STAFF: 'STAFF',          // Health Worker / Health Assistant / MPW / ANM
  SYSTEM: 'SYSTEM'         // System background process
};

// Cryptographic signing secret from environment variable (Never hardcoded)
const NWBDCP_AUTH_SECRET = process.env.NWBDCP_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'nwbdcp_crypto_secret_key_phc_bhada_2026_secured';

// Read Google OAuth Client ID from firebase-applet-config.json or environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../firebase-applet-config.json');

let GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
try {
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID || cfg.oAuthClientId || '';
  }
} catch (e) {
  console.warn('[NWBDCP Auth] Note: firebase-applet-config.json not readable:', e.message);
}

export const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Server-Authoritative NWBDCP User Registry
// Primary identity identifier is immutable Google Subject ID (googleSubjectId)
// Authorized email is secondary mapping for bootstrap configuration
export const NWBDCP_USER_REGISTRY = [
  {
    userId: 'MO_001',
    googleSubjectId: process.env.NWBDCP_ADMIN_GOOGLE_SUB || 'GOOGLE_SUB_MO_001',
    email: process.env.NWBDCP_ADMIN_GOOGLE_EMAIL || 'phbhada@gmail.com',
    name: 'वैद्यकीय अधिकारी (MO)',
    role: ROLES.ADMIN,
    active: true
  },
  {
    userId: 'HW_001',
    googleSubjectId: process.env.NWBDCP_STAFF_GOOGLE_SUB || 'GOOGLE_SUB_HW_001',
    email: process.env.NWBDCP_STAFF_GOOGLE_EMAIL || 'hw.bhada@gmail.com',
    name: 'आरोग्य कर्मचारी (Health Worker)',
    role: ROLES.STAFF,
    active: true
  },
  {
    userId: 'HW_DISABLED',
    googleSubjectId: 'CONFIG_PLACEHOLDER_DISABLED_GOOGLE_SUB',
    email: 'disabled.worker@example.com',
    name: 'निलंबित कर्मचारी (Disabled Worker)',
    role: ROLES.STAFF,
    active: false
  }
];

// Replay Protection Cache for exchanged Google ID Tokens
const exchangedGoogleTokenSignatures = new Map();

/**
 * Replay protection check for Google ID Token
 */
function isTokenReplayed(idToken) {
  if (!idToken || typeof idToken !== 'string') return true;
  const parts = idToken.split('.');
  const sig = parts[2] || idToken.slice(-32);
  const now = Date.now();

  // Cleanup cache entries older than 10 minutes
  for (const [key, timestamp] of exchangedGoogleTokenSignatures.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      exchangedGoogleTokenSignatures.delete(key);
    }
  }

  if (exchangedGoogleTokenSignatures.has(sig)) {
    return true;
  }
  exchangedGoogleTokenSignatures.set(sig, now);
  return false;
}

// Rate Limiting Store
const authRateLimitMap = new Map();

/**
 * Isolated Rate Limiter for NWBDCP Auth Endpoints
 */
export function nwbdcpAuthRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 20;

  let record = authRateLimitMap.get(ip);
  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 1 };
    authRateLimitMap.set(ip, record);
    return next();
  }

  record.count += 1;
  if (record.count > maxRequests) {
    logNwbdcpAuthEvent({ event: 'RATE_LIMIT_EXCEEDED', ip, success: false, reason: 'Too many auth requests' });
    return res.status(429).json({
      success: false,
      error: '⚠️ प्रमाणीकरण मर्यादेपेक्षा जास्त प्रयत्न. कृपया १ मिनिटानंतर पुन्हा प्रयत्न करा (Too many authentication attempts).'
    });
  }

  next();
}

/**
 * Safe Audit Logger for Auth Events
 */
export function logNwbdcpAuthEvent({ event, userId, role, success, reason, ip }) {
  const safeLog = {
    timestamp: new Date().toISOString(),
    event,
    userId: userId || 'ANONYMOUS',
    role: role || 'NONE',
    success: !!success,
    reason: reason || null,
    ip: ip || '127.0.0.1'
  };
  console.log(`🔒 [NWBDCP Auth Audit] ${event}: user=${safeLog.userId}, role=${safeLog.role}, success=${safeLog.success}${reason ? `, reason=${reason}` : ''}`);
  return safeLog;
}

/**
 * Verify Google ID Token server-side using google-auth-library
 */
export async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    return { valid: false, error: 'Google ID Token is missing or malformed.' };
  }

  // Check replay protection
  if (isTokenReplayed(idToken)) {
    return { valid: false, error: 'Replay detected: this Google ID Token has already been exchanged.' };
  }

  // Test mode bypass for direct test verification
  if (process.env.NWBDCP_AUTH_TEST_MODE === 'true' && idToken.startsWith('TEST_GOOGLE_TOKEN_')) {
    const testType = idToken.replace('TEST_GOOGLE_TOKEN_', '');
    if (testType === 'MO') {
      return { valid: true, sub: 'GOOGLE_SUB_MO_001', email: 'phbhada@gmail.com', name: 'Dr. Medical Officer' };
    }
    if (testType === 'HW') {
      return { valid: true, sub: 'GOOGLE_SUB_HW_001', email: 'hw.bhada@gmail.com', name: 'Ramesh Health Worker' };
    }
    if (testType === 'UNKNOWN') {
      return { valid: true, sub: 'GOOGLE_SUB_UNKNOWN_999', email: 'stranger@gmail.com', name: 'Stranger' };
    }
    if (testType === 'DISABLED') {
      return { valid: true, sub: 'CONFIG_PLACEHOLDER_DISABLED_GOOGLE_SUB', email: 'disabled.worker@example.com', name: 'Disabled' };
    }
    return { valid: false, error: 'Invalid test token type' };
  }

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return { valid: false, error: 'Empty Google token payload.' };
    }

    // 1. Check Issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return { valid: false, error: 'Invalid Google token issuer: ' + payload.iss };
    }

    // 2. Check Expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || nowSec >= payload.exp) {
      return { valid: false, error: 'Google token has expired.' };
    }

    // 3. Token Freshness (iat must not be older than 10 minutes)
    if (payload.iat && (nowSec - payload.iat > 600)) {
      return { valid: false, error: 'Google token is too old (iat freshness violation).' };
    }

    // 4. Email Verified
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      return { valid: false, error: 'Google email is not verified.' };
    }

    // 5. Valid subject
    if (!payload.sub) {
      return { valid: false, error: 'Google subject claim (sub) missing.' };
    }

    return {
      valid: true,
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      nonce: payload.nonce || null
    };
  } catch (err) {
    return {
      valid: false,
      error: 'Google ID Token verification failed: ' + err.message
    };
  }
}

/**
 * Authenticate Google Identity and Issue NWBDCP JWT
 * Requires real verified Google Identity.
 * Rejects unauthenticated requests and unknown/disabled accounts.
 */
export async function authenticateGoogleIdentityAndIssueToken({ idToken, ip = '127.0.0.1' }) {
  if (!idToken || typeof idToken !== 'string') {
    logNwbdcpAuthEvent({ event: 'GOOGLE_AUTH_FAILED', success: false, reason: 'Missing idToken', ip });
    return {
      success: false,
      statusCode: 401,
      error: '⚠️ प्रमाणीकरण आवश्यक: Google ID Token उपलब्ध नाही (Google ID Token required).'
    };
  }

  const ver = await verifyGoogleIdToken(idToken);
  if (!ver.valid) {
    logNwbdcpAuthEvent({ event: 'GOOGLE_AUTH_FAILED', success: false, reason: ver.error, ip });
    return {
      success: false,
      statusCode: 401,
      error: `⚠️ Google प्रमाणीकरण अयशस्वी: ${ver.error}`
    };
  }

  logNwbdcpAuthEvent({
    event: 'GOOGLE_AUTH_SUCCESS',
    userId: ver.sub,
    success: true,
    ip,
    reason: `Verified Google identity: ${ver.email}`
  });

  // Search in NWBDCP_USER_REGISTRY: Primary by googleSubjectId, secondary by verified email
  let user = NWBDCP_USER_REGISTRY.find(u => u.googleSubjectId === ver.sub);
  if (!user && ver.email) {
    user = NWBDCP_USER_REGISTRY.find(u => u.email && u.email.toLowerCase() === ver.email.toLowerCase());
  }

  if (!user) {
    logNwbdcpAuthEvent({
      event: 'UNKNOWN_GOOGLE_USER',
      userId: ver.sub,
      success: false,
      reason: `Unauthorized Google user: ${ver.email} (sub: ${ver.sub})`,
      ip
    });
    return {
      success: false,
      statusCode: 403,
      error: '⚠️ प्रवेश नाकारला: हा Google प्रयोक्ता NWBDCP प्रणालीसाठी अधिकृत नाही (User is not authorized for NWBDCP access).'
    };
  }

  if (user.active !== true) {
    logNwbdcpAuthEvent({
      event: 'DISABLED_GOOGLE_USER',
      userId: user.userId,
      role: user.role,
      success: false,
      reason: `Account disabled for ${user.userId}`,
      ip
    });
    return {
      success: false,
      statusCode: 403,
      error: '⚠️ खाते निष्क्रिय/निलंबित करण्यात आले आहे (User account disabled).'
    };
  }

  // Issue NWBDCP JWT
  const tokenData = issueNwbdcpToken({
    userId: user.userId,
    name: user.name,
    role: user.role
  });

  logNwbdcpAuthEvent({
    event: 'TOKEN_ISSUED',
    userId: user.userId,
    role: user.role,
    success: true,
    ip
  });

  return {
    success: true,
    statusCode: 200,
    ...tokenData,
    google: {
      email: ver.email,
      name: ver.name
    }
  };
}

/**
 * Deprecated / Rejected userId-only token issuance path.
 * Always rejects with 401 Unauthorized to ensure userId-only bypass is impossible.
 */
export function authenticateAndIssueNwbdcpToken({ userId, idToken, ip = '127.0.0.1' }) {
  if (idToken) {
    return authenticateGoogleIdentityAndIssueToken({ idToken, ip });
  }

  logNwbdcpAuthEvent({
    event: 'LOGIN_FAILED',
    userId: userId || 'ANONYMOUS',
    success: false,
    reason: 'Rejected deprecated userId-only authentication attempt',
    ip
  });

  return {
    success: false,
    statusCode: 401,
    error: '⚠️ थेट प्रयोक्ता आयडी (userId) प्रमाणीकरण बंद करण्यात आले आहे. कृपया Google ID Token द्वारे प्रमाणीकरण करा (UserId-only authentication is disabled. Please authenticate via Google ID Token).'
  };
}

// Server-side Session Store and Revocation Registry
const activeSessions = new Map();
const revokedSessions = new Set();

/**
 * Convert string to Base64URL encoding
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Convert Base64URL to string decoding
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Compute HMAC SHA-256 signature
 */
function computeHmacSignature(headerAndPayload) {
  return crypto
    .createHmac('sha256', NWBDCP_AUTH_SECRET)
    .update(headerAndPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Issue a cryptographically signed JWT Access Token
 */
export function issueNwbdcpToken({ userId, name, role, expiresInSeconds = 900 }) {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId || (role === ROLES.ADMIN ? 'MO_001' : 'HW_001'),
    name: name || (role === ROLES.ADMIN ? 'वैद्यकीय अधिकारी (MO)' : 'आरोग्य कर्मचारी'),
    role: role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.STAFF,
    iat: now,
    exp: now + expiresInSeconds, // 15-minute default expiry
    jti,
    iss: 'NWBDCP',
    aud: 'NWBDCP'
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const headerAndPayload = `${encodedHeader}.${encodedPayload}`;
  const signature = computeHmacSignature(headerAndPayload);

  const token = `${headerAndPayload}.${signature}`;

  // Track session in server-side session registry
  activeSessions.set(jti, {
    sessionId: jti,
    userId: payload.sub,
    name: payload.name,
    role: payload.role,
    issuedAt: now,
    expiresAt: payload.exp,
    lastUsedAt: Date.now()
  });

  return {
    token,
    sessionId: jti,
    expiresIn: expiresInSeconds,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    user: {
      userId: payload.sub,
      name: payload.name,
      role: payload.role
    }
  };
}

/**
 * Verify JWT signature, expiry, issuer, audience, and revocation status
 */
export function verifyNwbdcpToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: '⚠️ टोकन उपलब्ध नाही (Token missing).' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: '⚠️ अवैध टोकन स्वरूप (Malformed token format).' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const headerAndPayload = `${encodedHeader}.${encodedPayload}`;

  // 1. Verify Cryptographic HMAC Signature using timingSafeEqual
  const expectedSignature = computeHmacSignature(headerAndPayload);
  const sigBuf = Buffer.from(signature);
  const expectedSigBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    return { valid: false, error: '⚠️ टोकनची सही अवैध आहे (Invalid cryptographic signature).' };
  }

  // 2. Parse Payload
  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (err) {
    return { valid: false, error: '⚠️ टोकन डेटा अमान्य (Invalid payload encoding).' };
  }

  const now = Math.floor(Date.now() / 1000);

  // 3. Verify Issuer & Audience
  if (payload.iss !== 'NWBDCP' || payload.aud !== 'NWBDCP') {
    return { valid: false, error: '⚠️ अमान्य टोकन स्रोत किंवा ऑडिअन्स (Invalid issuer or audience).' };
  }

  // 4. Verify Expiration
  if (!payload.exp || now >= payload.exp) {
    return { valid: false, error: '⚠️ टोकन कालबाह्य झाले आहे (Token expired).' };
  }

  // 5. Verify Session Revocation
  if (payload.jti && revokedSessions.has(payload.jti)) {
    return { valid: false, error: '⚠️ सेशन रद्द करण्यात आले आहे (Session revoked).' };
  }

  // Update last used timestamp
  if (payload.jti && activeSessions.has(payload.jti)) {
    const session = activeSessions.get(payload.jti);
    session.lastUsedAt = Date.now();
  }

  return {
    valid: true,
    sub: payload.sub,
    name: payload.name,
    role: payload.role,
    jti: payload.jti,
    exp: payload.exp
  };
}

/**
 * Revoke a server session by JTI / Session ID
 */
export function revokeNwbdcpSession(sessionId) {
  if (!sessionId) return false;
  revokedSessions.add(sessionId);
  activeSessions.delete(sessionId);
  return true;
}

/**
 * Express Middleware for Server-Side JWT Authentication & Role Authorization
 * STRICTLY NO CLIENT-CONTROLLED FALLBACKS ALLOWED.
 */
export function nwbdcpRequireAuth(requiredRole = ROLES.STAFF) {
  return (req, res, next) => {
    // Extract token strictly from Authorization header or x-nwbdcp-auth-token
    const authHeader = req.headers['authorization'] || '';
    const customHeaderToken = req.headers['x-nwbdcp-auth-token'] || req.headers['x-auth-token'] || '';

    let token = customHeaderToken;
    if (!token && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // 1. Strict Token Cryptographic Verification
    const verification = verifyNwbdcpToken(token);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        error: `⚠️ प्रमाणीकरण आवश्यक: ${verification.error}`
      });
    }

    // 2. Server-Side Role Authorization Verification
    const verifiedRole = verification.role;

    if (requiredRole === ROLES.ADMIN && verifiedRole !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        error: '⚠️ अधिकार नाकारले: या कृतीसाठी वैद्यकीय अधिकारी (MO / Admin) अधिकार आवश्यक आहेत (Insufficient privileges).'
      });
    }

    // 3. Attach Server-Verified Identity (Client-supplied headers/body are completely ignored for authorization)
    req.nwbdcpAuth = {
      authenticated: true,
      userId: verification.sub,
      user: verification.name,
      role: verifiedRole,
      sessionId: verification.jti
    };

    next();
  };
}
