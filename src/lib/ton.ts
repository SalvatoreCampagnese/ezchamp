"use client";

import { useTonConnectUI } from "@tonconnect/ui-react";

export const ESCROW = process.env.NEXT_PUBLIC_TON_ESCROW_ADDRESS ?? "";
export const NETWORK = process.env.NEXT_PUBLIC_TON_NETWORK ?? "testnet";
export const MIN_STAKE = Number(process.env.NEXT_PUBLIC_MIN_STAKE_TON ?? "0.5");
export const FEE_BPS = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? "500");

export function tonToNano(ton: number): string {
  return Math.floor(ton * 1e9).toString();
}

export function memoForMatch(matchId: string): string {
  return `EZC:${matchId}`;
}

/**
 * Convenience wrapper: requests the connected wallet to send `amount` TON to
 * the escrow with an `EZC:<matchId>` text comment.
 */
export function useSendStake() {
  const [tonConnectUI] = useTonConnectUI();
  return async (matchId: string, amountTon: number) => {
    if (!ESCROW) throw new Error("escrow not configured");
    const result = await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
      messages: [
        {
          address: ESCROW,
          amount: tonToNano(amountTon),
          payload: textCommentBoc(memoForMatch(matchId)),
        },
      ],
    });
    return result; // { boc: "..." }
  };
}

/**
 * Build a base64 text-comment payload (op=0, plain UTF-8 text).
 * TON expects: 4 bytes of zero op + UTF-8 bytes, framed as a Cell BoC.
 *
 * Implemented inline to avoid pulling @ton/core for the client bundle.
 */
function textCommentBoc(text: string): string {
  // Lazy-load @ton/core only here to keep initial bundle small.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { beginCell } = require("@ton/core");
  const cell = beginCell().storeUint(0, 32).storeStringTail(text).endCell();
  return cell.toBoc().toString("base64");
}
