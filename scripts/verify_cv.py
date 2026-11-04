"""Verify the public CV contains the expected content and nothing private."""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
from pypdf import PdfReader

PATH = "public/rio-wirawan-cv.pdf"
reader = PdfReader(PATH)
text = "\n".join(p.extract_text() or "" for p in reader.pages)
flat = re.sub(r"\s+", " ", text)
meta = {k: str(v) for k, v in (reader.metadata or {}).items()}
raw = open(PATH, "rb").read()

errors = []
for needle in ["Rio Wirawan", "Senior Android Developer", "riowirawan19@gmail.com", "PT. Infosys Solusi Terpadu",
               "Universitas Pembangunan Pancabudi", "CV. Dhuo Creative"]:
    if needle not in flat:
        errors.append(f"missing expected text: {needle!r}")

# Generic patterns only. Exact private values live in the gitignored private/cv-forbidden.txt.
forbidden = [r"Jl\.\s", r"Canva"]
_private = Path("private/cv-forbidden.txt")
if _private.exists():
    forbidden += [l.strip() for l in _private.read_text(encoding="utf-8").splitlines() if l.strip()]
else:
    print("note: private/cv-forbidden.txt not found; running generic privacy checks only")
for pat in forbidden:
    if re.search(pat, flat, re.I):
        errors.append(f"forbidden text in page content: {pat}")
    if re.search(pat.encode(), raw, re.I):
        errors.append(f"forbidden bytes in file: {pat}")
if re.search(r"\+?62\s?8\d{2}|\b08\d{8,11}\b", flat):
    errors.append("phone-number-like text found")

allowed_meta = {"/Title", "/Author"}
extra = set(meta) - allowed_meta
if extra:
    errors.append(f"unexpected metadata keys: {sorted(extra)}")
for page in reader.pages:
    for a in page.get("/Annots") or []:
        o = a.get_object()
        if o.get("/Subtype") != "/Link":
            errors.append(f"non-link annotation: {o.get('/Subtype')}")
if "/Metadata" in reader.trailer["/Root"]:
    errors.append("XMP metadata stream present")

print(f"pages={len(reader.pages)} metadata={meta}")
if errors:
    print("FAIL\n- " + "\n- ".join(errors))
    sys.exit(1)
print("OK: public CV verified")
