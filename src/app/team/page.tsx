"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  List, Section, Cell, Button, Input, Placeholder, Avatar, Banner, Caption,
} from "@telegram-apps/telegram-ui";
import { useCreateTeam, useJoinTeam, useMe, useTeam } from "@/hooks/api";

export default function TeamPage() {
  const me = useMe();
  const gameId = me.data?.current_game_id ?? null;
  const team = useTeam(gameId);
  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();
  const router = useRouter();

  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!gameId) return <Placeholder header="Pick a game first" />;
  if (team.isLoading) return <Placeholder header="Loading…" />;

  if (team.data?.team) {
    const t = team.data.team;
    return (
      <List>
        <Section header={t.name}>
          <Cell subtitle="Invite code (share with teammates)">
            <code>{t.invite_code}</code>
          </Cell>
        </Section>
        <Section header={`Members (${team.data.members.length})`}>
          {team.data.members.map((m) => (
            <Cell
              key={m.user_id}
              before={<Avatar size={28} acronym={(m.user.telegram_username ?? "?")[0]?.toUpperCase()} />}
              subtitle={m.role === "owner" ? "Owner" : "Member"}
            >
              {m.user.telegram_username ? `@${m.user.telegram_username}` : `id:${m.user.telegram_id}`}
            </Cell>
          ))}
        </Section>
        <Section>
          <Cell>
            <Button mode="plain" onClick={() => router.push("/")}>Back home</Button>
          </Cell>
        </Section>
      </List>
    );
  }

  if (mode === "choose") {
    return (
      <List>
        <Placeholder
          header="No team yet"
          description="To post or accept matches, you need a team in this game."
        />
        <Section>
          <Cell onClick={() => setMode("create")}>🆕 Create new team</Cell>
          <Cell onClick={() => setMode("join")}>🔗 Join via invite code</Cell>
        </Section>
      </List>
    );
  }

  return (
    <List>
      {mode === "create" ? (
        <>
          <Section header="Team name">
            <Cell><Input value={name} onChange={(e) => setName(e.target.value)} /></Cell>
          </Section>
          <Section>
            <Cell>
              <Button
                stretched
                disabled={name.length < 3 || name.length > 32}
                onClick={async () => {
                  setErr(null);
                  try {
                    await createTeam.mutateAsync({ name, game_id: gameId });
                    setMode("choose");
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                Create team
              </Button>
            </Cell>
          </Section>
        </>
      ) : (
        <>
          <Section header="Invite code">
            <Cell><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></Cell>
          </Section>
          <Section>
            <Cell>
              <Button
                stretched
                disabled={code.length !== 8}
                onClick={async () => {
                  setErr(null);
                  try {
                    await joinTeam.mutateAsync({ code });
                    setMode("choose");
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                Join
              </Button>
            </Cell>
          </Section>
        </>
      )}
      {err && <Banner header="⚠ Error" subheader={err} />}
      <Section>
        <Cell><Button mode="plain" onClick={() => setMode("choose")}>Cancel</Button></Cell>
      </Section>
    </List>
  );
}
