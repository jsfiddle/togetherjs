/* Core two-peer behaviour: a session starts, a second client joins through the
   share link, and the two exchange state. This is the regression net for the
   ESM/jQuery rewrite — it covers the paths the old func_*.js doctests did. */

import { test, expect, openClient, startSession, peerCount } from "./fixtures.js";

test("a client can start a session and produce a share link", async ({ browser, hub, statics }) => {
  const page = await openClient(browser, hub);
  const shareUrl = await startSession(page);

  expect(shareUrl).toContain("togetherjs=");
  await expect(page.locator("#togetherjs-container")).toBeAttached();
  await expect(page.locator("#togetherjs-dock")).toBeAttached();
  expect(page.errors).toEqual([]);

  await page.context().close();
});

test("a second client joins and both see one peer", async ({ browser, hub, statics }) => {
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);

  const b = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS.running);

  await expect.poll(() => peerCount(a)).toBe(1);
  await expect.poll(() => peerCount(b)).toBe(1);

  expect(a.errors).toEqual([]);
  expect(b.errors).toEqual([]);

  await a.context().close();
  await b.context().close();
});

test("form fields sync between peers", async ({ browser, hub, statics }) => {
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS.running);
  await expect.poll(() => peerCount(a)).toBe(1);

  await a.fill("#name", "typed in A");
  await expect.poll(() => b.inputValue("#name")).toBe("typed in A");

  await b.fill("#notes", "typed in B");
  await expect.poll(() => a.inputValue("#notes")).toBe("typed in B");

  await a.context().close();
  await b.context().close();
});

test("chat messages reach the other peer", async ({ browser, hub, statics }) => {
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS.running);
  await expect.poll(() => peerCount(a)).toBe(1);

  await a.evaluate(() => {
    window.TogetherJS._internals.registry.need("chat").submit("hello from A");
  });

  await expect
    .poll(() =>
      b.evaluate(() =>
        Array.from(document.querySelectorAll("#togetherjs-chat .togetherjs-chat-content")).map(
          (el) => el.textContent.trim(),
        ),
      ),
    )
    .toContain("hello from A");

  await a.context().close();
  await b.context().close();
});

test("closing a session leaves the other peer with no peers", async ({ browser, hub, statics }) => {
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS.running);
  await expect.poll(() => peerCount(a)).toBe(1);

  await b.evaluate(() => window.TogetherJS());
  await expect.poll(() => peerCount(a)).toBe(0);

  await a.context().close();
  await b.context().close();
});
