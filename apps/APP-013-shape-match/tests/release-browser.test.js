"use strict";

// Verification-only Playwright. Run against the isolated release-package output.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const repo = path.resolve(__dirname, "../../..");
const portal = process.env.APP013_PORTAL_URL || "http://127.0.0.1:8050/apps/";
const app = new URL("apps/APP-013-shape-match/", portal).href;
const output = process.env.APP013_ARTIFACT_DIR || "/tmp/app013-release-browser";
fs.mkdirSync(output, { recursive: true });
const sdkURLs = ["https://www.googletagmanager.com/gtag/js?id=G-M5FPMG34LE", "https://www.clarity.ms/tag/y7wygqymd5"];
const oldSource = execFileSync("git", ["show", "cdfb05b329693ea0850a25de42363d8edfc39708:portal/apps.js"], { cwd: repo, encoding: "utf8" });
const originalCards = JSON.parse(JSON.stringify(vm.runInNewContext(oldSource.match(/const apps = (\[[\s\S]*?\n  \]);/)[1])));
const publicApps = ["APP-002-bubble-touch", "APP-003-fruit-pop", "APP-004-sound-play-piano", "APP-006-colorful-fireworks", "APP-010-liquid-play"];

async function routes(context, blocked = "") {
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (blocked === "loaders" && /\/shared\/(ga4|clarity)\.js$/.test(new URL(url).pathname)) return route.abort("failed");
    const index = sdkURLs.indexOf(url);
    if (index >= 0) {
      if (blocked) return route.abort("failed");
      return route.fulfill({ status: 200, contentType: "application/javascript",
        body: `window.__releaseSDK${index} = (window.__releaseSDK${index} || 0) + 1;` });
    }
    if (new URL(url).origin === new URL(portal).origin) return route.continue();
    return route.abort("blockedbyclient");
  });
}

async function analytics(page) {
  return page.evaluate(() => ({
    loaders: ["ga4", "clarity"].map((name) => [...document.scripts].filter((s) => s.src.endsWith(`/shared/${name}.js`)).length),
    sdkTags: ["https://www.googletagmanager.com/gtag/js?id=G-M5FPMG34LE", "https://www.clarity.ms/tag/y7wygqymd5"]
      .map((url) => [...document.scripts].filter((s) => s.src === url).length),
    executions: [window.__releaseSDK0, window.__releaseSDK1],
    commands: window.dataLayer.map((args) => args[0]),
    configs: window.dataLayer.filter((args) => args[0] === "config").map((args) => args[1]),
    clarity: typeof window.clarity
  }));
}

async function exercise(page, animal, next) {
  await page.waitForFunction((name) => document.querySelector("#board").dataset.animal === name, animal);
  const p = await page.locator("#piece").boundingBox(), t = await page.locator("#target").boundingBox();
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + 10);
  assert.equal(await page.locator("#board").getAttribute("data-state"), "completing");
  await page.mouse.up();
  await page.waitForFunction((name) => document.querySelector("#board").dataset.animal === name, next);
}

async function previousApp(page, name, width, height) {
  await page.goto(new URL("apps/" + name + "/", portal).href);
  await page.waitForTimeout(200);
  const sound = page.locator("#soundButton, #sound-toggle");
  if (await sound.count()) await sound.click();
  assert.deepEqual(await page.evaluate(() => [document.documentElement.scrollWidth > innerWidth,
    document.documentElement.scrollHeight > innerHeight]), [false, false]);
  const home = page.locator(".portal-home-button");
  const r = await home.boundingBox();
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= width && r.y + r.height <= height);
  await home.click();
  assert.ok(page.url().includes(name), "short home click cannot navigate");
  if (name.startsWith("APP-002")) {
    await page.locator(".bubble").first().waitFor({ state: "attached" });
    await page.locator(".bubble").first().focus();
    await page.keyboard.press("Enter");
    assert.ok(await page.locator(".is-popping").count() > 0);
  } else if (name.startsWith("APP-003")) {
    const initial = await page.locator("#fruitName").textContent();
    await page.locator("#fruitButton").click();
    assert.ok(await page.locator("#effectLayer .particle").count() > 0);
    await page.waitForTimeout(800);
    assert.notEqual(await page.locator("#fruitName").textContent(), initial);
  } else if (name.startsWith("APP-004")) {
    assert.equal(await page.locator(".key").count(), 7);
    await page.locator(".key").first().click();
    assert.ok((await page.locator("#status").textContent()).length > 0);
    assert.ok(await page.locator("#effects > *").count() > 0);
  } else {
    const before = await page.locator("canvas").evaluate((c) => c.toDataURL());
    await page.mouse.move(width * .7, height * .65);
    await page.mouse.down();
    await page.waitForTimeout(500);
    assert.notEqual(await page.locator("canvas").evaluate((c) => c.toDataURL()), before);
    await page.mouse.up();
  }
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  if (name.startsWith("APP-010")) {
    const rect = await home.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2150);
    await page.mouse.up();
    await page.waitForURL(portal);
    assert.equal(await page.locator(".app-card").count(), 6, "long home press returns to production portal path");
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const result = { portal, app, viewports: [], regressions: [], blocked: [], analytics: "real shared loaders, SDK responses stubbed; no production analytics sent" };
  try {
    for (const [width, height] of [[390,844], [844,390], [1024,768]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
      await routes(context);
      const page = await context.newPage(), errors = [], external = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(m.text()); });
      page.on("request", (r) => { if (new URL(r.url()).origin !== new URL(portal).origin) external.push(r.url()); });
      await page.goto(portal);
      const cards = await page.locator(".app-card").evaluateAll((es) => es.map((e) => ({
        name: e.querySelector(".app-name").textContent, icon: e.querySelector(".app-icon").textContent,
        href: e.getAttribute("href"), className: e.className.split("app-card--")[1] })));
      assert.equal(cards.length, 6);
      assert.deepEqual(cards.slice(0, 5), originalCards, "all previous cards unchanged");
      assert.equal(cards[5].name, "かたちポン！");
      assert.equal(cards[5].href, "apps/APP-013-shape-match/");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/portal-${width}x${height}.png`, fullPage: true });
      await page.getByRole("link", { name: "かたちポン！であそぶ" }).click();
      await page.waitForURL(app);
      assert.equal(await page.locator("main a, main iframe, main form, main input").count(), 0);
      assert.equal(await page.locator("main button").count(), 1);
      const initial = await analytics(page);
      assert.deepEqual(initial, { loaders: [1,1], sdkTags: [1,1], executions: [1,1], commands: ["js", "config"], configs: ["G-M5FPMG34LE"], clarity: "function" });
      // Repeat insertion and dynamic import: the per-document module map must
      // prevent the unmodified shared Clarity IIFE from running a second time.
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++) for (const name of ["ga4", "clarity"]) {
          const url = new URL(`../../shared/${name}.js`, location.href).href;
          const script = document.createElement("script");
          script.type = "module";
          script.src = url;
          await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
          script.remove();
          await import(url);
        }
        for (let i = 0; i < 3; i++) {
          window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
          window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
          window.dispatchEvent(new Event("resize"));
        }
      });
      await exercise(page, "turtle", "pig");
      assert.deepEqual(await analytics(page), initial, "one initialization after replay, lifecycle and gameplay");
      result.viewports.push({ width, height, analytics: initial, originalCardsUnchanged: true });
      for (const name of publicApps) {
        await previousApp(page, name, width, height);
        result.regressions.push({ app: name, width, height, result: "PASS" });
      }
      assert.deepEqual(errors, []);
      assert.ok(external.every((url) => sdkURLs.includes(url)), "only approved SDK URLs requested");
      await context.close();
      console.log(`PASS release ${width}x${height}: portal 6/original 5, nested paths, analytics once, 5 existing apps`);
    }
    for (const blocked of ["sdks", "loaders"]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await routes(context, blocked);
      const page = await context.newPage(), failures = [], errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("requestfailed", (r) => failures.push(r.url()));
      await page.goto(app);
      const animals = ["turtle", "pig", "chick", "fox", "fish"];
      for (let i = 0; i < animals.length; i++) await exercise(page, animals[i], animals[(i + 1) % animals.length]);
      assert.equal(failures.length, 2, "exactly the two intentionally blocked analytics resources");
      assert.deepEqual(errors, [], "analytics failure never throws an application exception");
      result.blocked.push({ mode: blocked, failures, allFiveAnimals: "PASS" });
      await context.close();
      console.log(`PASS blocked analytics (${blocked}): all 5 stages remain playable`);
    }
    fs.writeFileSync(output + "/release-browser-results.json", JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
