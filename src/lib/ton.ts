"use client";

import { CHAIN, useTonConnectUI } from "@tonconnect/ui-react";
import { Address } from "@ton/core";

export const ESCROW = process.env.NEXT_PUBLIC_TON_ESCROW_ADDRESS ?? "";
// Hard-coded to TESTNET for the entire app while we're pre-launch. Flip back
// to env-driven once we're ready for mainnet.
export const NETWORK: "testnet" | "mainnet" = "testnet";
export const MIN_STAKE = Number(process.env.NEXT_PUBLIC_MIN_STAKE_TON ?? "0.5");
export const FEE_BPS = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? "500");
// Fixed entry fee for the matchmaking queue (per team, per match).
// Default ≈ $5 worth of TON at the time of writing. Override via env.
export const ENTRY_FEE_TON = Number(process.env.NEXT_PUBLIC_ENTRY_FEE_TON ?? "1.0");

export function tonToNano(ton: number): string {
  return Math.floor(ton * 1e9).toString();
}

/**
 * True iff two TON addresses refer to the same account, regardless of which
 * surface form they're written in (raw `0:…`, bounceable `EQ…`,
 * non-bounceable `UQ…`, with or without the testOnly bit). Compares
 * workchain + 256-bit hash via @ton/core. Returns false for any unparseable
 * input — never throws.
 */
export function addressEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return Address.parse(a).equals(Address.parse(b));
  } catch {
    return false;
  }
}

/**
 * TonConnect accepts any valid address form, but on testnet a *bounceable*
 * (`EQ…`) destination triggers Tonkeeper's "we couldn't emulate the
 * transaction" warning when the receiver hasn't been touched on-chain yet
 * — the wallet thinks the message will bounce. Re-encode to the
 * non-bounceable form (`UQ…` / `0Q…`) so the wallet emulates cleanly and
 * stops scaring the user with a "Failed" button.
 */
export function normalizeReceiver(addr: string): string {
  if (!addr) return addr;
  try {
    return Address.parse(addr).toString({
      bounceable: false,
      testOnly: NETWORK === "testnet",
      urlSafe: true,
    });
  } catch {
    return addr;
  }
}

export function memoForMatch(matchId: string): string {
  return `EZC:${matchId}`;
}

export function memoForQueueEntry(entryId: string): string {
  return `EZQ:${entryId}`;
}

/**
 * Convenience wrapper: requests the connected wallet to send `amount` TON to
 * the escrow with an `EZC:<matchId>` text comment. Forced to TESTNET — the
 * wallet will reject the transaction if the user's account is on mainnet.
 */
export function useSendStake() {
  const [tonConnectUI] = useTonConnectUI();
  return async (matchId: string, amountTon: number) => {
    if (!ESCROW) throw new Error("escrow not configured");
    const result = await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
      network: CHAIN.TESTNET,
      messages: [
        {
          address: normalizeReceiver(ESCROW),
          amount: tonToNano(amountTon),
          payload: textCommentBoc(memoForMatch(matchId)),
        },
      ],
    });
    return result; // { boc: "..." }
  };
}

/**
 * Send the entry fee for a matchmaking queue entry. Same as `useSendStake` but
 * tags the payment with `EZQ:<entryId>` so the bot's payment sweeper can route
 * it to the queue table instead of the matches table.
 */
export function useSendEntryFee() {
  const [tonConnectUI] = useTonConnectUI();
  return async (entryId: string, amountTon: number) => {
    if (!ESCROW) throw new Error("escrow not configured");
    const result = await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600,
      network: CHAIN.TESTNET,
      messages: [
        {
          address: normalizeReceiver(ESCROW),
          amount: tonToNano(amountTon),
          payload: textCommentBoc(memoForQueueEntry(entryId)),
        },
      ],
    });
    return result;
  };
}

/**
 * Admin-only helper: send a payout from the connected escrow wallet.
 *
 * Returns the raw BOC string from the wallet, which the caller hands back
 * to the server's confirm endpoint. The server records it as the tx hash
 * for the audit trail. The caller must have already verified that the
 * connected wallet equals the escrow — this helper does NOT check.
 */
export function useSendPayout() {
  const [tonConnectUI] = useTonConnectUI();
  return async (recipient: string, amountTon: number, comment: string) => {
    const result = await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600,
      network: CHAIN.TESTNET,
      messages: [
        {
          // Recipient should be paid in non-bounceable form for the same
          // emulation reason as user stakes — a fresh winner wallet may
          // never have been touched on-chain.
          address: normalizeReceiver(recipient),
          amount: tonToNano(amountTon),
          payload: textCommentBoc(comment),
        },
      ],
    });
    return result; // { boc: "..." }
  };
}

/**
 * Build a base64 text-comment payload (op=0, plain UTF-8 text).
 * Implemented inline to avoid pulling @ton/core for the client bundle.
 */
function textCommentBoc(text: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { beginCell } = require("@ton/core");
  const cell = beginCell().storeUint(0, 32).storeStringTail(text).endCell();
  return cell.toBoc().toString("base64");
}
