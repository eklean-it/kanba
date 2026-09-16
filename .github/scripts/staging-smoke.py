#!/usr/bin/env python3
"""Read-only staging smoke: login shell, auth barrier and signed-in analytics."""
import importlib.util
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location('environment', Path(__file__).with_name('check-preview-env.py'))
environment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(environment)
settings = environment.parse(Path('.vercel/.env.preview.local').read_text())
environment.validate(Path('.vercel/.env.preview.local').read_text(), os.environ['TASKS_PROJECT_REF'])
base = os.environ['PLAYWRIGHT_BASE_URL'].rstrip('/')
headers = {'x-vercel-protection-bypass': os.environ.get('VERCEL_AUTOMATION_BYPASS_SECRET', '')}


def get(path, token=None):
    request = urllib.request.Request(base + path, headers={**headers, **({'Authorization': f'Bearer {token}'} if token else {})})
    return urllib.request.urlopen(request, timeout=30)


with get('/login') as response:
    if response.status != 200 or b'password' not in response.read().lower():
        raise RuntimeError('Login page did not render')
try:
    get('/api/admin/analytics')
except urllib.error.HTTPError as error:
    if error.code != 401:
        raise RuntimeError('Unexpected unauthenticated API response') from None
else:
    raise RuntimeError('Admin API did not reject unauthenticated access')
request = urllib.request.Request(settings['NEXT_PUBLIC_SUPABASE_URL'] + '/auth/v1/token?grant_type=password',
    data=json.dumps({'email': os.environ['AUDIT_EMAIL'], 'password': os.environ['AUDIT_PASSWORD']}).encode(),
    headers={'apikey': settings['NEXT_PUBLIC_SUPABASE_ANON_KEY'], 'Content-Type': 'application/json'})
with urllib.request.urlopen(request, timeout=30) as response:
    token = json.load(response)['access_token']
with get('/api/admin/analytics', token) as response:
    data = json.load(response)
    if response.status != 200 or not isinstance(data, dict):
        raise RuntimeError('Signed-in staging API did not return data')
print('Staging login, authorization barrier and signed-in API passed')
