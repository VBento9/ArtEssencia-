#!/usr/bin/env python3
"""Build review candidates from centraldedados/codigos_postais CTT-derived CSV.
Usage: python3 scripts/extract_fundao_postal_candidates.py codigos_postais.csv concelhos.csv > review.csv
This is OFFLINE only. No DB writes, no invented codes, no automatic activation.
"""
import csv, sys, unicodedata
from collections import defaultdict

TARGETS = {"fundao", "castelejo", "enxabarda", "aldeia nova"}
def norm(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    return " ".join("".join(c for c in s if not unicodedata.combining(c)).casefold().split())

def read_rows(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096); f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        yield from csv.DictReader(f, dialect=dialect)

def main(postal, municipalities):
    fundao = {(str(r["cod_distrito"]).strip(), str(r["cod_concelho"]).strip())
              for r in read_rows(municipalities) if norm(r["nome_concelho"]) == "fundao"}
    if not fundao:
        raise ValueError("Fundão municipality not found in supplied data")
    all_codes = defaultdict(set)
    for r in read_rows(postal):
        if (str(r["cod_distrito"]).strip(), str(r["cod_concelho"]).strip()) not in fundao:
            continue
        cp4, cp3 = str(r["num_cod_postal"]).strip(), str(r["ext_cod_postal"]).strip()
        if not (cp4.isdigit() and cp3.isdigit() and len(cp4) <= 4 and len(cp3) <= 3):
            continue
        code = f"{int(cp4):04d}-{int(cp3):03d}"
        # The postal designation may differ from the settlement. Do not infer
        # a delivery locality from municipality or postal designation alone.
        all_codes[code].add(norm(r["nome_localidade"]))
    out = csv.writer(sys.stdout)
    out.writerow(["postal_code","locality_candidate","review_status","source_name","source_version"])
    for code, names in sorted(all_codes.items()):
        if len(names) != 1:
            out.writerow([code,"","ambiguous_multiple_localities","centraldedados/CTT","verify_date"])
        else:
            name = next(iter(names))
            out.writerow([code,name,"candidate_manual_review" if name in TARGETS else "outside_target_localities","centraldedados/CTT","verify_date"])

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: extract_fundao_postal_candidates.py codigos_postais.csv concelhos.csv")
    main(sys.argv[1], sys.argv[2])
