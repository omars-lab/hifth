#!/usr/bin/env python3
"""The second app in an x-callback round trip, small enough to be a script.

The shell answers a request by asking the operating system to open the caller's
`x-success` (or `x-error`) address. Point that address at this receiver and the
system browser fetches it, which is the one observable moment: the answer has
left the app, crossed the operating system, and reached another process.

    callback-receiver.py --port-file P --answer-file A [--timeout 30]

Binds a free port on 127.0.0.1, writes the port number to P, waits for ONE
request, writes its decoded query (one `key=value` per line) to A, and exits 0.
Exits 1 if nothing arrives within the timeout. The browser tab that carried the
answer is shown a one-line page saying what arrived, so it explains itself.
"""
import argparse
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qsl, urlsplit

args = argparse.ArgumentParser()
args.add_argument("--port-file", required=True)
args.add_argument("--answer-file", required=True)
args.add_argument("--timeout", type=float, default=30)
opts = args.parse_args()


class Answer(BaseHTTPRequestHandler):
    got = False

    def do_GET(self):  # noqa: N802 (http.server's name)
        parts = urlsplit(self.path)
        items = parse_qsl(parts.query, keep_blank_values=True)
        with open(opts.answer_file, "w", encoding="utf-8") as out:
            out.write(f"path={parts.path}\n")
            for key, value in items:
                out.write(f"{key}={value}\n")
        body = (
            "<!doctype html><meta charset=utf-8><title>Hifth answered</title>"
            "<p style='font:16px system-ui;margin:2em'>Hifth answered on "
            f"<code>{parts.path}</code>: " + ", ".join(f"<code>{k}</code>" for k, _ in items) + ". "
            "This tab can be closed.</p>"
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        Answer.got = True

    def log_message(self, *_):
        pass


server = HTTPServer(("127.0.0.1", 0), Answer)
server.timeout = opts.timeout
with open(opts.port_file, "w", encoding="utf-8") as f:
    f.write(str(server.server_port))
server.handle_request()  # one request or the timeout, whichever first
server.server_close()
sys.exit(0 if Answer.got else 1)
