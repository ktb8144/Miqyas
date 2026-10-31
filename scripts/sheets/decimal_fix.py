"""Replace Latin decimal points between Arabic-Indic digits with the Arabic decimal separator (٫ U+066B)."""
import os
import pymupdf

AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
NASKH = os.environ.get("DALA_NASKH_TTF", os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "NotoNaskhArabic-Regular.ttf"))  # has U+066B
SEP_ADV = 0.222  # em, Noto Naskh Arabic advance of U+066B


def find_decimal_points(page):
    found = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                chars = s["chars"]
                for ch in chars:
                    if ch["c"] != ".":
                        continue
                    x0, _, x1, _ = ch["bbox"]
                    others = [c for c in chars if c is not ch]
                    left = [c for c in others if c["bbox"][2] <= x0 + 0.6]
                    right = [c for c in others if c["bbox"][0] >= x1 - 0.6]
                    if not left or not right:
                        continue
                    l_ch = max(left, key=lambda c: c["bbox"][2])
                    r_ch = min(right, key=lambda c: c["bbox"][0])
                    if l_ch["c"] in AR_DIGITS and r_ch["c"] in AR_DIGITS:
                        found.append({"bbox": ch["bbox"], "origin": ch["origin"], "size": s["size"], "color": s["color"]})
    return found


def fix_decimals(page):
    dots = find_decimal_points(page)
    if not dots:
        return 0
    for d in dots:
        x0, y0, x1, y1 = d["bbox"]
        w = x1 - x0
        # only the middle of the dot's advance, so neighbouring digits are untouched
        page.add_redact_annot(pymupdf.Rect(x0 + w * 0.3, y0, x1 - w * 0.3, y1), fill=False)
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
                          text=pymupdf.PDF_REDACT_TEXT_REMOVE)
    page.insert_font(fontname="naskh", fontfile=NASKH)
    for d in dots:
        x0, _, x1, _ = d["bbox"]
        size = d["size"]
        x = x0 + ((x1 - x0) - SEP_ADV * size) / 2
        c = d["color"]
        rgb = ((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255
        page.insert_text((x, d["origin"][1]), "٫", fontname="naskh", fontsize=size, color=rgb)
    return len(dots)
