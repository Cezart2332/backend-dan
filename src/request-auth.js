import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) throw new Error("CRITICAL: JWT_SECRET is required");

function getAuthHeader(request) {
  return request.headers.authorization || request.headers.Authorization || "";
}

export function getBearerToken(request) {
  const authHeader = getAuthHeader(request);
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

export function verifyJwtToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function optionalAuth(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const decoded = verifyJwtToken(token);
  if (!decoded || !decoded.sub) return null;
  return decoded;
}

export function requireAuth(request) {
  const token = getBearerToken(request);
  if (!token) throw new Error("NO_AUTH");
  const decoded = verifyJwtToken(token);
  if (!decoded || !decoded.sub) throw new Error("BAD_TOKEN");
  return decoded;
}
