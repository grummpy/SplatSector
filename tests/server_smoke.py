#!/usr/bin/env python3
"""Smoke test: server.py serves the game on localhost."""

import os
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(ROOT, "server.py")


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main():
    port = free_port()
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(
        [sys.executable, SERVER, "--no-browser", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        env=env,
    )
    try:
        deadline = time.time() + 5
        line = ""
        while time.time() < deadline:
            if proc.poll() is not None:
                rest = proc.stdout.read() if proc.stdout else ""
                raise SystemExit(f"server exited {proc.returncode}: {line}{rest}")
            line = proc.stdout.readline()
            if line.startswith("LISTENING"):
                break
        else:
            raise SystemExit("server did not print LISTENING")
        parts = line.split()
        host, got = parts[1], int(parts[2])
        base = f"http://{host}:{got}"
        paths = (
            "/index.html",
            "/src/ui/main.js",
            "/src/core/sim.js",
            "/arcade.json",
            "/assets/cover.jpg",
            "/assets/icon.jpg",
        )
        for path in paths:
            with urllib.request.urlopen(base + path, timeout=5) as res:
                body = res.read()
                if res.status != 200 or not body:
                    raise SystemExit(f"{path} -> {res.status}")
        with urllib.request.urlopen(base + "/index.html", timeout=5) as res:
            html = res.read().decode("utf-8", "replace")
        if "<canvas" not in html or "Splat Sector" not in html:
            raise SystemExit("index.html is missing the game shell")
        print(f"server smoke ok {base}")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()
