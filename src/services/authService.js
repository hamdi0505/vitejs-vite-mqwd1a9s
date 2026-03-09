import { supabase } from "../lib/supabaseClient";

// Format im DB-Feld password_hash:
// pbkdf2$<iterations>$<saltBase64>$<hashBase64>
const PBKDF2_ITERATIONS = 120000;
const PBKDF2_HASH = "SHA-256";
const DERIVED_KEY_BITS = 256;

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pbkdf2(password, saltBytes, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations,
      hash: PBKDF2_HASH
    },
    keyMaterial,
    DERIVED_KEY_BITS
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashBytes = await pbkdf2(password, salt, PBKDF2_ITERATIONS);

  const saltB64 = toBase64(salt);
  const hashB64 = toBase64(hashBytes);

  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltB64}$${hashB64}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;

  const parts = storedHash.split("$");
  if (parts.length !== 4) return false;

  const [algo, iterStr, saltB64, hashB64] = parts;
  if (algo !== "pbkdf2") return false;

  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);

  const actual = await pbkdf2(password, salt, iterations);

  // timing-safe-ish compare
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function loginAdmin(username, password) {
  const { data, error } = await supabase
    .from("admin_accounts")
    .select("*")
    .eq("username", username)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, reason: "NOT_FOUND" };

  const row = data[0];
  const ok = await verifyPassword(password, row.password_hash);

  if (!ok) return { ok: false, reason: "WRONG_PASSWORD" };

  return {
    ok: true,
    role: "admin",
    adminId: row.id,
    username: row.username
  };
}

export async function loginWorker(username, password) {
  const { data, error } = await supabase
    .from("worker_accounts")
    .select("*")
    .eq("username", username)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, reason: "NOT_FOUND" };

  const row = data[0];

  // ✅ NEU: inaktiv -> kein Login
  if (row.is_active === false) {
    return { ok: false, reason: "INACTIVE" };
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return { ok: false, reason: "WRONG_PASSWORD" };

  return {
    ok: true,
    role: "worker",
    workerAccountId: row.id,
    workerId: row.worker_id,
    username: row.username
  };
}