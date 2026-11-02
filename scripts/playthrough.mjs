/**
 * Headless Chrome playthrough: 4 bots, short round, match must finish.
 * Usage: node scripts/playthrough.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shotDir = process.env.SPLAT_SHOTS || "/tmp/splat-shots";
fs.mkdirSync(shotDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeout, label) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${label}: ${JSON.stringify(last)}`);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath ? "python3" : "python3", ["server.py", "--no-browser", "--port", "8891"], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    const timer = setTimeout(() => reject(new Error(`server silent: ${buf}`)), 5000);
    proc.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      const line = buf.split("\n").find((l) => l.startsWith("LISTENING"));
      if (line) {
        clearTimeout(timer);
        const [, host, port] = line.split(" ");
        resolve({ proc, url: `http://${host}:${port}/index.html?autostart=1&round=4&wins=1&seed=3` });
      }
    });
    proc.on("exit", (code) => {
      if (code) reject(new Error(`server exited ${code}`));
    });
  });
}

function startChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "splat-chrome-"));
  const port = 9333;
  const proc = spawn("google-chrome", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1280,720",
    "about:blank",
  ], { stdio: "ignore" });
  return { proc, port, profile };
}

async function connectCdp(port) {
  let version;
  for (let i = 0; i < 40; i++) {
    try {
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
      break;
    } catch {
      await sleep(100);
    }
  }
  if (!version) throw new Error("chrome devtools did not come up");
  const created = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
  const ws = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("cdp socket failed")));
  });
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      exceptions.push(msg.params?.exceptionDetails?.text || "exception");
    }
  });
  function send(method, params = {}) {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
  }
  return { ws, send, exceptions };
}

async function shot(send, name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(shotDir, name);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}

async function main() {
  const server = await startServer();
  const chrome = startChrome();
  let failed = null;
  try {
    const cdp = await connectCdp(chrome.port);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const probe = `(() => window.__splat || null)()`;
    const titleUrl = server.url.replace(/\?.*$/, "");
    await cdp.send("Page.navigate", { url: titleUrl });
    await waitFor(async () => {
      const result = await cdp.send("Runtime.evaluate", { expression: probe, returnByValue: true });
      const value = result.result?.value;
      return value && value.mode === "title" && value.frame > 2 ? value : null;
    }, 10000, "title screen");
    await shot(cdp.send, "title.png");
    await cdp.send("Page.navigate", { url: server.url });
    await waitFor(async () => {
      const result = await cdp.send("Runtime.evaluate", { expression: probe, returnByValue: true });
      const value = result.result?.value;
      return value && value.mode === "play" && value.frame > 2 ? value : null;
    }, 10000, "match start");
    const early = await cdp.send("Runtime.evaluate", { expression: probe, returnByValue: true });
    const startPaint = early.result.value.paintSum;
    await waitFor(async () => {
      const result = await cdp.send("Runtime.evaluate", { expression: probe, returnByValue: true });
      return result.result?.value?.frame >= 120 ? result.result.value : null;
    }, 10000, "mid round");
    await shot(cdp.send, "playing.png");
    const done = await waitFor(async () => {
      const result = await cdp.send("Runtime.evaluate", { expression: probe, returnByValue: true });
      const value = result.result?.value;
      return value && value.mode === "matchend" ? value : null;
    }, 20000, "match end");
    const endShot = await shot(cdp.send, "match-end.png");
    if (cdp.exceptions.length) throw new Error(`page exceptions: ${cdp.exceptions.join("; ")}`);
    if (!done.bots.every(Boolean) || done.bots.length !== 4) throw new Error(`expected 4 bots, got ${JSON.stringify(done.bots)}`);
    if (!(done.paintSum > startPaint + 10)) throw new Error(`paint did not grow (${startPaint} -> ${done.paintSum})`);
    if (done.champion < 0 || done.champion > 3) throw new Error(`bad champion ${done.champion}`);
    if (!done.scores.some((n) => n >= 1)) throw new Error(`no round win in ${JSON.stringify(done.scores)}`);
    console.log(JSON.stringify({
      ok: true,
      url: server.url,
      frame: done.frame,
      paintStart: startPaint,
      paintEnd: done.paintSum,
      scores: done.scores,
      champion: done.champion,
      screenshots: [path.join(shotDir, "playing.png"), endShot],
    }, null, 2));
    cdp.ws.close();
  } catch (err) {
    failed = err;
  } finally {
    server.proc.kill("SIGTERM");
    chrome.proc.kill("SIGTERM");
    await sleep(300);
    try {
      fs.rmSync(chrome.profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      /* profile cleanup is best-effort */
    }
  }
  if (failed) {
    console.error(failed);
    process.exit(1);
  }
}

main();
