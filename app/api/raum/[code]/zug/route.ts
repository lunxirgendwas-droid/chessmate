import { NextRequest, NextResponse } from "next/server";
import { getRoom, saveRoom } from "@/lib/store";
import { applyMove } from "@/lib/game";
import { PieceType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "Raum nicht gefunden." }, { status: 404 });
  if (room.status !== "spielen") return NextResponse.json({ error: "Spiel läuft nicht." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const playerId: string = (body.playerId || "").toString();
  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx !== 0 && idx !== 1) return NextResponse.json({ error: "Kein Mitspieler." }, { status: 403 });
  const player = room.players[idx];
  if (!player.color || player.color !== room.game.turn) {
    return NextResponse.json({ error: "Nicht dein Zug." }, { status: 400 });
  }

  if (body.action === "aufgeben") {
    room.status = "beendet";
    room.result = "aufgegeben";
    room.winner = (1 - idx) as 0 | 1;
    room.updatedAt = Date.now();
    await saveRoom(room);
    return NextResponse.json({ ok: true, resigned: true });
  }

  const fromX = Number(body.fromX), fromY = Number(body.fromY);
  const toX = Number(body.toX), toY = Number(body.toY);
  const promotion: PieceType | undefined = body.promotion;
  if (![fromX, fromY, toX, toY].every(n => Number.isInteger(n) && n >= 0 && n < 8)) {
    return NextResponse.json({ error: "Ungültige Koordinaten." }, { status: 400 });
  }

  const res = applyMove(room.game, { x: fromX, y: fromY }, { x: toX, y: toY }, promotion);
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 400 });

  if (res.gameOver) {
    room.status = "beendet";
    if (res.gameOver.winner === "draw") {
      room.result = "patt";
      room.winner = null;
    } else {
      room.result = "matt";
      room.winner = room.players.findIndex(p => p.color === res.gameOver!.winner) as 0 | 1;
    }
  }
  room.updatedAt = Date.now();
  await saveRoom(room);
  return NextResponse.json({ ok: true, move: res.move, gameOver: res.gameOver ?? null });
}
