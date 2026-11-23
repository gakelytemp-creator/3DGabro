"""Phase-0 smoke test: seeded generation, dual scorer, search baseline."""
from __future__ import annotations
import argparse
from dataclasses import asdict
from hashlib import sha256
import json
from pathlib import Path
from world import generate, occupancy, exhaustive_search, scores, catalogue

def run(seed: int, count: int, output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    episodes = generate(seed, count)
    records = []
    for i, target in enumerate(episodes):
        guess, search_fit, actions = exhaustive_search(occupancy(target))
        records.append({'index': i, 'target': asdict(target), 'prediction': asdict(guess),
                        'search_observation_iou': search_fit,
                        'scores': scores(target, guess), 'search_actions': actions})
    path = output / 'episodes.jsonl'
    content = ''.join(json.dumps(row, sort_keys=True, separators=(',', ':')) + '\n' for row in records)
    path.write_text(content, encoding='utf-8')
    digest = sha256(content.encode('utf-8')).hexdigest()
    manifest = {'phase': 0, 'status': 'smoke_test_only', 'seed': seed, 'count': count,
                'catalogue_size': len(catalogue()), 'geometry': '16^3 sampled occupancy, not exact CAD',
                'method': 'fixed exhaustive search (no learning)', 'episodes_sha256': digest,
                'mean_geometry_iou': sum(r['scores']['geometry_iou'] for r in records)/count,
                'mean_edit_response_iou': sum(r['scores']['edit_response_iou'] for r in records)/count,
                'search_actions_total': sum(r['search_actions'] for r in records)}
    (output/'manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True)+'\n', encoding='utf-8')
    return manifest

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--seed', type=int, default=7)
    p.add_argument('--count', type=int, default=100)
    p.add_argument('--output', type=Path, default=Path('artifacts/gse001-phase0'))
    a = p.parse_args()
    if a.count < 1:
        p.error('--count must be positive')
    print(json.dumps(run(a.seed, a.count, a.output), indent=2))
