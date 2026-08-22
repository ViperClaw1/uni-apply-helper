import { expect, test, type Page } from "@playwright/test";

const SETTLE_MS = 700;
const BOUNCE_PX = 80;

type Sample = { y: number; t: number };

async function openLanding(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/welcome", { waitUntil: "load" });
  await expect
    .poll(async () => page.locator("[data-hiw-root=pin]").getAttribute("data-hiw-ready"), {
      timeout: 8_000,
    })
    .toBe("true");
  await page.mouse.move(640, 360);
}

async function currentStep(page: Page) {
  const raw = await page.locator("[data-hiw-counter]").getAttribute("data-hiw-step");
  return Number(raw);
}

async function pinTop(page: Page) {
  return page.locator("[data-hiw-root=pin]").evaluate((el) => el.getBoundingClientRect().top);
}

async function waitForStep(page: Page, step: number) {
  await expect.poll(() => currentStep(page)).toBe(step);
  await page.waitForTimeout(SETTLE_MS);
  expect(await visibleCaptionCount(page)).toBe(1);
}

async function visibleCaptionCount(page: Page) {
  return page.locator("[data-hiw-caption]").evaluateAll(
    (els) => els.filter((el) => Number.parseFloat(getComputedStyle(el).opacity) > 0.4).length,
  );
}

async function startPinSampling(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __hiwSamples?: Sample[]; __hiwRaf?: number };
    w.__hiwSamples = [];
    const t0 = performance.now();
    const loop = () => {
      const pin = document.querySelector("[data-hiw-root=pin]");
      const y = pin ? pin.getBoundingClientRect().top : 0;
      w.__hiwSamples!.push({ y, t: performance.now() - t0 });
      w.__hiwRaf = requestAnimationFrame(loop);
    };
    loop();
  });
}

async function stopSampling(page: Page) {
  return page.evaluate(() => {
    const w = window as Window & { __hiwSamples?: Sample[]; __hiwRaf?: number };
    if (w.__hiwRaf) cancelAnimationFrame(w.__hiwRaf);
    return w.__hiwSamples ?? [];
  });
}

function maxPinBounce(samples: Sample[]) {
  if (samples.length === 0) return 0;
  let bounce = 0;
  for (const sample of samples) {
    bounce = Math.max(bounce, Math.abs(sample.y));
  }
  return bounce;
}

async function userWheel(page: Page, deltaY: number) {
  await page.evaluate((dy) => {
    const event = new WheelEvent("wheel", {
      deltaY: dy,
      deltaX: 0,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    const canceled = !window.dispatchEvent(event);
    if (!canceled) window.scrollBy(0, dy);
  }, deltaY);
}

async function waitUntilLocked(page: Page) {
  await expect(page.locator("[data-hiw-root=pin]")).toHaveAttribute("data-hiw-locked", "true", {
    timeout: 8_000,
  });
  await waitUntilIdle(page);
}

async function waitUntilIdle(page: Page) {
  await expect
    .poll(async () => page.locator("[data-hiw-root=pin]").getAttribute("data-hiw-busy"), {
      timeout: 8_000,
    })
    .not.toBe("true");
}

async function isLocked(page: Page) {
  return (await page.locator("[data-hiw-root=pin]").getAttribute("data-hiw-locked")) === "true";
}

async function pinFromAbove(page: Page) {
  await page.locator("#how-it-works").evaluate((el) => {
    el.scrollIntoView({ behavior: "instant", block: "start" });
  });
  if (!(await isLocked(page))) {
    for (let i = 0; i < 12; i += 1) {
      await userWheel(page, 200);
      await page.waitForTimeout(50);
      if (await isLocked(page)) break;
    }
  }
  await waitUntilLocked(page);
}

async function scrollJustPastHiw(page: Page) {
  await page.locator("#universities").waitFor();
  await page.locator("#universities").evaluate((el) => {
    el.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(150);
}

test.describe("How it works scroll", () => {
  test("fast wheel into the section does not overshoot then snap back", async ({ page }) => {
    await openLanding(page);

    const top = await page.locator("#how-it-works").evaluate((el) => {
      return el.getBoundingClientRect().top + window.scrollY;
    });
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 420)), top);

    for (let i = 0; i < 10; i += 1) {
      await userWheel(page, 480);
    }

    await waitUntilLocked(page);
    expect(Math.abs(await pinTop(page))).toBeLessThan(32);
    expect(await currentStep(page)).toBe(1);
    expect(await visibleCaptionCount(page)).toBe(1);

    await startPinSampling(page);
    await page.waitForTimeout(400);
    const samples = await stopSampling(page);
    expect(maxPinBounce(samples)).toBeLessThan(BOUNCE_PX);
  });

  test("scrollIntoView onto the section does not snap back", async ({ page }) => {
    await openLanding(page);
    await page.locator("#how-it-works").evaluate((el) => {
      el.scrollIntoView({ behavior: "instant", block: "start" });
    });
    await waitUntilLocked(page);
    expect(await currentStep(page)).toBe(1);
    expect(Math.abs(await pinTop(page))).toBeLessThan(32);

    await startPinSampling(page);
    await page.waitForTimeout(400);
    const samples = await stopSampling(page);
    expect(maxPinBounce(samples)).toBeLessThan(BOUNCE_PX);
  });

  test("wheel inside the section moves exactly one step at a time both ways", async ({ page }) => {
    await openLanding(page);
    await pinFromAbove(page);
    expect(await currentStep(page)).toBe(1);

    await userWheel(page, 140);
    await waitForStep(page, 2);

    await userWheel(page, 140);
    await waitForStep(page, 3);

    await userWheel(page, -140);
    await waitForStep(page, 2);
  });

  test("rapid wheel burst inside the section still advances a single step", async ({ page }) => {
    await openLanding(page);
    await pinFromAbove(page);
    expect(await currentStep(page)).toBe(1);

    for (let i = 0; i < 6; i += 1) {
      await userWheel(page, 240);
    }
    await waitForStep(page, 2);
  });

  test("locked section keeps body fixed while stepping with wheel", async ({ page }) => {
    await openLanding(page);
    await pinFromAbove(page);
    expect(await currentStep(page)).toBe(1);

    await expect
      .poll(async () =>
        page.evaluate(() => document.body.style.position === "fixed"),
      )
      .toBe(true);

    await userWheel(page, 140);
    await waitForStep(page, 2);
    expect(await isLocked(page)).toBe(true);
    expect(
      await page.evaluate(() => document.body.style.position === "fixed"),
    ).toBe(true);

    await userWheel(page, 140);
    await waitForStep(page, 3);
    expect(await isLocked(page)).toBe(true);

    await userWheel(page, -140);
    await waitForStep(page, 2);
    expect(await isLocked(page)).toBe(true);
  });

  test("fast wheel up into the section lands on the last step without snap-back", async ({
    page,
  }) => {
    await openLanding(page);

    await scrollJustPastHiw(page);

    for (let i = 0; i < 16; i += 1) {
      await userWheel(page, -120);
      await page.waitForTimeout(80);
      if (await isLocked(page)) break;
    }

    await waitUntilLocked(page);
    expect(await currentStep(page)).toBe(9);
    expect(await visibleCaptionCount(page)).toBe(1);
    expect(Math.abs(await pinTop(page))).toBeLessThan(32);

    await startPinSampling(page);
    await page.waitForTimeout(400);
    const samples = await stopSampling(page);
    expect(maxPinBounce(samples)).toBeLessThan(BOUNCE_PX);
  });
});
