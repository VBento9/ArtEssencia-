#!/usr/bin/env python3
"""Validate a postal reference CSV offline; never connects to Supabase.
Input columns: postal_code,locality,source_name,source_version.
Usage: python3 scripts/postal_review_import.py reference.csv
"""
import csv, re, sys, unicodedata
from collections import defaultdict

def norm(value):
    s = unicodedata.normalize("NFKD", value.strip())
    return " ".join("".join(c for c in s if not unicodedata.combining(c)).casefold().split())

def main(path):
    matches = defaultdict(set)
    errors = []
    with open(path, encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"postal_code", "locality", "source_name", "source_version"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Missing required columns")
        for number, row in enumerate(reader, 2):
            code = (row["postal_code"] or "").strip()
            locality = norm(row["locality"] or "")
            if not re.fullmatch(r"[0-9]{4}-[0-9]{3}", code):
                errors.append((number, "invalid postal code"))
            elif not locality or not (row["source_name"] or "").strip() or not (row["source_version"] or "").strip():
                errors.append((number, "missing provenance or locality"))
            else:
                matches[code].add(locality)
    ambiguous = {code: sorted(names) for code, names in matches.items() if len(names) != 1}
    print(f"Codes: {len(matches)}; ambiguous: {len(ambiguous)}; errors: {len(errors)}")
    for code, names in sorted(ambiguous.items()):
        print(f"AMBIGUOUS {code}: {', '.join(names)}")
    for line, error in errors:
        print(f"LINE {line}: {error}")
    return 1 if ambiguous or errors or not matches else 0

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: postal_review_import.py reference.csv")
    sys.exit(main(sys.argv[1]))
