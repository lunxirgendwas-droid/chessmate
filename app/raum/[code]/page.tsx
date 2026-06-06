"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPlayerId, getStoredName } from "@/lib/playerId";
import { Color, PieceType, PublicView, Sq } from "@/lib/types";
import ThemeToggle from "../../ThemeToggle";
import CanvasBoard from "../../CanvasBoard";

type Phase = PublicView["status"];

const PIECE_NAME: Record<PieceType, string> = {
  k: "König", q: "Dame", r: "Turm", b: "Läufer", n: "Springer", p: "Bauer",
};
const PIECE_GLYPH_DARK: Record<PieceType, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code || "").toString().toUpperCase();
  const pid = useRef<string>("");
  const [view, setView] = useState<PublicView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Sq; to: Sq } | null>(null);

  useEffect(() => { pid.current = getPlayerId(); }, []);

  const fetchView = useCallback(async () => {
    try {
      const res = await fetch(`/api/raum/${code}?pid=${pid.current}`, { cache: "no-store" });
      if (res.status === 404) { setError("Raum nicht gefunden."); return; }
      const data: PublicView = await res.json();
      setView(data);
    } catch {}
  }, [code]);

  useEffect(() => {
    if (!pid.current) return;
    fetchView();
    const id = setInterval(fetchView, 1500);
    return () => clearInterval(id);
  }, [fetchView]);

  useEffect(() => {
    if (!view) return;
    if (view.you === null && !joining) {
      const name = getStoredName();
      if (!name) { router.replace("/"); return; }
      setJoining(true);
      fetch(`/api/raum/${code}/beitreten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, playerId: pid.current }),
      }).then(r => r.json()).then(d => { if (d.error) setError(d.error); })
        .finally(() => { setJoining(false); fetchView(); });
    }
  }, [view, joining, code, router, fetchView]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-surface border border-line rounded-3xl p-8 max-w-md shadow-soft text-center">
          <div className="serif-it text-rose text-4xl mb-2">Oh nein.</div>
          <p className="text-muted">{error}</p>
          <button onClick={() => router.push("/")} className="mt-6 sans font-medium bg-rose text-white px-5 py-3 rounded-xl hover:bg-coral transition">
            Zur Startseite
          </button>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        <span className="w-2 h-2 rounded-full bg-rose pulse-dot mr-3" /> Verbinde mit {code}…
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar code={code} view={view} />
      <section className="flex-1 px-3 md:px-6 lg:px-8 py-4 md:py-6 max-w-6xl mx-auto w-full pb-28 md:pb-6">
        {view.status === "warten" && <WaitingPanel code={code} />}
        {view.status === "vorbereiten" && <PreparePanel view={view} code={code} pid={pid} onAfter={fetchView} />}
        {view.status === "spielen" && <BattlePanel view={view} code={code} pid={pid} lastMove={lastMove} setLastMove={setLastMove} onAfter={fetchView} />}
        {view.status === "beendet" && <EndPanel view={view} />}
      </section>
    </main>
  );
}

function TopBar({ code, view }: { code: string; view: PublicView }) {
  const me = view.you !== null ? view.players[view.you] : null;
  const enemy = view.you !== null ? view.players[1 - view.you] : view.players[1] || null;
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); }
  const turnMe = view.you !== null && view.yourColor === view.turn;
  return (
    <header className="border-b border-line/80 px-3 md:px-8 py-3 md:py-4 bg-paper/70 backdrop-blur sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
        <button onClick={copy} className="group flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-shell flex items-center justify-center text-rose text-lg">♞</div>
          <div className="text-left min-w-0">
            <div className="text-[10px] sans uppercase tracking-wider text-muted leading-tight">
              Code {copied && <span className="text-rose ml-1">kopiert ✓</span>}
            </div>
            <div className="mono text-ink text-base md:text-xl tracking-[0.25em] md:tracking-[0.35em] group-hover:text-rose transition leading-tight">{code}</div>
          </div>
        </button>
        <div className="hidden md:block">
          <StatusBadge status={view.status} turnMe={turnMe} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 max-w-6xl mx-auto md:hidden">
        <StatusBadge status={view.status} turnMe={turnMe} />
        <div className="flex items-center gap-1.5 text-xs">
          <PlayerChip label={me?.name || "—"} color={me?.color ?? null} active={turnMe && view.status === "spielen"} compact />
          <span className="serif-it text-muted text-xs">vs</span>
          <PlayerChip label={enemy?.name || "—"} color={enemy?.color ?? null} active={!turnMe && view.status === "spielen"} compact />
        </div>
      </div>
      <div className="mt-2 hidden md:flex items-center justify-end gap-2 max-w-6xl mx-auto">
        <PlayerChip label={me?.name || "—"} color={me?.color ?? null} active={turnMe && view.status === "spielen"} />
        <span className="serif-it text-muted">vs</span>
        <PlayerChip label={enemy?.name || "wartet"} color={enemy?.color ?? null} active={!turnMe && view.status === "spielen"} />
      </div>
    </header>
  );
}

function StatusBadge({ status, turnMe }: { status: Phase; turnMe: boolean }) {
  const map: Record<Phase, { label: string; color: string }> = {
    warten:       { label: "Warte auf Gegner",     color: "bg-cream text-ink" },
    vorbereiten:  { label: "Farbe & Bereit",       color: "bg-shell text-rose" },
    spielen:      { label: turnMe ? "Du bist dran" : "Gegner ist dran", color: turnMe ? "bg-rose text-white" : "bg-cream text-muted" },
    beendet:      { label: "Partie beendet",       color: "bg-ink text-paper" },
  };
  const s = map[status];
  return (
    <div className={`inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full ${s.color} sans font-medium text-xs md:text-sm whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${turnMe && status === "spielen" ? "bg-white pulse-dot" : "bg-current opacity-60"}`} />
      {s.label}
    </div>
  );
}

function PlayerChip({ label, color, active, compact }: { label: string; color: Color | null; active: boolean; compact?: boolean }) {
  const dot = color === "w" ? "○" : color === "b" ? "●" : "·";
  return (
    <span className={`px-2.5 md:px-3 ${compact ? "py-1" : "py-1.5"} rounded-full ${compact ? "text-xs" : "text-sm"} sans font-medium border whitespace-nowrap ${active ? "border-rose bg-shell text-rose" : "border-line bg-surface text-ink"}`}>
      <span className="mr-1 text-muted">{dot}</span>
      {label}
    </span>
  );
}

function WaitingPanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="grid md:grid-cols-2 gap-8 md:gap-10 py-8 md:py-16 items-center">
      <div className="fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shell text-rose text-xs sans font-medium mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose pulse-dot" /> Warte auf Mitspieler
        </div>
        <h2 className="font-medium tracking-tight text-ink text-4xl md:text-6xl leading-[0.95]">
          Teile den
          <br/>
          <span className="serif-it text-rose font-normal">Raumcode.</span>
        </h2>
        <p className="mt-5 text-muted text-base md:text-lg max-w-md">
          Sobald dein Gegner beitritt, könnt ihr die Farben wählen und starten.
        </p>
      </div>
      <div className="bg-surface border border-line rounded-3xl shadow-soft p-6 md:p-8 fade-up">
        <div className="text-xs sans uppercase tracking-wider text-muted mb-3">Raumcode</div>
        <div className="mono text-ink text-4xl md:text-7xl tracking-[0.2em] md:tracking-[0.25em] leading-none">{code}</div>
        <button onClick={copy} className="mt-6 w-full sans font-medium bg-rose text-white py-3.5 rounded-xl hover:bg-coral transition">
          {copied ? "Kopiert ✓" : "Code kopieren"}
        </button>
        <div className="mt-5 flex items-center gap-2 text-sm text-muted">
          <span className="w-2 h-2 rounded-full bg-rose pulse-dot" /> Verbindung aktiv
        </div>
      </div>
    </div>
  );
}

function PreparePanel({ view, code, pid, onAfter }: {
  view: PublicView; code: string; pid: React.RefObject<string>; onAfter: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const me = view.you !== null ? view.players[view.you] : null;
  const opp = view.you !== null ? view.players[1 - view.you] : null;

  async function send(action: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/raum/${code}/figuren`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: pid.current, action }),
      });
      if (!res.ok) { const d = await res.json(); console.error(d.error); }
      onAfter();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid lg:grid-cols-[1fr,340px] gap-5 md:gap-8 items-start">
      <div className="fade-up min-w-0">
        <h2 className="text-2xl md:text-4xl tracking-tight text-ink font-medium leading-tight mb-1">
          Wähle deine <span className="serif-it text-rose font-normal">Seite</span>
        </h2>
        <p className="text-muted text-xs md:text-sm mb-4 md:mb-6">
          Klassische Startaufstellung. Tausche bei Bedarf die Farben, dann auf <span className="font-medium text-ink">Bereit</span>.
        </p>
        <div className="bg-surface border border-line rounded-2xl md:rounded-3xl shadow-soft p-3 md:p-5">
          <CanvasBoard
            board={view.board}
            yourColor={view.yourColor}
            interactive={false}
            active={true}
          />
        </div>
      </div>

      <aside className="space-y-3 md:space-y-4 lg:sticky lg:top-28">
        <div className="bg-surface border border-line rounded-2xl p-4 md:p-5 shadow-soft">
          <div className="text-xs sans font-medium text-muted uppercase tracking-wider mb-3">Aufstellung</div>
          <ul className="space-y-1.5 mb-3">
            <li className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-line bg-surface">
              <span className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-white border border-ink" />
                <span className="sans font-medium text-ink text-sm">Weiß</span>
              </span>
              <span className="sans text-sm text-muted truncate">{view.players.find(p => p.color === "w")?.name ?? "—"}</span>
            </li>
            <li className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-line bg-surface">
              <span className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-ink" />
                <span className="sans font-medium text-ink text-sm">Schwarz</span>
              </span>
              <span className="sans text-sm text-muted truncate">{view.players.find(p => p.color === "b")?.name ?? "—"}</span>
            </li>
          </ul>
          <button onClick={() => send("swap")} disabled={busy || (me?.ready || opp?.ready)} className="w-full py-2.5 rounded-xl sans text-sm border border-line text-ink hover:border-rose disabled:opacity-40 transition">
            ⇄ Farben tauschen
          </button>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-4 md:p-5 shadow-soft">
          <div className="text-xs sans font-medium text-muted uppercase tracking-wider mb-3">Bereit?</div>
          <div className="text-sm text-muted mb-4 space-y-1">
            <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${me?.ready ? "bg-rose" : "bg-line"}`} /> Du: <span className={me?.ready ? "text-rose font-medium" : ""}>{me?.ready ? "bereit" : "nicht bereit"}</span></div>
            <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${opp?.ready ? "bg-rose" : "bg-line"}`} /> Gegner: <span className={opp?.ready ? "text-rose font-medium" : ""}>{opp?.ready ? "bereit" : "wartet"}</span></div>
          </div>
          {!me?.ready ? (
            <button onClick={() => send("ready")} disabled={busy} className="w-full sans font-medium text-base py-3.5 bg-rose text-white rounded-xl disabled:opacity-30 hover:bg-coral transition">
              Bereit →
            </button>
          ) : (
            <button onClick={() => send("unready")} disabled={busy} className="w-full sans text-sm py-3 rounded-xl border border-line text-muted hover:text-ink hover:border-ink transition">
              Bereit zurücknehmen
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function BattlePanel({ view, code, pid, lastMove, setLastMove, onAfter }: {
  view: PublicView; code: string; pid: React.RefObject<string>;
  lastMove: { from: Sq; to: Sq } | null;
  setLastMove: (m: { from: Sq; to: Sq } | null) => void;
  onAfter: () => void;
}) {
  const myTurn = view.you !== null && view.yourColor === view.turn;
  const me = view.you !== null ? view.players[view.you] : null;
  const enemy = view.you !== null ? view.players[1 - view.you] : null;
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Sq | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ from: Sq; to: Sq } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: "hit" | "miss" | "sunk" } | null>(null);

  useEffect(() => { setSelected(null); }, [view.turn]);

  const legalForSelected: Sq[] = useMemo(() => {
    if (!selected) return [];
    return view.legalMoves.filter(m => m.from.x === selected.x && m.from.y === selected.y).map(m => m.to);
  }, [selected, view.legalMoves]);

  const checkSquare: Sq | null = useMemo(() => {
    if (!view.inCheck || !view.yourColor) return null;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const p = view.board[y][x];
      if (p && p.type === "k" && p.color === view.yourColor) return { x, y };
    }
    return null;
  }, [view.inCheck, view.board, view.yourColor]);

  async function send(fromX: number, fromY: number, toX: number, toY: number, promotion?: PieceType) {
    setBusy(true);
    try {
      const res = await fetch(`/api/raum/${code}/zug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: pid.current, fromX, fromY, toX, toY, promotion }),
      });
      const data = await res.json();
      if (!res.ok) { setFeedback({ text: data.error || "Ungültig.", tone: "miss" }); setTimeout(() => setFeedback(null), 1400); return; }
      setLastMove({ from: { x: fromX, y: fromY }, to: { x: toX, y: toY } });
      if (data.gameOver) {
        setFeedback({ text: data.gameOver.reason === "matt" ? "Schachmatt!" : "Patt.", tone: "sunk" });
      } else if (data.move?.captured) {
        setFeedback({ text: `Geschlagen: ${PIECE_NAME[data.move.captured.type as PieceType]}`, tone: "hit" });
      } else if (data.move?.check) {
        setFeedback({ text: "Schach!", tone: "hit" });
      } else {
        setFeedback({ text: data.move?.san ?? "Zug ausgeführt", tone: "miss" });
      }
      setTimeout(() => setFeedback(null), 1800);
      setSelected(null);
      onAfter();
    } finally { setBusy(false); }
  }

  function handleClick(x: number, y: number) {
    if (!myTurn || busy) return;
    const piece = view.board[y][x];
    if (selected) {
      const target = legalForSelected.find(t => t.x === x && t.y === y);
      if (target) {
        const promoMoves = view.legalMoves.filter(m => m.from.x === selected.x && m.from.y === selected.y && m.to.x === x && m.to.y === y && m.promotion);
        if (promoMoves.length > 0) {
          setPendingPromo({ from: selected, to: { x, y } });
          return;
        }
        send(selected.x, selected.y, x, y);
        return;
      }
      if (piece && piece.color === view.yourColor) {
        const hasMoves = view.legalMoves.some(m => m.from.x === x && m.from.y === y);
        setSelected(hasMoves ? { x, y } : null);
        return;
      }
      setSelected(null);
      return;
    }
    if (piece && piece.color === view.yourColor) {
      const hasMoves = view.legalMoves.some(m => m.from.x === x && m.from.y === y);
      if (hasMoves) setSelected({ x, y });
    }
  }

  function choosePromotion(pt: PieceType) {
    if (!pendingPromo) return;
    const { from, to } = pendingPromo;
    setPendingPromo(null);
    send(from.x, from.y, to.x, to.y, pt);
  }

  async function resign() {
    if (!confirm("Wirklich aufgeben?")) return;
    setBusy(true);
    try {
      await fetch(`/api/raum/${code}/zug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: pid.current, action: "aufgeben" }),
      });
      onAfter();
    } finally { setBusy(false); }
  }

  const myCaptured = me?.captured ?? [];
  const enemyCaptured = enemy?.captured ?? [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid lg:grid-cols-[1fr,320px] gap-4 md:gap-6 items-start">
        <BoardCard title="Schachbrett" sub={myTurn ? "Wähle eine Figur" : "Warte auf Zug"} active={myTurn}>
          <div className="mb-2 md:mb-3">
            <CapturedRow label={enemy?.name || "Gegner"} pieces={enemyCaptured} />
          </div>
          <CanvasBoard
            board={view.board}
            yourColor={view.yourColor}
            selected={selected}
            legalTargets={legalForSelected}
            lastMove={lastMove ?? view.lastMove}
            checkSquare={checkSquare}
            onSquareClick={handleClick}
            interactive={myTurn && !busy}
            active={myTurn}
            flashCell={view.lastMove?.to ?? null}
          />
          <div className="mt-2 md:mt-3">
            <CapturedRow label="Du" pieces={myCaptured} />
          </div>
        </BoardCard>

        <aside className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <Stat label="Zug" value={String(Math.ceil((view.history.length + 1) / 2))} accent={myTurn} />
            <Stat label="Halbzüge" value={String(view.history.length)} />
          </div>
          <div className="bg-surface border border-line rounded-2xl p-4 shadow-soft">
            <div className="text-xs sans font-medium text-muted uppercase tracking-wider mb-3">Partie</div>
            <HistoryList history={view.history} />
          </div>
          <button onClick={resign} disabled={busy} className="w-full py-3 rounded-xl sans text-sm border border-line text-muted hover:text-rose hover:border-rose disabled:opacity-40 transition">
            Aufgeben
          </button>
        </aside>
      </div>

      {pendingPromo && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center px-4" onClick={() => setPendingPromo(null)}>
          <div className="bg-surface border border-line rounded-2xl shadow-soft p-5 md:p-6 max-w-xs w-full pop-in" onClick={e => e.stopPropagation()}>
            <div className="text-xs sans uppercase tracking-wider text-muted mb-3">Umwandlung</div>
            <div className="grid grid-cols-4 gap-2">
              {(["q", "r", "b", "n"] as PieceType[]).map(pt => (
                <button
                  key={pt}
                  onClick={() => choosePromotion(pt)}
                  className="aspect-square rounded-xl border border-line hover:border-rose bg-cream/60 flex items-center justify-center text-4xl transition"
                >
                  <span style={{ color: view.yourColor === "w" ? "#fff" : undefined, textShadow: view.yourColor === "w" ? "0 0 0 #000, -1px -1px 0 #111, 1px -1px 0 #111, -1px 1px 0 #111, 1px 1px 0 #111" : undefined }}>
                    {PIECE_GLYPH_DARK[pt]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className={[
          "fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-40 px-5 md:px-6 py-3 rounded-full shadow-soft sans font-medium text-sm md:text-base pop-in whitespace-nowrap",
          feedback.tone === "sunk" ? "bg-ink text-paper" : feedback.tone === "hit" ? "bg-rose text-white" : "bg-surface border border-line text-ink",
        ].join(" ")}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

function CapturedRow({ label, pieces }: { label: string; pieces: PieceType[] }) {
  const order: PieceType[] = ["q", "r", "b", "n", "p"];
  const sorted = [...pieces].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return (
    <div className="flex items-center gap-2 min-h-[24px]">
      <span className="text-[10px] sans uppercase tracking-wider text-muted shrink-0">{label}</span>
      <span className="text-lg md:text-xl tracking-tight text-ink leading-none truncate">
        {sorted.length ? sorted.map(p => PIECE_GLYPH_DARK[p]).join("") : <span className="text-muted text-xs">—</span>}
      </span>
    </div>
  );
}

function HistoryList({ history }: { history: PublicView["history"] }) {
  if (history.length === 0) return <div className="text-sm text-muted">Noch keine Züge.</div>;
  const pairs: { n: number; w?: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ n: i / 2 + 1, w: history[i]?.san, b: history[i + 1]?.san });
  }
  return (
    <ol className="max-h-64 overflow-auto mono text-sm text-ink space-y-0.5 pr-1">
      {pairs.map(p => (
        <li key={p.n} className="grid grid-cols-[2rem,1fr,1fr] gap-2 items-baseline">
          <span className="text-muted">{p.n}.</span>
          <span>{p.w ?? ""}</span>
          <span className="text-ink">{p.b ?? ""}</span>
        </li>
      ))}
    </ol>
  );
}

function BoardCard({ title, sub, active, children }: { title: string; sub: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className={`bg-surface border ${active ? "border-rose" : "border-line"} rounded-2xl md:rounded-3xl shadow-soft p-3 md:p-5 transition`}>
      <div className="flex items-end justify-between mb-3">
        <div className="min-w-0">
          <div className="sans font-medium text-ink text-sm md:text-base">{title}</div>
          <div className="text-xs text-muted truncate">{sub}</div>
        </div>
        <div className={`text-[10px] sans uppercase tracking-wider shrink-0 ${active ? "text-rose" : "text-muted"}`}>{active ? "● aktiv" : "pause"}</div>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl md:rounded-2xl border p-3 md:p-4 ${accent ? "bg-shell border-rose/20" : "bg-surface border-line"} shadow-soft`}>
      <div className="text-[10px] sans uppercase tracking-wider text-muted mb-1 md:mb-2 truncate">{label}</div>
      <div className={`serif text-2xl md:text-3xl leading-none ${accent ? "text-rose" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function EndPanel({ view }: { view: PublicView }) {
  const youWon = view.you !== null && view.winner === view.you;
  const draw = view.winner === null;
  const reason = view.result === "matt" ? "Schachmatt" : view.result === "patt" ? "Patt" : view.result === "aufgegeben" ? "Aufgabe" : "Ende";
  return (
    <div className="py-8 md:py-20 grid md:grid-cols-2 gap-8 md:gap-10 items-center fade-up">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shell text-rose text-xs sans font-medium mb-5">
          Spielbericht · {reason}
        </div>
        <h2 className="font-medium tracking-tight text-ink text-5xl md:text-7xl leading-[0.95]">
          {draw ? <>Unentschieden.<br/><span className="serif-it text-rose font-normal">Remis.</span></>
            : youWon ? <>Du hast<br/><span className="serif-it text-rose font-normal">gewonnen.</span></>
            : <>Knappe<br/><span className="serif-it text-rose font-normal">Niederlage.</span></>}
        </h2>
        <p className="mt-5 text-muted text-base md:text-lg max-w-md">
          {draw ? "Keine legalen Züge mehr — Patt." : youWon ? "Gut gespielt, Großmeister." : "Eine Revanche?"}
        </p>
        <div className="mt-7 flex gap-3">
          <a href="/" className="sans font-medium bg-rose text-white px-5 py-3.5 rounded-xl hover:bg-coral transition">Neues Spiel →</a>
        </div>
      </div>
      <div className="bg-surface border border-line rounded-3xl shadow-soft p-6 md:p-8">
        <div className="text-xs sans uppercase tracking-wider text-muted mb-4">Endstand</div>
        <ul className="space-y-3">
          {view.players.map((p, i) => (
            <li key={i} className="flex items-center justify-between border-b border-line/70 pb-3 last:border-0 last:pb-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${view.winner === i ? "bg-rose" : "bg-line"}`} />
                <span className={`sans font-medium truncate ${view.you === i ? "text-rose" : "text-ink"}`}>{p.name}</span>
                <span className="text-muted text-xs">({p.color === "w" ? "Weiß" : p.color === "b" ? "Schwarz" : "—"})</span>
              </span>
              <span className="text-muted text-sm shrink-0">{p.captured.length} geschlagen</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
