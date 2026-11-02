#!/usr/bin/env python3
"""Serve Splat Sector on localhost. Default port 8819, then the next free port."""

import argparse
import mimetypes
import os
import socket
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8819
DEFAULT_HOST = "127.0.0.1"

mimetypes.add_type("text/javascript", ".js", strict=True)
mimetypes.add_type("application/json", ".json", strict=True)
mimetypes.add_type("image/jpeg", ".jpg", strict=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        return


class Server(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def find_port(host, start, attempts=20):
    for port in range(start, start + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    return None


def main(argv=None):
    parser = argparse.ArgumentParser(description="Serve Splat Sector")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args(argv)

    port = find_port(args.host, args.port)
    if port is None:
        print(f"No free port from {args.port} through {args.port + 19}.", file=sys.stderr)
        return 1
    if port != args.port:
        print(f"Port {args.port} is busy. Using {port} instead.", flush=True)

    httpd = Server((args.host, port), Handler)
    url = f"http://{args.host}:{port}/"
    print(f"LISTENING {args.host} {port}", flush=True)
    print(f"Splat Sector is running at {url}", flush=True)
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception as exc:
            print(f"Could not open a browser ({exc}). Open {url} yourself.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
