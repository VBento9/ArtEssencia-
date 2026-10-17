#!/usr/bin/env python3
"""Prepare an offline Fundão reference from the CTT export; never connects to DB.

Only geographic CP7 with one locality identity across the entire input qualify.
Shared codes and client-specific codes are quarantined, never assigned arbitrarily.
Usage: prepare_ctt_reference.py INPUT.zip OUTPUT_DIRECTORY
"""
import csv
import hashlib
import io
import json
import pathlib
import re
import sys
import zipfile
from collections import defaultdict


def prepare(source, output):
    output = pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    raw = pathlib.Path(source).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        info = archive.getinfo('todos_cp.txt')
        if info.file_size > 100_000_000:
            raise ValueError('Unexpectedly large postal export')
        # CTT legacy export uses Windows-1252, not UTF-8.
        text = archive.read(info).decode('cp1252')
        generated = '%04d-%02d-%02d' % info.date_time[:3]
    identities = defaultdict(set)
    client_codes = set()
    fundao = defaultdict(set)
    total = 0
    for line, row in enumerate(csv.reader(io.StringIO(text), delimiter=';'), 1):
        if len(row) != 17 or not re.fullmatch(r'\d{4}', row[14]) or not re.fullmatch(r'\d{3}', row[15]):
            raise ValueError(f'Malformed postal export line {line}')
        if not all(row[i].strip() for i in (0, 1, 2, 3)):
            raise ValueError(f'Missing locality identity line {line}')
        code = row[14] + '-' + row[15]
        identity = tuple(row[:4])
        identities[code].add(identity)
        if row[12].strip() or row[13].strip() or row[14][-1] not in '05':
            client_codes.add(code)
        if row[:2] == ['05', '04']:
            fundao[identity].add(code)
        total += 1
    version = f'CTT-export-{generated};sha256={sha}'
    approved, excluded, coverage = [], [], []
    for identity, codes in sorted(fundao.items()):
        eligible = []
        for code in sorted(codes):
            if len(identities[code]) != 1 or code in client_codes:
                excluded.append({'postal_code': code, 'locality': identity[3],
                                 'reason': 'shared_locality' if len(identities[code]) != 1 else 'client_specific',
                                 'identities': sorted(identities[code])})
            else:
                eligible.append(code)
                approved.append({'postal_code': code, 'locality_key': identity[3].strip().lower(),
                                 'source_name': 'CTT export supplied by owner', 'source_version': version})
        coverage.append({'locality': identity[3], 'ctt_identity': '/'.join(identity[:3]),
                         'total_codes': len(codes), 'eligible_codes': len(eligible),
                         'complete_postal_coverage': len(eligible) == len(codes)})
    # Current table permits one CP7 only; also reject a duplicated name with distinct
    # identities in this municipality instead of silently merging settlements.
    names = defaultdict(set)
    for identity in fundao:
        names[identity[3].strip().lower()].add(identity[:3])
    if any(len(ids) > 1 for ids in names.values()):
        raise ValueError('Duplicate locality names require explicit disambiguation')
    manifest = {'zip_sha256': sha, 'archive_member_date': generated,
                'source_rows': total, 'national_unique_codes': len(identities),
                'national_shared_codes': sum(len(ids) > 1 for ids in identities.values()),
                'scope': 'CTT district 05 / municipality 04 (Fundão)',
                'reference_rows': len(approved), 'excluded_associations': len(excluded),
                'coverage': coverage,
                'limitation': 'Postal-locality association only; does not prove street/door or physical residence.'}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (output / 'reference.json').write_text(json.dumps(approved, ensure_ascii=False, indent=2) + '\n')
    (output / 'excluded.json').write_text(json.dumps(excluded, ensure_ascii=False, indent=2) + '\n')
    # Atomic, insert-only data import. Refuse any existing row instead of overwriting
    # a later reviewed reference. No settings/order/client/product writes.
    values = ',\n'.join('(' + ','.join("'" + r[k].replace("'", "''") + "'" for k in
                       ('postal_code', 'locality_key', 'source_name', 'source_version')) + ',now())'
                       for r in approved)
    sql = ("BEGIN;\nLOCK TABLE public.artessencia_postal_locality_reference IN SHARE ROW EXCLUSIVE MODE;\n"
           "DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.artessencia_postal_locality_reference) THEN "
           "RAISE EXCEPTION 'Postal reference changed: review before import'; END IF; END $$;\n"
           "INSERT INTO public.artessencia_postal_locality_reference "
           "(postal_code,locality_key,source_name,source_version,verified_at) VALUES\n" + values + ';\nCOMMIT;\n')
    (output / 'import.sql').write_text(sql)
    print(json.dumps({k: v for k, v in manifest.items() if k != 'coverage'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('Usage: prepare_ctt_reference.py INPUT.zip OUTPUT_DIRECTORY')
    prepare(sys.argv[1], sys.argv[2])
