import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";

const require = createRequire(process.env.PW_REQUIRE_FROM ?? import.meta.url);
const { chromium } = require("playwright");
import path from "node:path";

const base = process.env.UNCHAIN_URL ?? "http://127.0.0.1:4173";
const out = path.resolve("scripts/.ui-shots");
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const failures = [];

function assert(name, ok, detail) {
  if (!ok) failures.push(`${name}: ${detail}`);
  else console.log(`ok ${name}`);
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const stage = document.querySelector(".stage");
    const pills = document.querySelector(".pills");
    const chips = document.querySelector(".chips");
    const box = (el) => {
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY
      };
    };
    return {
      doc: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight },
      bodyOverflow: getComputedStyle(body).overflow,
      stage: box(stage),
      pills: box(pills),
      chips: box(chips),
      sheet: Boolean(document.querySelector(".sheet"))
    };
  });
}

async function shot(page, name) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 360))));
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function chromeFit(page, vp) {
  if (vp.name !== "phone") return;
  const fit = await page.evaluate(() => {
    const dock = document.querySelector(".dock");
    const tabs = document.querySelector(".tabs");
    const dockBox = dock?.getBoundingClientRect();
    const tabsBox = tabs?.getBoundingClientRect();
    const labels = [...document.querySelectorAll(".tabs button")].map((button) => ({
      text: button.innerText.replace(/\s+/g, " ").trim(),
      clip: button.scrollHeight > button.clientHeight + 1 || button.scrollWidth > button.clientWidth + 1
    }));
    return {
      dockOverTabs: Boolean(dockBox && tabsBox && dockBox.bottom > tabsBox.top + 1),
      tabsPastScreen: Boolean(tabsBox && tabsBox.bottom > window.innerHeight + 1),
      labels
    };
  });
  assert(`${vp.name} dock stays above the tab bar`, !fit.dockOverTabs, JSON.stringify(fit));
  assert(`${vp.name} tab bar stays on screen`, !fit.tabsPastScreen, JSON.stringify(fit));
  assert(`${vp.name} tab labels are fully drawn`, fit.labels.every((item) => !item.clip), JSON.stringify(fit.labels));
}

const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "desk", width: 1440, height: 900 }
];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "no-preference" });
  await page.goto(`${base}/uygulama`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Ana sayfa" }).waitFor();
  let m = await measure(page);
  assert(`${vp.name} home no sideways page`, m.doc.scrollWidth <= m.doc.clientWidth + 1, JSON.stringify(m.doc));
  if (m.chips) {
    assert(`${vp.name} chips no vertical scroll`, m.chips.scrollHeight <= m.chips.clientHeight + 2, JSON.stringify(m.chips));
  }
  if (vp.name === "desk") {
    assert("desk body locked", m.bodyOverflow === "hidden", m.bodyOverflow);
    assert("desk page does not grow past the window", m.doc.scrollHeight <= m.doc.clientHeight + 1, JSON.stringify(m.doc));
  }
  await shot(page, `${vp.name}-home`);
  await chromeFit(page, vp);

  await page.getByRole("button", { name: "Keşfet" }).click();
  await page.getByRole("heading", { name: "Keşfet" }).waitFor();
  m = await measure(page);
  assert(`${vp.name} explore no sideways page`, m.doc.scrollWidth <= m.doc.clientWidth + 1, JSON.stringify(m.doc));
  if (m.pills) assert(`${vp.name} pills no vertical scroll`, m.pills.scrollHeight <= m.pills.clientHeight + 2, JSON.stringify(m.pills));
  await shot(page, `${vp.name}-explore`);

  await page.getByRole("button", { name: "Kitaplık" }).click();
  await page.getByRole("heading", { name: "Kitaplık" }).waitFor();
  m = await measure(page);
  assert(`${vp.name} library no sideways page`, m.doc.scrollWidth <= m.doc.clientWidth + 1, JSON.stringify(m.doc));
  await shot(page, `${vp.name}-library`);

  const importNav = vp.name === "phone" ? "Alt gezinti" : "Bölümler";
  await page.getByRole("navigation", { name: importNav }).getByRole("button", { name: "İçe aktar", exact: true }).click();
  await page.getByText("Nasıl getirmek istediğini seç.").waitFor();
  m = await measure(page);
  assert(`${vp.name} sheet locks the page`, m.bodyOverflow === "hidden", m.bodyOverflow);
  assert(`${vp.name} sheet no sideways page`, m.doc.scrollWidth <= m.doc.clientWidth + 1, JSON.stringify(m.doc));
  const panel = await page.locator(".sheet .panel").boundingBox();
  assert(`${vp.name} sheet panel on screen`, Boolean(panel && panel.y >= -2 && panel.y < vp.height), JSON.stringify(panel));
  await shot(page, `${vp.name}-sheet`);
  await page.getByRole("button", { name: "Kapat" }).click();
  await page.locator(".sheet").waitFor({ state: "detached" });

  await page.getByRole("button", { name: "Keşfet" }).click();
  await page.locator("main").getByRole("button", { name: /Gece okuması/ }).click();
  await page.getByRole("button", { name: "Oynat" }).waitFor();
  const closeBox = await page.getByRole("button", { name: "Kapat" }).boundingBox();
  assert(`${vp.name} reader opens at the top`, Boolean(closeBox && closeBox.y >= 0 && closeBox.y < 160), JSON.stringify(closeBox));
  m = await measure(page);
  assert(`${vp.name} reader no sideways page`, m.doc.scrollWidth <= m.doc.clientWidth + 1, JSON.stringify(m.doc));
  if (vp.name === "phone") {
    const readerChrome = await page.evaluate(() => {
      const tabs = document.querySelector(".tabs");
      const style = tabs ? getComputedStyle(tabs) : null;
      const oda = document.querySelector(".transport .pills");
      const odaBox = oda?.getBoundingClientRect();
      return {
        tabsHidden: style?.display === "none",
        ambientRight: odaBox ? odaBox.right : 0,
        viewW: window.innerWidth
      };
    });
    assert("phone reader hides the tab bar", readerChrome.tabsHidden, JSON.stringify(readerChrome));
    assert("phone reader ambient row stays inside", readerChrome.ambientRight <= readerChrome.viewW + 1, JSON.stringify(readerChrome));
  }
  assert(
    `${vp.name} play label is Oynat`,
    (await page.getByRole("button", { name: "Oynat" }).getAttribute("aria-label")) === "Oynat",
    "aria"
  );
  await shot(page, `${vp.name}-reader`);
  await page.close();
}

const landing = await browser.newPage({ viewport: { width: 390, height: 844 } });
await landing.goto(base, { waitUntil: "networkidle" });
const land = await measure(landing);
assert("landing no sideways page", land.doc.scrollWidth <= land.clientWidth + 1 || land.doc.scrollWidth <= land.doc.clientWidth + 1, JSON.stringify(land.doc));
await shot(landing, "phone-landing");
await landing.close();

await browser.close();
await writeFile(path.join(out, "result.json"), JSON.stringify({ failures }, null, 2));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("ui motion e2e passed");
