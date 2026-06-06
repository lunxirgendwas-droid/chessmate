import { NextRequest, NextResponse } from "next/server";
import { getRoom, saveRoom } from "@/lib/store";
import { initialGame } from "@/lib/game";
import { Color } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "Raum nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const playerId: string = (body.playerId || "").toString();
  const player = room.players.find(p => p.id === playerId);
  if (!player) return NextResponse.json({ error: "Kein Mitspieler." }, { status: 403 });
  if (room.status !== "vorbereiten" && room.status !== "warten") {
    return NextResponse.json({ error: "Vorbereitung nicht möglich." }, { status: 400 });
  }

  const action: string = body.action || "ready";

  if (action === "swap") {
    if (room.players.length < 2) return NextResponse.json({ error: "Noch kein Gegner." }, { status: 400 });
    if (room.players.some(p => p.ready)) return NextResponse.json({ error: "Erst Bereit zurücknehmen." }, { status: 400 });
    for (const p of room.players) p.color = (p.color === "w" ? "b" : "w") as Color;
  } else if (action === "ready") {
    if (!player.color) return NextResponse.json({ error: "Keine Farbe." }, { status: 400 });
    player.ready = true;
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      room.status = "spielen";
      room.game = initialGame();
    }
  } else if (action === "unready") {
    player.ready = false;
  } else {
    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }

  room.updatedAt = Date.now();
  await saveRoom(room);
  return NextResponse.json({ ok: true });
}
