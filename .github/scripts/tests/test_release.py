import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f'{name}.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


gate = module('release-gate')
preview = module('check-preview-env')
SHA = 'a' * 40


class GateTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'GITHUB_REPOSITORY': 'example/admin'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.run = {'id': 1, 'path': '.github/workflows/ci.yml', 'conclusion': 'success',
                    'head_sha': SHA, 'head_branch': 'main', 'event': 'push',
                    'head_repository': {'full_name': 'example/admin'}}

    def test_requires_exact_successful_main_push(self):
        gate.require_run(self.run, 'ci.yml', SHA)
        for key, value in [('head_sha', 'b' * 40), ('head_branch', 'feature'),
                           ('conclusion', 'failure'), ('path', '.github/workflows/other.yml'),
                           ('event', 'pull_request'), ('head_repository', {'full_name': 'fork/admin'})]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                gate.require_run({**self.run, key: value}, 'ci.yml', SHA)

    def test_latest_failed_run_invalidates_older_success(self):
        with patch.object(gate, 'api', return_value={'workflow_runs': [self.run, {**self.run, 'id': 2, 'conclusion': 'failure'}]}):
            with self.assertRaises(ValueError):
                gate.require_ci(SHA)

    def test_no_ci_is_not_a_pass(self):
        with patch.object(gate, 'api', return_value={'workflow_runs': []}):
            with self.assertRaises(ValueError):
                gate.require_ci(SHA)


class PreviewTests(unittest.TestCase):
    reference = 'abcdefghijklmnopqrst'

    def settings(self):
        ref = self.reference
        return (f'NEXT_PUBLIC_SUPABASE_URL="https://{ref}.supabase.co"\n'
                'NEXT_PUBLIC_SUPABASE_ANON_KEY="test"\nSUPABASE_SERVICE_ROLE_KEY="test"\n'
                f'DATABASE_URL="postgresql://postgres.{ref}:unused@aws-0-us-west-2.pooler.supabase.com/postgres"\n')

    def test_requires_separate_tasks_staging(self):
        preview.validate(self.settings(), self.reference)
        for ref in (preview.TASKS_PRODUCTION, preview.OPS_PRODUCTION, preview.OPS_STAGING, ''):
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                preview.validate(self.settings().replace(self.reference, ref), ref)

    def test_rejects_production_prisma_url(self):
        with self.assertRaises(ValueError):
            preview.validate(self.settings().replace('postgres.' + self.reference, 'postgres.' + preview.TASKS_PRODUCTION), self.reference)

    def test_rejects_live_payment_credentials(self):
        with self.assertRaises(ValueError):
            preview.validate(self.settings() + 'STRIPE_SECRET_KEY="sk_live_test"\n', self.reference)


if __name__ == '__main__':
    unittest.main()
