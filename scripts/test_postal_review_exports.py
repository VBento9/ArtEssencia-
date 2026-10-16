#!/usr/bin/env python3
"""Offline acceptance checks for postal review exports; no production writes."""
import csv, sys
from collections import defaultdict
from pathlib import Path

def load(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def main(folder):
    base=Path(folder)
    safe=load(base/"unambiguous_for_review.csv")
    ambiguous=load(base/"ambiguous_for_review.csv")
    safe_codes={r["postal_code"] for r in safe}
    ambiguous_codes={r["postal_code"] for r in ambiguous}
    assert not safe_codes & ambiguous_codes, "A code appears in both categories"
    assert len(safe_codes)+len(ambiguous_codes)==197024, "Unexpected CP7 coverage"
    def has(rows,code,locality,municipality="Fundão"):
        return any(r["postal_code"]==code and r["locality"]==locality and r["municipality"]==municipality for r in rows)
    assert has(safe,"6230-152","Castelejo")
    assert has(safe,"6230-153","Enxabarda")
    assert has(ambiguous,"6230-050","Aldeia Nova do Cabo")
    assert "6230-050" not in safe_codes
    assert not has(safe,"6230-152","Fundão")
    assert not has(safe,"6230-153","Fundão")
    print("PASS: unique CP7 sets disjoint, 197024 codes, target localities correct, shared CP7 quarantined")
    print("CAUTION: historic source freshness not verified; these are NOT approved live postal records.")

if __name__=="__main__":
    if len(sys.argv)!=2: sys.exit("Usage: test_postal_review_exports.py EXPORT_FOLDER")
    main(sys.argv[1])
