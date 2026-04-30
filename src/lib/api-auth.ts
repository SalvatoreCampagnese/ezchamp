import { NextResponse, type NextRequest } from "next/server";
import { verifyInitData, type TelegramUser } from "./auth";
import { db } from "./supabase";

export interface AppUser {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  wallet_address: string | null;
  current_game_id: string | null;
}

/**
 * Pull initData from the X-Telegram-Init-Data header, verify it, and return
 * (or upsert) the matching user row.
 */
export async function authenticate(req: NextRequest): Promise<AppUser> {
  const initData = req.headers.get("x-telegram-init-data") ?? "";
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) throw new Error("BOT_TOKEN not configured");

  const { user: tg } = verifyInitData(initData, botToken);

  const { data, error } = await db
    .from("users")
    .upsert(
      {
        telegram_id: tg.id,
        telegram_username: tg.username ?? null,
      },
      { onConflict: "telegram_id" },
    )
    .select("id, telegram_id, telegram_username, wallet_address, current_game_id")
    .single();
  if (error) throw error;
  return data as AppUser;
}

export function isAdmin(telegramId: number): boolean {
  const ids = (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(telegramId));
}

export function authError(err: unknown): NextResponse {
  const msg = (err as Error)?.message ?? "auth_failed";
  return NextResponse.json({ error: msg }, { status: 401 });
}

/**
 * Wrap a handler with authentication. The handler receives the resolved AppUser.
 */
export function withAuth<T>(
  handler: (req: NextRequest, user: AppUser, ctx: T) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx: T): Promise<NextResponse> => {
    let user: AppUser;
    try {
      user = await authenticate(req);
    } catch (e) {
      return authError(e);
    }
    try {
      return await handler(req, user, ctx);
    } catch (e) {
      const msg = (e as Error).message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  };
}
