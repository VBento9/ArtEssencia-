#!/usr/bin/env python3
"""Prepare a REVIEWABLE postal locality CSV; never writes to production.
Usage: python3 scripts/prepare_postal_localities.py codes.txt > postal_review.csv
codes.txt: one complete CP7 per line from a licensed/verified dataset.
This script checks GEO API PT responses; review results before importing.
"""
import csv, json, re, sys, time, unicodedata
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

TARGETS = {"fundao": "Fundão", "castelejo": "Castelejo",
           "enxabarda": "Enxabarda", "aldeia nova": "Aldeia Nova"}
def norm(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    return " ".join("".join(c for c in value if not unicodedata.combining(c)).lower().split())

def classify(payload):
    if not isinstance(payload, dict):
        return ("", "invalid_response")
    locality = payload.get("Localidade")
    municipality = payload.get("Concelho")
    if norm(municipality) != "fundao":
        return ("", "outside_municipality")
    if not isinstance(locality, str) or norm(locality) not in TARGETS:
        return ("", "unmatched_or_ambiguous")
    return (TARGETS[norm(locality)], "candidate_needs_review")

def main(path):
    codes = sorted({line.strip() for line in open(path, encoding="utf-8")
                    if re.fullmatch(r"\d{4}-\d{3}", line.strip())})
    writer = csv.writer(sys.stdout)
    writer.writerow(["postal_code", "locality", "status", "source", "source_version"])
    for code in codes:
        try:
            req = Request("https://json.geoapi.pt/cp/" + code, headers={"Accept": "application/json", "User-Agent": "ArtEssenciaPostalReview/1.0"})
            with urlopen(req, timeout=12) as response:
                payload = json.load(response)
            locality, status = classify(payload)
        except (HTTPError, URLError, TimeoutError, ValueError):
            locality, status = "", "lookup_failed"
        writer.writerow([code, locality, status, "GEO API PT", "manual-review-required"])
        time.sleep(0.25)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: prepare_postal_localities.py codes.txt")
    main(sys.argv[1])
