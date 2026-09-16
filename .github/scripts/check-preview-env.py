#!/usr/bin/env python3
"""Require tasks-specific isolated database credentials for preview builds."""
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

TASKS_PRODUCTION = 'vpvjvfowfxhljojgokya'
OPS_PRODUCTION = 'rdcqahxevyljoitmukvw'
OPS_STAGING = 'vroaghkbtacwckykxhpi'


def parse(text):
    entries = {}
    for key, raw in re.findall(r'^([A-Z][A-Z0-9_]*)=(.*)$', text, re.M):
        entries[key] = json.loads(raw) if raw.startswith('"') else raw.strip("'")
    return entries


def validate(text, expected, production=False):
    if not re.fullmatch(r'[a-z]{20}', expected):
        raise ValueError('Set the explicit tasks project reference for this environment')
    if expected in (OPS_PRODUCTION, OPS_STAGING) or (production and expected != TASKS_PRODUCTION) or (not production and expected == TASKS_PRODUCTION):
        raise ValueError('Tasks requires its own database and staging must not target production')
    if any(ref in text for ref in ((OPS_PRODUCTION, OPS_STAGING) if production else (TASKS_PRODUCTION, OPS_PRODUCTION, OPS_STAGING))):
        raise ValueError('Configuration contains a forbidden database project reference')
    entries = parse(text)
    if entries.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/') != f'https://{expected}.supabase.co':
        raise ValueError('Supabase URL does not match tasks environment')
    for key in ('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'):
        if not entries.get(key):
            raise ValueError(f'Missing {key}')
    database = urlparse(entries['DATABASE_URL'])
    if not (database.hostname == f'db.{expected}.supabase.co' or
            (database.hostname and database.hostname.endswith('.pooler.supabase.com') and database.username == f'postgres.{expected}')):
        raise ValueError('Prisma database URL must match the tasks environment')
    if not production and (entries.get('STRIPE_SECRET_KEY', '').startswith('sk_live_') or entries.get('RESEND_API_KEY')):
        raise ValueError('Staging must use sandbox payment and messaging credentials')


if __name__ == '__main__':
    validate(Path(sys.argv[1]).read_text(), os.environ.get('TASKS_PROJECT_REF', ''), '--production' in sys.argv[2:])
