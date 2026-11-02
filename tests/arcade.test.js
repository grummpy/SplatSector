import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("arcade manifest", () => {
  it("matches the arcade contract and points at real files", () => {
    const manifest = JSON.parse(read("arcade.json"));
    assert.deepEqual(manifest, {
      name: "Splat Sector",
      id: "splatsector",
      icon: "assets/icon.jpg",
      cover: "assets/cover.jpg",
      launch: {
        mac: "./launch-mac.command",
        windows: "launch-windows.bat",
        linux: "./launch-linux.sh",
        web: "index.html",
      },
      players: 4,
      port: 8819,
      minPlayers: 1,
      input: ["keyboard", "gamepad"],
      version: "1.0.0",
    });
    for (const rel of ["assets/icon.jpg", "assets/cover.jpg", "index.html"]) {
      assert.ok(fs.existsSync(path.join(root, rel)), rel);
    }
    for (const rel of Object.values(manifest.launch)) {
      const file = rel.replace(/^\.\//, "");
      assert.ok(fs.existsSync(path.join(root, file)), file);
    }
  });

  it("ships offline shell files with no CDN and a python launcher", () => {
    const html = read("index.html");
    assert.match(html, /<canvas/);
    assert.match(html, /type="module"/);
    assert.match(html, /src\/ui\/main\.js/);
    assert.doesNotMatch(html, /https?:\/\//);
    const server = read("server.py");
    assert.match(server, /8819/);
    assert.match(server, /127\.0\.0\.1/);
    for (const rel of ["launch-linux.sh", "launch-mac.command", "launch-windows.bat"]) {
      const text = read(rel);
      assert.match(text, /server\.py/);
      assert.match(text, /Python 3/);
    }
    for (const rel of ["launch-linux.sh", "launch-mac.command"]) {
      const mode = fs.statSync(path.join(root, rel)).mode;
      assert.ok(mode & 0o111, `${rel} should be executable`);
    }
  });

  it("has a workflow that runs the suite", () => {
    const workflow = read(".github/workflows/test.yml");
    assert.match(workflow, /node --test tests\/\*\.test\.js/);
    assert.match(workflow, /server_smoke\.py/);
  });
});
