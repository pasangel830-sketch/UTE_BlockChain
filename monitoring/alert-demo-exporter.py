#!/usr/bin/env python3
"""Métricas sintéticas para LatenciaBloqueAlta y ErrorEndorsementAlto (ensayo día 13).
Los contadores suben cada scrape para que rate() no sea 0."""
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading
import time

lock = threading.Lock()
false_n = 0.0
true_n = 0.0
block_n = 0.0
block_sum = 0.0


def tick():
    global false_n, true_n, block_n, block_sum
    while True:
        with lock:
            false_n += 20.0
            true_n += 1.0
            block_n += 1.0
            block_sum += 8.0
        time.sleep(1)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        if self.path != "/metrics":
            self.send_response(404)
            self.end_headers()
            return
        with lock:
            body = (
                "# HELP endorser_proposal_duration_count Fabric endorser proposals\n"
                "# TYPE endorser_proposal_duration_count counter\n"
                f'endorser_proposal_duration_count{{success="false"}} {false_n}\n'
                f'endorser_proposal_duration_count{{success="true"}} {true_n}\n'
                "# HELP ledger_block_processing_time Block commit latency\n"
                "# TYPE ledger_block_processing_time histogram\n"
                f'ledger_block_processing_time_bucket{{le="0.005"}} 0\n'
                f'ledger_block_processing_time_bucket{{le="0.01"}} 0\n'
                f'ledger_block_processing_time_bucket{{le="0.05"}} 0\n'
                f'ledger_block_processing_time_bucket{{le="0.1"}} 0\n'
                f'ledger_block_processing_time_bucket{{le="0.5"}} 0\n'
                f'ledger_block_processing_time_bucket{{le="1"}} 0\n'
                f'ledger_block_processing_time_bucket{{le="5"}} 0\n'
                f'ledger_block_processing_time_bucket{{le="10"}} {block_n}\n'
                f'ledger_block_processing_time_bucket{{le="+Inf"}} {block_n}\n'
                f"ledger_block_processing_time_sum {block_sum}\n"
                f"ledger_block_processing_time_count {block_n}\n"
            ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    threading.Thread(target=tick, daemon=True).start()
    HTTPServer(("0.0.0.0", 9105), Handler).serve_forever()
