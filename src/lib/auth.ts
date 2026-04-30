import crypto from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
  raw: string;
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // reject anything older than 24h

/**
 * Verify Telegram WebApp initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Throws if the signature is invalid or the data is too old.
 */
export function verifyInitData(initData: string, botToken: string): VerifiedInitData {
  if (!initData) throw new Error("missing_init_data");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("missing_hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computed !== hash) throw new Error("bad_signature");

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) throw new Error("missing_auth_date");
  if (Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) throw new Error("init_data_expired");

  const userJson = params.get("user");
  if (!userJson) throw new Error("missing_user");
  const user = JSON.parse(userJson) as TelegramUser;

  return { user, authDate, raw: initData };
}
