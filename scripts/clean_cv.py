"""Rewrite the rendered CV with minimal metadata (Title and Author only)."""
import os
from pypdf import PdfReader, PdfWriter

SRC = "public/rio-wirawan-cv.raw.pdf"
DST = "public/rio-wirawan-cv.pdf"

reader = PdfReader(SRC)
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
writer.metadata = None  # drop producer/creator/dates
writer.add_metadata({"/Title": "Rio Wirawan — Senior Android Developer CV", "/Author": "Rio Wirawan"})
writer.compress_identical_objects(remove_identicals=True, remove_unreferenced=True)
with open(DST, "wb") as fh:
    writer.write(fh)
os.remove(SRC)
print("Wrote", DST)
