export const SWIPE_WIDTH = 276;

export function swipeOffset(origin: number, dx: number, width = SWIPE_WIDTH) {
  const next = origin + dx;
  if (next > 0) return 0;
  if (next < -width) return -width;
  return next;
}

export function swipeSettlesOpen(offset: number, width = SWIPE_WIDTH) {
  return offset <= -width / 2;
}

export function swipeAxis(dx: number, dy: number): "none" | "x" | "y" {
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return "none";
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}
