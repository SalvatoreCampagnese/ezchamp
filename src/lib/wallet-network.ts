"use client";

import { CHAIN, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

/**
 * Whether the currently-connected wallet is on the chain EZChamp expects
 * (testnet for now). Returns:
 *   - { ok: true }                  → no wallet, or wallet matches
 *   - { ok: false, current: chain } → wallet on the wrong chain
 */
export function useWalletNetworkCheck(): { ok: true } | { ok: false; current: string } {
  const wallet = useTonWallet();
  if (!wallet) return { ok: true };
  const chain = wallet.account?.chain;
  if (!chain) return { ok: true };
  if (chain === CHAIN.TESTNET) return { ok: true };
  return { ok: false, current: chain === CHAIN.MAINNET ? "mainnet" : `chain ${chain}` };
}

/**
 * Convert raw TonConnect SDK errors / RPC errors into a short, user-friendly
 * sentence. Falls back to the original message when no rule matches.
 */
export function friendlyPaymentError(raw: string): string {
  if (/wrong network/i.test(raw)) {
    return "Your wallet is on mainnet — EZChamp runs on testnet. Disconnect, then reconnect a wallet that's set to testnet.";
  }
  if (/user (rejected|declined)/i.test(raw)) {
    return "You declined the transaction in your wallet. Tap to retry when ready.";
  }
  if (/timeout|expired/i.test(raw)) {
    return "The wallet didn't respond in time. Reopen it and confirm the transaction.";
  }
  if (/insufficient/i.test(raw)) {
    return "Not enough TON in the wallet to cover this entry. Top up and retry.";
  }
  return raw;
}

/**
 * Convenience: returns a hard-disconnect helper that fully clears TonConnect
 * state. Use it from "wrong network" UI to force the user to reconnect.
 */
export function useHardDisconnect() {
  const [tonConnectUI] = useTonConnectUI();
  return async () => {
    try { await tonConnectUI.disconnect(); } catch { /* noop */ }
  };
}
