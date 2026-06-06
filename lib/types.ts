export type Color = "w" | "b";
export type PieceType = "k" | "q" | "r" | "b" | "n" | "p";

export interface Piece { color: Color; type: PieceType; }

export type Board = (Piece | null)[][];

export const GRID = 8;

export interface Sq { x: number; y: number; }

export interface Move {
  from: Sq;
  to: Sq;
  piece: PieceType;
  color: Color;
  captured?: Piece | null;
  promotion?: PieceType;
  isEnPassant?: boolean;
  isCastle?: "K" | "Q";
  san?: string;
  check?: boolean;
  mate?: boolean;
}

export interface Castling { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean; }

export interface GameState {
  board: Board;
  turn: Color;
  castling: Castling;
  enPassant: Sq | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  history: Move[];
}

export interface PlayerState {
  id: string;
  name: string;
  ready: boolean;
  color: Color | null;
}

export type RoomStatus = "warten" | "vorbereiten" | "spielen" | "beendet";
export type GameResult = "matt" | "patt" | "aufgegeben" | "remis" | null;

export interface RoomState {
  code: string;
  status: RoomStatus;
  players: PlayerState[];
  game: GameState;
  winner: 0 | 1 | null;
  result: GameResult;
  createdAt: number;
  updatedAt: number;
}

export interface PublicView {
  code: string;
  status: RoomStatus;
  turn: Color;
  winner: 0 | 1 | null;
  result: GameResult;
  you: 0 | 1 | null;
  yourColor: Color | null;
  players: { name: string; ready: boolean; color: Color | null; captured: PieceType[] }[];
  board: Board;
  legalMoves: { from: Sq; to: Sq; promotion?: PieceType }[];
  lastMove: { from: Sq; to: Sq } | null;
  inCheck: boolean;
  history: Move[];
  message?: string;
}
