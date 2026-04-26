#!/usr/bin/env python3
import os
import socket
import threading
import time

import yaml
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

PAYLOAD_SIZE = 1000
PAYLOAD = bytes(PAYLOAD_SIZE)
DURATION = 60  # seconds

_state = {
    'running': False,
    'start_time': None,
    'stop_event': None,
    'active_streams': [],
}
_lock = threading.Lock()

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.yaml')


def load_config():
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def send_stream(dest_ip, dest_port, bandwidth_bps, stop_event):
    packets_per_second = bandwidth_bps / (PAYLOAD_SIZE * 8)
    if packets_per_second <= 0:
        return
    interval = 1.0 / packets_per_second
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        next_send = time.monotonic()
        while not stop_event.is_set():
            now = time.monotonic()
            if now >= next_send:
                try:
                    sock.sendto(PAYLOAD, (dest_ip, dest_port))
                except OSError:
                    pass
                next_send += interval
                if next_send < now:
                    next_send = now + interval
            else:
                wait = next_send - now
                if wait > 0.001:
                    time.sleep(wait - 0.001)
    finally:
        sock.close()


def run_traffic_session(streams, destinations, stop_event):
    threads = []
    for stream in streams:
        bw = stream['bandwidth_bps']
        priority = stream['priority']
        matched = [d for d in destinations if d.get('priority') == priority]
        for dest in matched:
            t = threading.Thread(
                target=send_stream,
                args=(dest['ip'], dest['port'], bw, stop_event),
                daemon=True,
            )
            t.start()
            threads.append(t)

    # Block until 60s elapses or stop signal arrives
    stop_event.wait(timeout=DURATION)
    stop_event.set()

    for t in threads:
        t.join(timeout=5)

    with _lock:
        _state['running'] = False
        _state['start_time'] = None
        _state['stop_event'] = None
        _state['active_streams'] = []


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/config')
def api_config():
    try:
        config = load_config()
        return jsonify({'destinations': config['destinations']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/status')
def api_status():
    with _lock:
        running = _state['running']
        start_time = _state['start_time']
        active_streams = list(_state['active_streams'])

    remaining = 0
    if running and start_time:
        elapsed = time.time() - start_time
        remaining = max(0.0, DURATION - elapsed)

    return jsonify({
        'running': running,
        'remaining': round(remaining),
        'active_streams': active_streams,
    })


@app.route('/api/start', methods=['POST'])
def api_start():
    with _lock:
        if _state['running']:
            return jsonify({'error': 'Traffic is already running'}), 409

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400

    streams = data.get('streams', [])
    if not streams:
        return jsonify({'error': 'No streams selected'}), 400

    try:
        config = load_config()
    except Exception as e:
        return jsonify({'error': f'Config error: {e}'}), 500

    destinations = config.get('destinations', [])
    if not destinations:
        return jsonify({'error': 'No destinations in config'}), 500

    stop_event = threading.Event()

    with _lock:
        _state['running'] = True
        _state['start_time'] = time.time()
        _state['stop_event'] = stop_event
        _state['active_streams'] = [s['name'] for s in streams]

    threading.Thread(
        target=run_traffic_session,
        args=(streams, destinations, stop_event),
        daemon=True,
    ).start()

    return jsonify({'status': 'started'})


@app.route('/api/stop', methods=['POST'])
def api_stop():
    with _lock:
        if not _state['running']:
            return jsonify({'error': 'Not running'}), 409
        stop_event = _state['stop_event']

    if stop_event:
        stop_event.set()

    return jsonify({'status': 'stopping'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
