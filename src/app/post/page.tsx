"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Posting individual matches has been replaced by the matchmaking queue.
 * Keep this route as a redirect so any old links / bookmarks still land
 * somewhere useful.
 */
export default function PostRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/queue");
  }, [router]);
  return null;
}
