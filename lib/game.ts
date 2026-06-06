import { Board, Castling, Color, GameState, GRID, Move, Piece, PieceType, PlayerState, PublicView, RoomState, Sq } from "./types";

export function initialBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let x = 0; x < 8; x++) {
    b[0][x] = { color: "b", type: back[x] };
    b[1][x] = { color: "b", type: "p" };
    b[6][x] = { color: "w", type: "p" };
    b[7][x] = { color: "w", type: back[x] };
  }
  return b;
}

export function initialGame(): GameState {
  return {
    board: initialBoard(),
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    history: [],
  };
}

export function makePlayer(id: string, name: string): PlayerState {
  return { id, name, ready: false, color: null };
}

function inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < 8 && y < 8; }
function cloneBoard(b: Board): Board { return b.map(row => row.map(p => (p ? { ...p } : null))); }

export function findKing(b: Board, color: Color): Sq | null {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const p = b[y][x];
    if (p && p.type === "k" && p.color === color) return { x, y };
  }
  return null;
}

export function squareAttacked(b: Board, by: Color, tx: number, ty: number): boolean {
  const pdir = by === "w" ? -1 : 1;
  for (const dx of [-1, 1]) {
    const px = tx + dx, py = ty - pdir;
    if (inBounds(px, py)) {
      const p = b[py][px];
      if (p && p.color === by && p.type === "p") return true;
    }
  }
  const kn = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  for (const [dx, dy] of kn) {
    const px = tx + dx, py = ty + dy;
    if (inBounds(px, py)) {
      const p = b[py][px];
      if (p && p.color === by && p.type === "n") return true;
    }
  }
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (!dx && !dy) continue;
    const px = tx + dx, py = ty + dy;
    if (inBounds(px, py)) {
      const p = b[py][px];
      if (p && p.color === by && p.type === "k") return true;
    }
  }
  const orth = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of orth) {
    let x = tx + dx, y = ty + dy;
    while (inBounds(x, y)) {
      const p = b[y][x];
      if (p) {
        if (p.color === by && (p.type === "r" || p.type === "q")) return true;
        break;
      }
      x += dx; y += dy;
    }
  }
  const diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [dx, dy] of diag) {
    let x = tx + dx, y = ty + dy;
    while (inBounds(x, y)) {
      const p = b[y][x];
      if (p) {
        if (p.color === by && (p.type === "b" || p.type === "q")) return true;
        break;
      }
      x += dx; y += dy;
    }
  }
  return false;
}

interface PseudoMove { to: Sq; promotion?: PieceType; isEnPassant?: boolean; isCastle?: "K" | "Q"; }

function pieceMoves(state: GameState, fromX: number, fromY: number): PseudoMove[] {
  const b = state.board;
  const p = b[fromY][fromX];
  if (!p) return [];
  const moves: PseudoMove[] = [];
  const friendlyAt = (x: number, y: number) => { const q = b[y][x]; return !!(q && q.color === p.color); };
  const enemyAt = (x: number, y: number) => { const q = b[y][x]; return !!(q && q.color !== p.color); };
  const emptyAt = (x: number, y: number) => !b[y][x];

  if (p.type === "p") {
    const dir = p.color === "w" ? -1 : 1;
    const startY = p.color === "w" ? 6 : 1;
    const promoY = p.color === "w" ? 0 : 7;
    const ny = fromY + dir;
    if (inBounds(fromX, ny) && emptyAt(fromX, ny)) {
      if (ny === promoY) {
        for (const pt of ["q", "r", "b", "n"] as PieceType[]) moves.push({ to: { x: fromX, y: ny }, promotion: pt });
      } else {
        moves.push({ to: { x: fromX, y: ny } });
        if (fromY === startY && emptyAt(fromX, fromY + 2 * dir)) {
          moves.push({ to: { x: fromX, y: fromY + 2 * dir } });
        }
      }
    }
    for (const dx of [-1, 1]) {
      const tx = fromX + dx, ty = fromY + dir;
      if (!inBounds(tx, ty)) continue;
      if (enemyAt(tx, ty)) {
        if (ty === promoY) {
          for (const pt of ["q", "r", "b", "n"] as PieceType[]) moves.push({ to: { x: tx, y: ty }, promotion: pt });
        } else {
          moves.push({ to: { x: tx, y: ty } });
        }
      } else if (state.enPassant && state.enPassant.x === tx && state.enPassant.y === ty) {
        moves.push({ to: { x: tx, y: ty }, isEnPassant: true });
      }
    }
  } else if (p.type === "n") {
    const kn = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
    for (const [dx, dy] of kn) {
      const tx = fromX + dx, ty = fromY + dy;
      if (inBounds(tx, ty) && !friendlyAt(tx, ty)) moves.push({ to: { x: tx, y: ty } });
    }
  } else if (p.type === "k") {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const tx = fromX + dx, ty = fromY + dy;
      if (inBounds(tx, ty) && !friendlyAt(tx, ty)) moves.push({ to: { x: tx, y: ty } });
    }
    const homeY = p.color === "w" ? 7 : 0;
    const opp: Color = p.color === "w" ? "b" : "w";
    if (fromX === 4 && fromY === homeY) {
      const cK: keyof Castling = p.color === "w" ? "wK" : "bK";
      const cQ: keyof Castling = p.color === "w" ? "wQ" : "bQ";
      if (state.castling[cK]) {
        const r = b[homeY][7];
        if (emptyAt(5, homeY) && emptyAt(6, homeY) && r && r.type === "r" && r.color === p.color) {
          if (!squareAttacked(b, opp, 4, homeY) && !squareAttacked(b, opp, 5, homeY) && !squareAttacked(b, opp, 6, homeY)) {
            moves.push({ to: { x: 6, y: homeY }, isCastle: "K" });
          }
        }
      }
      if (state.castling[cQ]) {
        const r = b[homeY][0];
        if (emptyAt(1, homeY) && emptyAt(2, homeY) && emptyAt(3, homeY) && r && r.type === "r" && r.color === p.color) {
          if (!squareAttacked(b, opp, 4, homeY) && !squareAttacked(b, opp, 3, homeY) && !squareAttacked(b, opp, 2, homeY)) {
            moves.push({ to: { x: 2, y: homeY }, isCastle: "Q" });
          }
        }
      }
    }
  } else {
    const dirs: number[][] = [];
    if (p.type === "r" || p.type === "q") dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    if (p.type === "b" || p.type === "q") dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    for (const [dx, dy] of dirs) {
      let tx = fromX + dx, ty = fromY + dy;
      while (inBounds(tx, ty)) {
        if (friendlyAt(tx, ty)) break;
        moves.push({ to: { x: tx, y: ty } });
        if (enemyAt(tx, ty)) break;
        tx += dx; ty += dy;
      }
    }
  }
  return moves;
}

function simulate(state: GameState, from: Sq, m: PseudoMove): Board {
  const b = cloneBoard(state.board);
  const p = b[from.y][from.x]!;
  b[from.y][from.x] = null;
  b[m.to.y][m.to.x] = m.promotion ? { color: p.color, type: m.promotion } : p;
  if (m.isEnPassant) b[from.y][m.to.x] = null;
  if (m.isCastle) {
    const y = from.y;
    if (m.isCastle === "K") { b[y][5] = b[y][7]; b[y][7] = null; }
    else { b[y][3] = b[y][0]; b[y][0] = null; }
  }
  return b;
}

export interface LegalMove extends PseudoMove { from: Sq; }

export function legalMovesForPlayer(state: GameState, color: Color): LegalMove[] {
  const out: LegalMove[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const p = state.board[y][x];
    if (!p || p.color !== color) continue;
    for (const m of pieceMoves(state, x, y)) {
      const simBoard = simulate(state, { x, y }, m);
      const kingSq = findKing(simBoard, color);
      if (!kingSq) continue;
      const opp: Color = color === "w" ? "b" : "w";
      if (!squareAttacked(simBoard, opp, kingSq.x, kingSq.y)) {
        out.push({ from: { x, y }, ...m });
      }
    }
  }
  return out;
}

export function applyMove(
  state: GameState,
  from: Sq,
  to: Sq,
  promotion?: PieceType,
): { ok: true; move: Move; gameOver?: { winner: Color | "draw"; reason: "matt" | "patt" } } | { ok: false; reason: string } {
  const legals = legalMovesForPlayer(state, state.turn);
  const exact = legals.filter(m => m.from.x === from.x && m.from.y === from.y && m.to.x === to.x && m.to.y === to.y);
  if (exact.length === 0) return { ok: false, reason: "Ungültiger Zug." };
  let chosen: LegalMove;
  if (exact.some(c => c.promotion)) {
    if (!promotion) return { ok: false, reason: "Umwandlung erforderlich." };
    const pm = exact.find(c => c.promotion === promotion);
    if (!pm) return { ok: false, reason: "Ungültige Umwandlung." };
    chosen = pm;
  } else {
    chosen = exact[0];
  }
  return applyChosen(state, chosen);
}

function applyChosen(state: GameState, m: LegalMove): { ok: true; move: Move; gameOver?: { winner: Color | "draw"; reason: "matt" | "patt" } } {
  const b = state.board;
  const piece = b[m.from.y][m.from.x]!;
  const captured: Piece | null = m.isEnPassant ? b[m.from.y][m.to.x] : b[m.to.y][m.to.x];

  b[m.from.y][m.from.x] = null;
  b[m.to.y][m.to.x] = m.promotion ? { color: piece.color, type: m.promotion } : piece;
  if (m.isEnPassant) b[m.from.y][m.to.x] = null;
  if (m.isCastle) {
    const y = m.from.y;
    if (m.isCastle === "K") { b[y][5] = b[y][7]; b[y][7] = null; }
    else { b[y][3] = b[y][0]; b[y][0] = null; }
  }

  if (piece.type === "k") {
    if (piece.color === "w") { state.castling.wK = false; state.castling.wQ = false; }
    else { state.castling.bK = false; state.castling.bQ = false; }
  }
  if (piece.type === "r") {
    if (piece.color === "w" && m.from.y === 7) {
      if (m.from.x === 0) state.castling.wQ = false;
      if (m.from.x === 7) state.castling.wK = false;
    } else if (piece.color === "b" && m.from.y === 0) {
      if (m.from.x === 0) state.castling.bQ = false;
      if (m.from.x === 7) state.castling.bK = false;
    }
  }
  if (captured && captured.type === "r") {
    if (captured.color === "w") {
      if (m.to.x === 0 && m.to.y === 7) state.castling.wQ = false;
      if (m.to.x === 7 && m.to.y === 7) state.castling.wK = false;
    } else {
      if (m.to.x === 0 && m.to.y === 0) state.castling.bQ = false;
      if (m.to.x === 7 && m.to.y === 0) state.castling.bK = false;
    }
  }

  if (piece.type === "p" && Math.abs(m.to.y - m.from.y) === 2) {
    state.enPassant = { x: m.from.x, y: (m.from.y + m.to.y) / 2 };
  } else {
    state.enPassant = null;
  }

  if (piece.type === "p" || captured) state.halfMoveClock = 0;
  else state.halfMoveClock++;
  if (piece.color === "b") state.fullMoveNumber++;
  state.turn = piece.color === "w" ? "b" : "w";

  const move: Move = {
    from: m.from, to: m.to,
    piece: piece.type, color: piece.color,
    captured: captured ?? null,
    promotion: m.promotion,
    isEnPassant: m.isEnPassant,
    isCastle: m.isCastle,
  };

  const oppKing = findKing(state.board, state.turn);
  const inCheck = !!oppKing && squareAttacked(state.board, piece.color, oppKing.x, oppKing.y);
  move.check = inCheck;
  const oppMoves = legalMovesForPlayer(state, state.turn);
  let gameOver: { winner: Color | "draw"; reason: "matt" | "patt" } | undefined;
  if (oppMoves.length === 0) {
    move.mate = inCheck;
    gameOver = inCheck
      ? { winner: piece.color, reason: "matt" }
      : { winner: "draw", reason: "patt" };
  }
  move.san = toSAN(move);
  state.history.push(move);
  return gameOver ? { ok: true, move, gameOver } : { ok: true, move };
}

function toSAN(m: Move): string {
  const suf = m.mate ? "#" : m.check ? "+" : "";
  if (m.isCastle === "K") return "O-O" + suf;
  if (m.isCastle === "Q") return "O-O-O" + suf;
  const files = "abcdefgh";
  const fromSq = files[m.from.x] + (8 - m.from.y);
  const toSq = files[m.to.x] + (8 - m.to.y);
  const sep = m.captured || m.isEnPassant ? "x" : "-";
  const promo = m.promotion ? "=" + m.promotion.toUpperCase() : "";
  const pieceLetter = m.piece === "p" ? "" : m.piece.toUpperCase();
  return pieceLetter + fromSq + sep + toSq + promo + suf;
}

export function toPublicView(room: RoomState, playerId: string): PublicView {
  const idx = room.players.findIndex(p => p.id === playerId);
  const you = idx === 0 || idx === 1 ? (idx as 0 | 1) : null;
  const yourColor: Color | null = you !== null ? room.players[you].color : null;

  let legalMoves: { from: Sq; to: Sq; promotion?: PieceType }[] = [];
  let inCheck = false;
  if (room.status === "spielen" && yourColor) {
    const kingSq = findKing(room.game.board, yourColor);
    const opp: Color = yourColor === "w" ? "b" : "w";
    if (kingSq) inCheck = squareAttacked(room.game.board, opp, kingSq.x, kingSq.y);
    if (room.game.turn === yourColor) {
      const lm = legalMovesForPlayer(room.game, yourColor);
      legalMoves = lm.map(m => ({ from: m.from, to: m.to, promotion: m.promotion }));
    }
  }

  const last = room.game.history[room.game.history.length - 1];
  const lastMove = last ? { from: last.from, to: last.to } : null;

  const capturedBy = (c: Color): PieceType[] =>
    room.game.history.filter(h => h.color === c && h.captured).map(h => h.captured!.type);

  return {
    code: room.code,
    status: room.status,
    turn: room.game.turn,
    winner: room.winner,
    result: room.result,
    you, yourColor,
    players: room.players.map(p => ({
      name: p.name, ready: p.ready, color: p.color,
      captured: p.color ? capturedBy(p.color) : [],
    })),
    board: room.game.board,
    legalMoves,
    lastMove,
    inCheck,
    history: room.game.history,
  };
}
