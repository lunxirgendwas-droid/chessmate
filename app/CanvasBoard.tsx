"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Board, Color, GRID, PieceType, Sq } from "@/lib/types";

interface Props {
  board: Board;
  yourColor: Color | null;
  selected?: Sq | null;
  legalTargets?: Sq[];
  lastMove?: { from: Sq; to: Sq } | null;
  checkSquare?: Sq | null;
  onSquareClick?: (x: number, y: number) => void;
  interactive?: boolean;
  active?: boolean;
  flashCell?: Sq | null;
}

function cssVar(name: string): string {
  if (typeof window === "undefined") return "0 0 0";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "0 0 0";
}
function rgb(t: string) { return `rgb(${t.replace(/\s+/g, ",")})`; }
function rgba(t: string, a: number) { return `rgba(${t.replace(/\s+/g, ",")},${a})`; }

const GLYPH: Record<PieceType, string> = {
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

export default function CanvasBoard({
  board, yourColor, selected = null, legalTargets = [], lastMove = null, checkSquare = null,
  onSquareClick, interactive = true, active = true, flashCell = null,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [themeTick, setThemeTick] = useState(0);
  const [flashStart, setFlashStart] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => setSize(Math.floor(entries[0].contentRect.width)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick(t => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!flashCell) return;
    setFlashStart(performance.now());
    let raf: number;
    const tick = () => { setThemeTick(t => t + 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(() => { cancelAnimationFrame(raf); setFlashStart(null); }, 600);
    return () => { cancelAnimationFrame(raf); clearTimeout(stop); };
  }, [flashCell?.x, flashCell?.y]);

  const flip = yourColor === "b";
  const dispX = (x: number) => flip ? 7 - x : x;
  const dispY = (y: number) => flip ? 7 - y : y;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = size, h = size;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const labelPad = Math.max(18, Math.floor(w * 0.06));
    const board0 = w - labelPad;
    const cell = board0 / GRID;
    const ox = labelPad;
    const oy = labelPad;

    const COL_INK     = cssVar("--ink");
    const COL_MUTED   = cssVar("--muted");
    const COL_LINE    = cssVar("--line");
    const COL_OCEAN   = cssVar("--ocean");
    const COL_WAVE    = cssVar("--wave");
    const COL_ROSE    = cssVar("--rose");
    const COL_CORAL   = cssVar("--coral");
    const COL_SHELL   = cssVar("--shell");
    const COL_BLUSH   = cssVar("--blush");
    const COL_CREAM   = cssVar("--cream");
    const COL_SURFACE = cssVar("--surface");

    ctx.font = `500 ${Math.max(9, Math.floor(labelPad * 0.42))}px "Geist Mono", monospace`;
    ctx.fillStyle = rgb(COL_MUTED);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const files = "abcdefgh";
    for (let i = 0; i < GRID; i++) {
      const fileX = flip ? 7 - i : i;
      const rankY = flip ? 7 - i : i;
      ctx.fillText(files[fileX], ox + cell * (i + 0.5), oy * 0.55);
      ctx.fillText(String(8 - rankY), ox * 0.55, oy + cell * (i + 0.5));
    }

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const dx = dispX(x), dy = dispY(y);
        const px = ox + dx * cell;
        const py = oy + dy * cell;
        const light = (x + y) % 2 === 0;
        const isLast = lastMove && ((lastMove.from.x === x && lastMove.from.y === y) || (lastMove.to.x === x && lastMove.to.y === y));
        const isSel = selected && selected.x === x && selected.y === y;
        const isCheck = checkSquare && checkSquare.x === x && checkSquare.y === y;
        ctx.fillStyle = light ? rgba(COL_CREAM, 0.85) : rgba(COL_WAVE, 0.75);
        ctx.fillRect(px, py, cell, cell);
        if (isLast) {
          ctx.fillStyle = rgba(COL_BLUSH, 0.55);
          ctx.fillRect(px, py, cell, cell);
        }
        if (isCheck) {
          ctx.fillStyle = rgba(COL_ROSE, 0.32);
          ctx.fillRect(px, py, cell, cell);
        }
        if (isSel) {
          ctx.strokeStyle = rgb(COL_ROSE);
          ctx.lineWidth = Math.max(2, cell * 0.06);
          ctx.strokeRect(px + 1, py + 1, cell - 2, cell - 2);
        }
      }
    }

    const fontSize = Math.floor(cell * 0.74);
    ctx.font = `${fontSize}px "Segoe UI Symbol", "Apple Color Emoji", "Noto Sans Symbols 2", "DejaVu Sans", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const p = board[y][x];
        if (!p) continue;
        const dx = dispX(x), dy = dispY(y);
        const cx = ox + dx * cell + cell / 2;
        const cy = oy + dy * cell + cell / 2 + cell * 0.04;
        const glyph = GLYPH[p.type];
        if (p.color === "w") {
          ctx.lineWidth = Math.max(2, cell * 0.07);
          ctx.lineJoin = "round";
          ctx.strokeStyle = rgb(COL_INK);
          ctx.strokeText(glyph, cx, cy);
          ctx.fillStyle = "#fff";
          ctx.fillText(glyph, cx, cy);
        } else {
          ctx.lineWidth = Math.max(1, cell * 0.04);
          ctx.lineJoin = "round";
          ctx.strokeStyle = rgba(COL_SURFACE, 0.95);
          ctx.strokeText(glyph, cx, cy);
          ctx.fillStyle = rgb(COL_INK);
          ctx.fillText(glyph, cx, cy);
        }
      }
    }

    for (const t of legalTargets) {
      const dx = dispX(t.x), dy = dispY(t.y);
      const cx = ox + dx * cell + cell / 2;
      const cy = oy + dy * cell + cell / 2;
      const occ = board[t.y][t.x];
      if (occ) {
        ctx.strokeStyle = rgba(COL_ROSE, 0.85);
        ctx.lineWidth = Math.max(3, cell * 0.09);
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.42, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(COL_ROSE, 0.55);
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (flashCell && flashStart) {
      const elapsed = performance.now() - flashStart;
      const t = Math.min(1, elapsed / 600);
      const dx = dispX(flashCell.x), dy = dispY(flashCell.y);
      const px = ox + dx * cell + cell / 2;
      const py = oy + dy * cell + cell / 2;
      const radius = cell * (0.4 + t * 1.6);
      ctx.strokeStyle = rgba(COL_ROSE, 1 - t);
      ctx.lineWidth = Math.max(1, 3 * (1 - t));
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!active) {
      ctx.fillStyle = rgba(COL_INK, 0.04);
      ctx.fillRect(0, 0, w, h);
    }
  }, [size, themeTick, board, yourColor, selected, legalTargets, lastMove, checkSquare, active, flashCell, flashStart, flip]);

  useEffect(() => { draw(); }, [draw]);

  function cellFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Sq | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const labelPad = Math.max(18, Math.floor(size * 0.06));
    const board0 = size - labelPad;
    const cell = board0 / GRID;
    const dx = Math.floor((px - labelPad) / cell);
    const dy = Math.floor((py - labelPad) / cell);
    if (dx < 0 || dy < 0 || dx >= GRID || dy >= GRID) return null;
    const x = flip ? 7 - dx : dx;
    const y = flip ? 7 - dy : dy;
    return { x, y };
  }

  function handleClick(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!interactive || !onSquareClick) return;
    const c = cellFromEvent(e);
    if (c) onSquareClick(c.x, c.y);
  }

  return (
    <div ref={wrapRef} className="w-full" style={{ touchAction: "manipulation" }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handleClick}
        className={interactive ? "cursor-pointer select-none" : "select-none"}
        style={{ display: "block" }}
      />
    </div>
  );
}
