#!/usr/bin/env python3
"""Simple smoke test for the API using only Python stdlib.

Usage: python test_smoke.py
"""
import json
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

BASE = "http://localhost:8000"

def post(path, payload):
    url = BASE + path
    data = json.dumps(payload).encode('utf-8')
    req = Request(url, data=data, headers={"Content-Type": "application/json"}, method='POST')
    try:
        with urlopen(req, timeout=5) as resp:
            return resp.getcode(), json.load(resp)
    except HTTPError as e:
        try:
            body = e.read().decode('utf-8')
        except Exception:
            body = ''
        return e.code, {'error': body}
    except URLError as e:
        print("Connection error:", e, file=sys.stderr)
        raise

def get(path):
    url = BASE + path
    req = Request(url, method='GET')
    try:
        with urlopen(req, timeout=5) as resp:
            return resp.getcode(), json.load(resp)
    except HTTPError as e:
        try:
            body = e.read().decode('utf-8')
        except Exception:
            body = ''
        return e.code, {'error': body}
    except URLError as e:
        print("Connection error:", e, file=sys.stderr)
        raise

def run():
    print("Starting smoke test against", BASE)
    # Generate a Fernet key-like value: the server currently expects a base64 key for Fernet.
    # We will attempt a server round-trip using a Fernet key generated client-side if server supports it.
    try:
        # use cryptography if available to make a valid Fernet key, otherwise use a placeholder which may fail
        try:
            from cryptography.fernet import Fernet
            key = Fernet.generate_key().decode()
            print("Generated Fernet key locally")
        except Exception:
            print("cryptography not available, using fallback random-ish key (may fail)")
            import base64, os
            key = base64.urlsafe_b64encode(os.urandom(32)).decode()

        plaintext = "smoke-test-{}".format(int(time.time()))

        code, body = post('/api/v1/encrypt', {'key': key, 'data': plaintext})
        if code != 200:
            print('ENCRYPT failed', code, body)
            return 2
        enc = body.get('encrypted_data') or body.get('data') or body
        print('Encrypted:', enc)

        # now decrypt
        code, body = post('/api/v1/decrypt', {'key': key, 'data': enc})
        if code != 200:
            print('DECRYPT failed', code, body)
            return 3
        dec = body.get('decrypted_data') or body.get('data') or body
        print('Decrypted:', dec)
        if isinstance(dec, dict):
            # unexpected shape
            print('Unexpected decrypt response:', dec)
            return 4
        if str(dec) != plaintext:
            print('ROUNDTRIP MISMATCH: expected', plaintext, 'got', dec)
            return 5

        # check logs endpoint
        code, body = get('/api/v1/logs')
        if code != 200:
            print('LOGS failed', code, body)
            return 6
        print('Logs response OK:', body)

        print('SMOKE TEST PASS')
        return 0
    except Exception as e:
        print('SMOKE TEST ERROR', e, file=sys.stderr)
        return 10

if __name__ == '__main__':
    sys.exit(run())
