import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
import requests

spec = importlib.util.spec_from_file_location('studybrain_server', Path(__file__).parents[1] / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class AuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        server.DATA_DIR = Path(cls.temp.name)
        server.DB_PATH = server.DATA_DIR / 'auth.sqlite3'
        server.init_db()
        cls.http = ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        server.PORT = cls.http.server_port
        cls.url = f'http://127.0.0.1:{server.PORT}'
        cls.thread = threading.Thread(target=cls.http.serve_forever,daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.temp.cleanup()
    def setUp(self):
        self.client = requests.Session()
        self.csrf = self.client.get(self.url+'/api/auth/config').json()['csrf']
        self.headers={'Origin':self.url,'X-CSRF-Token':self.csrf}
    def post(self,path,body=None,headers=None):
        return self.client.post(self.url+path,json=body or {},headers=self.headers if headers is None else headers)
    def test_csrf_and_origin_required(self):
        self.assertEqual(self.post('/api/auth/google',headers={'Origin':self.url}).status_code,403)
        self.assertEqual(self.post('/api/auth/google',headers={'Origin':'https://evil.example','X-CSRF-Token':self.csrf}).status_code,403)
    def test_unconfigured_is_honest(self):
        with patch.object(server,'CLIENT_ID',''):
            self.assertFalse(self.client.get(self.url+'/api/auth/config').json()['configured'])
            self.assertEqual(self.post('/api/auth/google',{'credential':'bogus'}).status_code,503)
    def test_invalid_identity_never_creates_session(self):
        with patch.object(server,'CLIENT_ID','test.apps.googleusercontent.com'),patch.object(server,'verify_credential',side_effect=ValueError()):
            self.assertEqual(self.post('/api/auth/google',{'credential':'bogus'}).status_code,401)
        self.assertIsNone(self.client.get(self.url+'/api/auth/session').json()['user'])
    def test_nonce_is_checked(self):
        with patch.object(server,'CLIENT_ID','test'),patch.object(server,'verify_credential',return_value={'sub':'123','nonce':'wrong','email_verified':True}):
            self.assertEqual(self.post('/api/auth/google',{'credential':'test'}).status_code,401)
    def test_verified_session_and_logout(self):
        claims={'sub':'123','nonce':self.csrf,'email_verified':True,'name':'Test Student','email':'student@example.test'}
        # The cryptographic verifier is the mocked boundary; no fake-login route exists in the app.
        with patch.object(server,'CLIENT_ID','test'),patch.object(server,'verify_credential',return_value=claims):
            result=self.post('/api/auth/google',{'credential':'test'})
        self.assertEqual(result.status_code,200)
        self.assertIn('HttpOnly',result.headers['Set-Cookie'])
        self.assertEqual(self.client.get(self.url+'/api/auth/session').json()['user']['id'],'123')
        self.assertEqual(self.post('/api/auth/logout').status_code,200)
        self.assertIsNone(self.client.get(self.url+'/api/auth/session').json()['user'])
    def test_private_files_and_hosts_not_served(self):
        for path in ['/.env','/.git/config','/server.py','/.studybrain/auth.sqlite3','/js/../server.py']:
            self.assertEqual(self.client.get(self.url+path).status_code,404,path)
        self.assertEqual(self.client.get(self.url+'/',headers={'Host':'evil.example'}).status_code,403)
        self.assertEqual(self.client.get(self.url+'/js/app.js').status_code,200)

if __name__=='__main__': unittest.main()
