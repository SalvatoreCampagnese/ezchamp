"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  List, Section, Cell, Button, Banner, Placeholder, Title, Caption, Modal, Input,
} from "@telegram-apps/telegram-ui";
import {
  useMatch, useMe, useOpenDispute, useReportResult, useTeam,
} from "@/hooks/api";
import { useSendStake, ESCROW } from "@/lib/ton";
import { api } from "@/lib/api-client";

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const match = useMatch(id);
  const team = useTeam(me.data?.current_game_id ?? null);
  const reportResult = useReportResult(id);
  const openDispute = useOpenDispute(id);
  const sendStake = useSendStake();

  const [confirmingResult, setConfirmingResult] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeText, setDisputeText] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (match.isLoading) return <Placeholder header="Loading…" />;
  if (!match.data) return <Placeholder header="Match not found" />;

  const m = match.data;
  const myTeamId = team.data?.team?.id ?? null;
  const inMatch = !!myTeamId && (myTeamId === m.poster_team_id || myTeamId === m.accepter_team_id);
  const otherTeam = myTeamId === m.poster_team_id ? m.accepter_team : m.poster_team;

  const onAccept = async () => {
    setErr(null);
    setAccepting(true);
    try {
      // Tell the API we're attempting to accept (for logging/UX), then send the TON.
      await api(`/api/matches/${id}/accept`, { method: "POST" });
      await sendStake(m.id, Number(m.stake_ton));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <List>
      <Section header={<Title level="3">Match {m.id.slice(0, 8)}</Title>}>
        <Cell subtitle={`${m.players_per_side}v${m.players_per_side} · BO${m.best_of}`}>
          <strong>{m.poster_team?.name ?? "?"}</strong> vs{" "}
          <strong>{m.accepter_team?.name ?? "(open)"}</strong>
        </Cell>
        <Cell subtitle="Stake per team"><strong>{m.stake_ton} TON</strong></Cell>
        <Cell subtitle="Rules">{m.rule?.name ?? "—"}</Cell>
        <Cell subtitle="Status"><Caption>{m.status}</Caption></Cell>
        {m.result_deadline_at && (
          <Cell subtitle="Other team must confirm by">
            {new Date(m.result_deadline_at).toLocaleString()}
          </Cell>
        )}
      </Section>

      {/* Accept (open match, viewer is not poster) */}
      {m.status === "open" && !inMatch && (
        <Section>
          <Cell>
            <Button stretched onClick={onAccept} disabled={accepting}>
              {accepting ? "Sending…" : `Accept & Pay ${m.stake_ton} TON`}
            </Button>
          </Cell>
          <Cell>
            <Caption>
              Funds go to escrow <code>{ESCROW.slice(0, 6)}…{ESCROW.slice(-4)}</code>. Match is locked once payment confirms.
            </Caption>
          </Cell>
        </Section>
      )}

      {/* Active match (in match, status in progress) */}
      {inMatch && ["accepted", "awaiting_result"].includes(m.status) && (
        <>
          <Section>
            <Cell>
              <Button
                stretched
                onClick={() => setConfirmingResult(myTeamId!)}
              >
                🏁 We won
              </Button>
            </Cell>
            <Cell>
              <Button
                stretched
                mode="bezeled"
                onClick={() => setConfirmingResult(otherTeam?.id ?? "")}
              >
                😞 They won ({otherTeam?.name})
              </Button>
            </Cell>
            <Cell>
              <Button stretched mode="plain" onClick={() => setDisputeOpen(true)}>
                🚩 Open dispute
              </Button>
            </Cell>
          </Section>
        </>
      )}

      {/* Completed */}
      {m.status === "completed" && (
        <Banner header="Match complete" subheader={`Winner: ${m.winner_team_id === m.poster_team_id ? m.poster_team?.name : m.accepter_team?.name}`} />
      )}
      {m.status === "disputed" && (
        <Banner header="⚠ Disputed" subheader="Staff is reviewing — you'll be notified by the bot." />
      )}

      {err && <Banner header="⚠ Error" subheader={err} />}

      {/* Confirm result modal */}
      {confirmingResult && (
        <Modal open onOpenChange={(o) => !o && setConfirmingResult(null)}>
          <List>
            <Placeholder header="Confirm result" description="Once both teams agree (or 20 min pass) the payout is queued." />
            <Section>
              <Cell>
                <Button
                  stretched
                  onClick={async () => {
                    await reportResult.mutateAsync(confirmingResult);
                    setConfirmingResult(null);
                  }}
                >
                  Submit
                </Button>
              </Cell>
              <Cell>
                <Button stretched mode="plain" onClick={() => setConfirmingResult(null)}>
                  Cancel
                </Button>
              </Cell>
            </Section>
          </List>
        </Modal>
      )}

      {/* Dispute modal */}
      {disputeOpen && (
        <Modal open onOpenChange={setDisputeOpen}>
          <List>
            <Section header="What happened?">
              <Cell>
                <Input
                  placeholder="Brief description"
                  value={disputeText}
                  onChange={(e) => setDisputeText(e.target.value)}
                />
              </Cell>
            </Section>
            <Section>
              <Cell>
                <Button
                  stretched
                  disabled={disputeText.trim().length < 5}
                  onClick={async () => {
                    await openDispute.mutateAsync(disputeText.trim());
                    setDisputeOpen(false);
                    router.refresh();
                  }}
                >
                  Submit dispute
                </Button>
              </Cell>
            </Section>
          </List>
        </Modal>
      )}
    </List>
  );
}
