"""StudyBrain local server with verified Google identity and HttpOnly sessions."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
for line in (ROOT / '.env').read_text().splitlines() if (ROOT / '.env').exists() else []:
    if line.strip() and not line.lstrip().startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        if key.strip() in ('GOOGLE_CLIENT_ID', 'STUDYBRAIN_PORT'):
            os.environ.setdefault(key.strip(), value.strip().strip('\"\''))

CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
PORT = int(os.environ.get('STUDYBRAIN_PORT', '8000'))
DATA_DIR = ROOT / '.studybrain'
DB_PATH = DATA_DIR / 'auth.sqlite3'
TTL = 7 * 24 * 60 * 60


def init_db():
    DATA_DIR.mkdir(mode=0o700, exist_ok=True)
    with sqlite3.connect(DB_PATH) as db:
        db.execute('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, profile TEXT NOT NULL, expires REAL NOT NULL)')
    DB_PATH.chmod(0o600)


def verify_credential(credential):
    from google.auth.transport.requests import Request
    from google.oauth2 import id_token
    return id_token.verify_oauth2_token(credential, Request(), CLIENT_ID)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def allowed_host(self):
        return self.headers.get('Host') in (f'localhost:{PORT}', f'127.0.0.1:{PORT}')

    def cookie(self, name):
        try:
            cookies = SimpleCookie(self.headers.get('Cookie', ''))
            return cookies[name].value if name in cookies else ''
        except Exception:
            return ''

    def reply(self, code, data, cookie=None):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def session_hash(self):
        return hashlib.sha256(self.cookie('studybrain_session').encode()).hexdigest()

    def do_GET(self):
        if not self.allowed_host():
            return self.reply(403, {'error': 'Invalid host'})
        path = urlsplit(self.path).path
        if path == '/api/auth/config':
            csrf = self.cookie('studybrain_csrf')
            if len(csrf) != 43:
                csrf = secrets.token_urlsafe(32)
            return self.reply(200, {'clientId': CLIENT_ID, 'csrf': csrf, 'configured': bool(CLIENT_ID)},
                              f'studybrain_csrf={csrf}; Path=/; HttpOnly; SameSite=Strict')
        if path == '/api/auth/session':
            with sqlite3.connect(DB_PATH) as db:
                db.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
                row = db.execute('SELECT profile FROM sessions WHERE hash=? AND expires>?', (self.session_hash(), time.time())).fetchone()
            return self.reply(200, {'user': json.loads(row[0]) if row else None})
        if self.static_allowed(path):
            return super().do_GET()
        return self.reply(404, {'error': 'Not found'})

    def static_allowed(self, path):
        decoded = unquote(path)
        target = (ROOT / decoded.lstrip('/')).resolve()
        if decoded == '/':
            return True
        if ROOT not in target.parents or not target.is_file():
            return False
        rel = target.relative_to(ROOT)
        return str(rel) == 'index.html' or (rel.parts[0] in ('css', 'js', 'assets') and target.suffix in ('.js','.css','.png','.jpg','.webp','.svg')) or str(rel) == 'docs/google-signin.md'

    def do_HEAD(self):
        if not self.allowed_host() or not self.static_allowed(urlsplit(self.path).path):
            self.send_error(404)
            return
        super().do_HEAD()

    def do_POST(self):
        if not self.allowed_host() or self.headers.get('Origin') != 'http://' + self.headers.get('Host', ''):
            return self.reply(403, {'error': 'Invalid origin'})
        csrf = self.cookie('studybrain_csrf')
        if not csrf or not secrets.compare_digest(csrf, self.headers.get('X-CSRF-Token', '')):
            return self.reply(403, {'error': 'Invalid CSRF token'})
        path = urlsplit(self.path).path
        if path == '/api/auth/logout':
            with sqlite3.connect(DB_PATH) as db:
                db.execute('DELETE FROM sessions WHERE hash=?', (self.session_hash(),))
            return self.reply(200, {'ok': True}, 'studybrain_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
        if path != '/api/auth/google':
            return self.reply(404, {'error': 'Not found'})
        if not CLIENT_ID:
            return self.reply(503, {'error': 'Google sign-in is not configured'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 16384 or self.headers.get_content_type() != 'application/json':
                return self.reply(400, {'error': 'Invalid request'})
            data = json.loads(self.rfile.read(length))
            credential = data.get('credential')
            if not isinstance(credential, str) or not credential:
                raise ValueError('Missing credential')
            claims = verify_credential(credential)
            if claims.get('nonce') != csrf or not claims.get('email_verified') or not claims.get('sub'):
                raise ValueError('Invalid identity')
        except (ValueError, TypeError, AttributeError):
            return self.reply(401, {'error': 'Google identity could not be verified'})
        except Exception:
            # Never include tokens or provider response bodies in a log or error.
            return self.reply(503, {'error': 'Google verification unavailable. Try again.'})
        profile = {'id': claims['sub'], 'name': claims.get('name', ''), 'email': claims.get('email', '')}
        token = secrets.token_urlsafe(32)
        with sqlite3.connect(DB_PATH) as db:
            db.execute('DELETE FROM sessions WHERE hash=? OR expires<=?', (self.session_hash(), time.time()))
            db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(token.encode()).hexdigest(), json.dumps(profile), time.time() + TTL))
        self.reply(200, {'user': profile}, f'studybrain_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={TTL}')


if __name__ == '__main__':
    init_db()
    print(f'StudyBrain running at http://127.0.0.1:{PORT}', flush=True)
    print('Google sign-in configured.' if CLIENT_ID else 'Set GOOGLE_CLIENT_ID in .env to enable Google sign-in.', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
