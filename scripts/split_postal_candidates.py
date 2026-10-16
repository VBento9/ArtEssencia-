#!/usr/bin/env python3
"""Validate extracted ArtEssencia postal CSV and split safe candidates for review.
No network/database access. Usage: python3 scripts/split_postal_candidates.py INPUT.csv OUTDIR
Input: postal_code,locality,municipality,status,source
Outputs: unambiguous_for_review.csv,ambiguous_for_review.csv,summary.txt
'Unambiguous' means only one locality in THIS dataset, NOT postal verification.
"""
import csv, pathlib, re, sys
from collections import defaultdict

def main(source, output_dir):
    output = pathlib.Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    groups = defaultdict(set)
    rows = []
    with open(source, newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        required = {"postal_code","locality","municipality","status","source"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"Missing columns: {required - set(reader.fieldnames or [])}")
        for number, row in enumerate(reader, 2):
            code = row["postal_code"].strip()
            locality = row["locality"].strip()
            municipality = row["municipality"].strip()
            if not re.fullmatch(r"\d{4}-\d{3}", code) or not locality or not municipality or not row["source"].strip():
                raise ValueError(f"Invalid source row {number}")
            groups[code].add((locality.casefold(), municipality.casefold()))
            rows.append(row)
    ambiguous = {code for code, names in groups.items() if len(names) > 1}
    # Respect ambiguous flag already provided by the extraction pipeline.
    ambiguous.update(row["postal_code"] for row in rows if row["status"] == "ambiguous")
    fields = ["postal_code","locality","municipality","status","source"]
    counts = {"unambiguous":0,"ambiguous":0}
    with open(output/"unambiguous_for_review.csv","w",newline="",encoding="utf-8-sig") as a, open(output/"ambiguous_for_review.csv","w",newline="",encoding="utf-8-sig") as b:
        safe, review = csv.DictWriter(a,fieldnames=fields), csv.DictWriter(b,fieldnames=fields)
        safe.writeheader(); review.writeheader()
        for row in rows:
            kind = "ambiguous" if row["postal_code"] in ambiguous else "unambiguous"
            (review if kind == "ambiguous" else safe).writerow(row)
            counts[kind]+=1
    summary = f"rows={len(rows)}\nunique_postal_codes={len(groups)}\nambiguous_codes={len(ambiguous)}\nunambiguous_rows={counts['unambiguous']}\nambiguous_rows={counts['ambiguous']}\nsource_verified=no\nproduction_import_allowed=no\n"
    (output/"summary.txt").write_text(summary,encoding="utf-8")
    print(summary,end="")

if __name__=="__main__":
    if len(sys.argv)!=3:
        sys.exit("Usage: split_postal_candidates.py INPUT.csv OUTDIR")
    main(sys.argv[1],sys.argv[2])
