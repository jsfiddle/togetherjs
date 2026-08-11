/* Shared harness for the end-to-end tests: a static file server for the built
   client, and the hub stub standing in for hub-worker. */

import { test as base } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startHub } from "../hub-stub.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".map": "application/json",
};

function startStatic(port) {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

export const test = base.extend({
  // One hub + static server per test file.
  hub: [
    async ({}, use) => {
      const hub = await startHub();
      await use(hub);
      await hub.close();
    },
    { scope: "worker" },
  ],
  statics: [
    async ({}, use) => {
      const server = await startStatic(8099);
      await use(server);
      await new Promise((r) => server.close(r));
    },
    { scope: "worker" },
  ],
});

export const expect = base.expect;

/* Chromium's --use-fake-device-for-media-capture produces no devices in this
   container (enumerateDevices returns an empty list in every headless mode),
   so getUserMedia is backed by tracks synthesised in the page instead.

   These are real MediaStreamTracks — a canvas capture and a WebAudio
   destination — so they negotiate, encode and flow over an RTCPeerConnection
   exactly like camera and microphone tracks. Only the device layer is
   substituted; everything the mesh does is exercised for real. */
function installSyntheticMedia() {
  function videoTrack() {
    const canvas = Object.assign(document.createElement("canvas"), {
      width: 320,
      height: 240,
    });
    const ctx = canvas.getContext("2d");
    let frame = 0;
    // Keep painting: a static canvas produces no frames after the first.
    setInterval(() => {
      frame++;
      ctx.fillStyle = `hsl(${frame % 360}, 70%, 50%)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 100);
    return canvas.captureStream(10).getVideoTracks()[0];
  }

  function audioTrack() {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const destination = ctx.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    return destination.stream.getAudioTracks()[0];
  }

  const fakeDevices = [
    { deviceId: "fake-audio", kind: "audioinput", label: "Fake microphone", groupId: "fake" },
    { deviceId: "fake-video", kind: "videoinput", label: "Fake camera", groupId: "fake" },
  ];

  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = async (constraints = {}) => {
    const tracks = [];
    if (constraints.audio) tracks.push(audioTrack());
    if (constraints.video) tracks.push(videoTrack());
    if (!tracks.length) throw new DOMException("No constraints", "NotFoundError");
    return new MediaStream(tracks);
  };
  navigator.mediaDevices.enumerateDevices = async () => fakeDevices;
}

/** Open a fresh browser context pointed at the example page. */
export async function openClient(browser, hub, { url } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // "Failed to load resource" carries no URL, so it cannot be attributed;
    // failed requests are tracked below instead, where the URL is available.
    if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) {
      errors.push(`console: ${m.text()}`);
    }
  });
  // Requests we do not control: the browser's automatic favicon probe, and
  // youtube.com, which the sandbox cannot reach (the YouTube sync feature
  // legitimately fetches its iframe API once a session starts).
  const IGNORED = /favicon\.ico|youtube\.com|ytimg\.com/;
  page.on("requestfailed", (r) => {
    if (!IGNORED.test(r.url())) errors.push(`requestfailed: ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !IGNORED.test(r.url())) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  page.errors = errors;
  await page.addInitScript(() => {
    // Keep the modal flow out of the way of assertions.
    window.TogetherJSConfig_suppressJoinConfirmation = true;
    window.TogetherJSConfig_suppressInvite = true;
    // The first-run walkthrough is a modal and its backdrop covers the dock,
    // so present as a returning user unless a test says otherwise.
    localStorage.setItem("togetherjs.settings.seenIntroDialog", "true");
    // util.testExpose() only publishes internals when this object already
    // exists, so it has to be created before the bundle evaluates.
    window.TogetherJSTestSpy = {};
  });
  await page.addInitScript(installSyntheticMedia);
  const target = url || `/examples/index.html?hub=${encodeURIComponent(hub.url)}`;
  await page.goto(target);
  return page;
}

/** Start a session and wait until the dock is up and the share link exists. */
export async function startSession(page) {
  await page.evaluate(() => window.TogetherJS());
  await page.waitForSelector("#togetherjs-container", { state: "attached" });
  await page.waitForFunction(() => window.TogetherJS.running && window.TogetherJS.shareUrl());
  return page.evaluate(() => window.TogetherJS.shareUrl());
}

/** Number of remote peers this client currently believes are live. */
export function peerCount(page) {
  return page.evaluate(
    () =>
      window.TogetherJS._internals.registry
        .need("peers")
        .getAllPeers(true)
        .filter((p) => !p.isSelf).length,
  );
}
