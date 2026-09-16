#!/usr/bin/env python3
"""Fail-closed GitHub release provenance checks; never deploys resources."""
import argparse
import io
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request
import zipfile


def api(path):
    request = urllib.request.Request(
        f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/{path}",
        headers={"Authorization": f"Bearer {os.environ['GH_TOKEN']}",
                 "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def require_run(run, workflow, sha=None):
    if (run.get('path') != f'.github/workflows/{workflow}' or
            run.get('conclusion') != 'success' or run.get('head_branch') != 'main' or
            run.get('head_repository', {}).get('full_name') != os.environ['GITHUB_REPOSITORY'] or
            run.get('event') not in (('push',) if workflow == 'ci.yml' else ('workflow_run', 'workflow_dispatch')) or
            (sha is not None and run.get('head_sha') != sha)):
        raise ValueError('Run must be a successful main run from this repository and exact source SHA')


def require_ci(sha):
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('An immutable 40-character commit SHA is required')
    runs = api(f'actions/workflows/ci.yml/runs?head_sha={sha}&branch=main&event=push&per_page=100')['workflow_runs']
    if not runs:
        raise ValueError('No main push CI exists for this exact SHA')
    # A later failed rerun invalidates earlier success.
    require_run(max(runs, key=lambda r: r['id']), 'ci.yml', sha)


def manifest(run_id):
    run = api(f'actions/runs/{run_id}')
    require_run(run, 'staging.yml')
    artifacts = api(f'actions/runs/{run_id}/artifacts?per_page=100')['artifacts']
    items = [a for a in artifacts if a['name'] == 'staging-provenance' and not a['expired']]
    if len(items) != 1:
        raise ValueError('Staging provenance is missing, expired or ambiguous; stage again')
    # GitHub redirects downloads to signed object storage. Do not forward the
    # repository bearer token to the redirected host.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    request = urllib.request.Request(items[0]['archive_download_url'],
        headers={'Authorization': f"Bearer {os.environ['GH_TOKEN']}"})
    try:
        response = urllib.request.build_opener(NoRedirect()).open(request)
    except urllib.error.HTTPError as error:
        if error.code not in (301, 302, 303, 307, 308):
            raise
        location = error.headers['Location']
        if urllib.parse.urlparse(location).scheme != 'https':
            raise ValueError('Artifact download must use HTTPS')
        response = urllib.request.urlopen(location)
    with response:
        archive = zipfile.ZipFile(io.BytesIO(response.read()))
    data = json.loads(archive.read('staging-provenance.json'))
    if data.get('schema_version') != 1 or data.get('sha') != run['head_sha'] or data.get('repository') != os.environ['GITHUB_REPOSITORY']:
        raise ValueError('Staging artifact does not match its successful run')
    return data


def emit(name, value):
    if '\n' in str(value):
        raise ValueError('Invalid output')
    with open(os.environ.get('GITHUB_OUTPUT', os.devnull), 'a') as output:
        output.write(f'{name}={value}\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['candidate', 'baseline', 'promote', 'record'])
    parser.add_argument('--sha')
    parser.add_argument('--run-id')
    args = parser.parse_args()
    if args.command == 'candidate':
        if api('git/ref/heads/main')['object']['sha'] != args.sha:
            raise ValueError('Only the current main SHA may enter staging')
        require_ci(args.sha)
        emit('sha', args.sha)
    elif args.command == 'baseline':
        # Use deployed history, never the last push. Failed and queued runs cannot
        # cause a changed function to disappear from a subsequent release.
        runs = api('actions/workflows/staging.yml/runs?branch=main&status=success&per_page=100')['workflow_runs']
        for run in sorted(runs, key=lambda r: r['id'], reverse=True):
            artifacts = api(f"actions/runs/{run['id']}/artifacts?per_page=100")['artifacts']
            # Entirely skipped runs and the legacy workflow have no provenance.
            # Falling back to an older baseline conservatively redeploys changes.
            if not any(a['name'] == 'staging-provenance' for a in artifacts):
                continue
            data = manifest(run['id'])
            emit('base', data['sha'])
            return
        emit('base', '')  # First run deploys every function explicitly by name.
    elif args.command == 'promote':
        if not args.run_id or not args.run_id.isdigit():
            raise ValueError('A successful staging run ID is required')
        data = manifest(args.run_id)
        require_ci(data['sha'])
        # A stale candidate must be staged again; this also prevents accidental
        # rollback when a later main revision has already reached production.
        if api('git/ref/heads/main')['object']['sha'] != data['sha']:
            raise ValueError('Candidate is no longer main; stage the current revision')
        Path('staging-provenance.json').write_text(json.dumps(data, indent=2) + '\n')
        emit('sha', data['sha'])
    else:
        if os.environ.get('GITHUB_RUN_ID'):
            run = api(f"actions/runs/{os.environ['GITHUB_RUN_ID']}")
            if run.get('head_sha') != args.sha or run.get('head_branch') != 'main':
                raise ValueError('Staging workflow run SHA differs from deployed source; run staging again')
        data = {'schema_version': 1, 'sha': args.sha, 'repository': os.environ['GITHUB_REPOSITORY']}
        if Path('functions').is_dir():
            data['functions'] = sorted(p.parent.name for p in Path('functions').glob('*/index.ts'))
        if os.environ.get('DEPLOYMENT_URL'):
            data['deployment_url'] = os.environ['DEPLOYMENT_URL']
        Path('staging-provenance.json').write_text(json.dumps(data, indent=2) + '\n')


if __name__ == '__main__':
    main()
