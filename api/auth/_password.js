// api/auth/_password.js — primitive di hashing password CONDIVISE.
// Usato da login.js, manage.js, change-password.js per evitare logica duplicata.
//
// Tre formati supportati, in ordine di forza:
//   1) scrypt salato  → "scrypt$<saltHex>$<hashHex>"   (NUOVO, default per i nuovi hash)
//   2) SHA256 nudo     → 64 caratteri hex                (legacy intermedio)
//   3) base64          → tutto il resto                  (legacy storico)
//
// Verifica: accetta tutti e tre i formati. I formati 2 e 3 vengono migrati a
// scrypt al primo login (migrazione lazy), così il parco password si aggiorna
// senza forzare reset. La generazione produce SEMPRE scrypt.
import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;   // lunghezza hash in byte
const SCRYPT_SALTLEN = 16;  // 128 bit di salt random per utente
const SCRYPT_PREFIX = 'scrypt$';

// ── Hash scrypt (NUOVO formato) ───────────────────────────────────────────
// Ritorna "scrypt$<saltHex>$<hashHex>". Salt random per ogni password.
export function hashPasswordScrypt(password) {
  const salt = crypto.randomBytes(SCRYPT_SALTLEN);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `${SCRYPT_PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`;
}

// ── Formati legacy (solo per VERIFICA/migrazione, mai per nuovi hash) ───────
function hashSha256(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}
function hashBase64(password) {
  return Buffer.from(String(password)).toString('base64');
}
function isSha256Hash(hash) {
  return /^[0-9a-f]{64}$/.test(String(hash || ''));
}

// ── Verifica universale (timing-safe dove possibile) ────────────────────────
// Ritorna { ok, needsMigration }: needsMigration=true se la password era
// valida ma in un formato legacy (SHA256/base64) → il chiamante deve risalvare
// l'hash in scrypt.
export function verifyPassword(password, stored) {
  stored = String(stored || '');

  // 1) scrypt salato
  if (stored.startsWith(SCRYPT_PREFIX)) {
    const parts = stored.slice(SCRYPT_PREFIX.length).split('$');
    if (parts.length !== 2) return { ok: false, needsMigration: false };
    try {
      const salt = Buffer.from(parts[0], 'hex');
      const expected = Buffer.from(parts[1], 'hex');
      const actual = crypto.scryptSync(String(password), salt, expected.length);
      const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
      return { ok, needsMigration: false };
    } catch (e) {
      return { ok: false, needsMigration: false };
    }
  }

  // 2) SHA256 nudo (legacy) → valido ma da migrare
  if (isSha256Hash(stored)) {
    const ok = timingSafeStrEq(stored, hashSha256(password));
    return { ok, needsMigration: ok };
  }

  // 3) base64 (legacy storico) → valido ma da migrare
  const ok = timingSafeStrEq(stored, hashBase64(password));
  return { ok, needsMigration: ok };
}

// Confronto stringhe timing-safe (evita timing attack sul confronto hash).
function timingSafeStrEq(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
