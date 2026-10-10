import { SWIPE_WIDTH, swipeAxis, swipeOffset, swipeSettlesOpen } from "../lib/kaydir";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

assert(swipeOffset(0, -20) === -20, "kısa çekiş");
assert(swipeOffset(0, -800) === -SWIPE_WIDTH, "sol sınır");
assert(swipeOffset(0, 40) === 0, "sağ sınır");
assert(swipeOffset(-SWIPE_WIDTH, 40) === -SWIPE_WIDTH + 40, "açıktan geri");
assert(swipeSettlesOpen(-SWIPE_WIDTH / 2), "yarı açık kalır");
assert(!swipeSettlesOpen(-SWIPE_WIDTH / 2 + 1), "yarıdan az kapanır");
assert(swipeAxis(3, 2) === "none", "eşik altı");
assert(swipeAxis(-40, 4) === "x", "yatay");
assert(swipeAxis(6, 30) === "y", "dikey");

console.log("kaydir tamam");
