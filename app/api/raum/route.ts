import { NextRequest, NextResponse } from "next/server";
import { genCode, saveRoom, purgeStale } from "@/lib/store";
import { initialGame, makePlayer } from "@/lib/game";
import { RoomState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await purgeStale();
  const body = await req.json().catch(() => ({}));
  const name: string = (body.name || "").toString().trim().slice(0, 20);
  const playerId: string = (body.playerId || "").toString().trim().slice(0, 64);
  if (!name) return NextResponse.json({ error: "Name fehlt." }, { status: 400 });
  if (!playerId) return NextResponse.json({ error: "Spieler-ID fehlt." }, { status: 400 });

  const code = await genCode();
  const creator = makePlayer(playerId, name);
  creator.color = "w";
  const room: RoomState = {
    code,
    status: "warten",
    players: [creator],
    game: initialGame(),
    winner: null,
    result: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveRoom(room);
  return NextResponse.json({ code });
}
