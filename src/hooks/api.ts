"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Game { id: string; slug: string; name: string }
export interface Rule { id: string; game_id: string; name: string; description: string | null }
export interface Team { id: string; name: string; game_id: string; owner_user_id: string; invite_code: string }
export interface TeamMember { team_id: string; user_id: string; role: string; user: { id: string; telegram_id: number; telegram_username: string | null } }
export interface User { id: string; telegram_id: number; telegram_username: string | null; wallet_address: string | null; current_game_id: string | null }
export interface MatchSummary {
  id: string; game_id: string; status: string;
  players_per_side: number; best_of: number; stake_ton: string;
  poster_team_id: string; accepter_team_id: string | null;
  poster_user_id: string; accepter_user_id: string | null;
  poster_paid_tx_hash: string | null;
  winner_team_id: string | null;
  result_deadline_at: string | null;
  created_at: string;
  poster_team?: { id: string; name: string };
  accepter_team?: { id: string; name: string } | null;
  rule?: { id: string; name: string };
}

export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/api/me"),
    select: (d) => d.user,
  });

export const useUpdateMe = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { wallet_address?: string | null; current_game_id?: string | null }) =>
      api<{ user: User }>("/api/me", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
};

export const useGames = () =>
  useQuery({
    queryKey: ["games"],
    queryFn: () => api<{ games: Game[] }>("/api/games"),
    select: (d) => d.games,
  });

export const useRules = (gameId: string | null) =>
  useQuery({
    queryKey: ["rules", gameId],
    enabled: !!gameId,
    queryFn: () => api<{ rules: Rule[] }>(`/api/games/${gameId}/rules`),
    select: (d) => d.rules,
  });

export const useTeam = (gameId: string | null) =>
  useQuery({
    queryKey: ["team", gameId],
    enabled: !!gameId,
    queryFn: () =>
      api<{ team: Team | null; members: TeamMember[] }>(`/api/teams?game_id=${gameId}`),
  });

export const useCreateTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; game_id: string }) =>
      api<{ team: Team }>("/api/teams", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
};

export const useJoinTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) =>
      api<{ team: Team }>("/api/teams/join", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
};

export const useOpenMatches = (gameId: string | null) =>
  useQuery({
    queryKey: ["matches", "open", gameId],
    enabled: !!gameId,
    queryFn: () =>
      api<{ matches: MatchSummary[] }>(`/api/matches?game_id=${gameId}`),
    select: (d) => d.matches,
    refetchInterval: 10_000,
  });

export const useMyMatches = () =>
  useQuery({
    queryKey: ["matches", "mine"],
    queryFn: () => api<{ matches: MatchSummary[] }>("/api/my-matches"),
    select: (d) => d.matches,
    refetchInterval: 10_000,
  });

export const useMatch = (id: string) =>
  useQuery({
    queryKey: ["match", id],
    queryFn: () => api<{ match: MatchSummary }>(`/api/matches/${id}`),
    select: (d) => d.match,
    refetchInterval: 5_000,
  });

export const useCreateMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      game_id: string; rules_id: string;
      players_per_side: number; best_of: number; stake_ton: number;
    }) => api<{ match: MatchSummary }>("/api/matches", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
};

export const useReportResult = (matchId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (winner_team_id: string) =>
      api<{ result: { new_status: string; winner_team_id: string | null } }>(
        `/api/matches/${matchId}/result`,
        { method: "POST", body: JSON.stringify({ winner_team_id }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match", matchId] }),
  });
};

export interface QueueEntry {
  id: string;
  team_id: string;
  user_id: string;
  game_id: string;
  rules_id: string;
  players_per_side: number;
  best_of: number;
  entry_fee_ton: string;
  paid_tx_hash: string | null;
  status: "pending_payment" | "queued" | "matched" | "cancelled" | "expired" | "refunded";
  matched_at: string | null;
  match_id: string | null;
  created_at: string;
  rule?: { id: string; name: string };
  game?: { id: string; slug: string; name: string };
}

export const useMyQueueEntry = () =>
  useQuery({
    queryKey: ["queue", "me"],
    queryFn: () => api<{ entry: QueueEntry | null }>("/api/queue/me"),
    select: (d) => d.entry,
    refetchInterval: 4_000,
  });

export const useJoinQueue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      game_id: string;
      rules_id: string;
      players_per_side: number;
      best_of: number;
      entry_fee_ton: number;
    }) =>
      api<{ entry: QueueEntry }>("/api/queue/join", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
};

export const useConfirmQueuePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { entry_id: string; tx_hash: string }) =>
      api<{ match_id: string | null }>(`/api/queue/${input.entry_id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ tx_hash: input.tx_hash }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
};

export const useCancelQueueEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api(`/api/queue/${entryId}/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
};

export const useOpenDispute = (matchId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (description: string) =>
      api(`/api/matches/${matchId}/dispute`, {
        method: "POST", body: JSON.stringify({ description }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match", matchId] }),
  });
};
