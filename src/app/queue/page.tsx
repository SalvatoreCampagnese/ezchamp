"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, useMyQueueEntry } from "@/hooks/api";

/**
 * The lobby browser + queue waiting state both live under `/game/[id]` now.
 * This route is kept only to avoid breaking old links — it forwards to the
 * right place based on whether the user is currently queued.
 */
export default function QueueRedirect() {
  const router = useRouter();
  const me = useMe();
  const entry = useMyQueueEntry();

  useEffect(() => {
    if (entry.isLoading || me.isLoading) return;
    if (entry.data) {
      router.replace(
        entry.data.match_id ? `/match/${entry.data.match_id}` : `/game/${entry.data.game_id}`,
      );
    } else if (me.data?.current_game_id) {
      router.replace(`/game/${me.data.current_game_id}`);
    } else {
      router.replace("/");
    }
  }, [entry.isLoading, entry.data, me.isLoading, me.data?.current_game_id, router]);

  return null;
}
