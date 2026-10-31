"""Reads bubble geometry straight from a Dala sheet PDF and writes reader templates (OmrTemplate JSON).

Every position is in mm from the centre of the top-left corner marker, like lib/omr/types.ts expects.
Question bubbles are matched to their question (number box above them) and option letter (glyph inside).
Usage: python3 build_templates.py <sheet.pdf> <out.json> <label>
"""
import json, sys
import pymupdf

PT2MM = 25.4 / 72
LETTERS = ["أ", "ب", "ج", "د"]
AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"


def to_int(text):
    t = "".join(str(AR_DIGITS.index(c)) for c in text if c in AR_DIGITS)
    return int(t[::-1]) if t else None  # extracted RTL, so reverse


def spans(page):
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                for ch in s["chars"]:
                    x0, y0, x1, y1 = [v * PT2MM for v in ch["bbox"]]
                    yield ch["c"], (x0 + x1) / 2, (y0 + y1) / 2, s["size"], s["color"]



def template_for_page(page, tid, number_radius, qr):
    out = {}
    pno = 0
    markers, qbub, nbub, qboxes = [], [], [], []
    for d in page.get_drawings():
        r = d["rect"]
        w, h = r.width * PT2MM, r.height * PT2MM
        cx, cy = (r.x0 + r.x1) / 2 * PT2MM, (r.y0 + r.y1) / 2 * PT2MM
        col = d.get("color")
        if d["type"] == "f" and d.get("fill") == (0.0, 0.0, 0.0) and 6 < w < 8 and 6 < h < 8:
            markers.append((cx, cy, w))
        elif d["type"] in ("s", "fs") and col and abs(col[0] - 0.2667) < 0.01:
            if 5.8 < w < 7 and 5.8 < h < 7:
                qbub.append([cx, cy])
            elif 3.8 < w < 5.2 and 3.8 < h < 5.2:
                nbub.append([cx, cy])
        elif d["type"] == "s" and col and abs(col[0] - 0.0667) < 0.01 and 6 < w < 7.2 and 6 < h < 7.2:
            qboxes.append([cx, cy])
    assert len(markers) == 4, markers
    mx = sorted(m[0] for m in markers)
    my = sorted(m[1] for m in markers)
    ox, oy = (mx[0] + mx[1]) / 2, (my[0] + my[1]) / 2
    width = (mx[2] + mx[3]) / 2 - ox
    height = (my[2] + my[3]) / 2 - oy
    msize = sum(m[2] for m in markers) / 4

    chars = list(spans(page))
    # question number in each box
    boxes = []
    for bx, by in qboxes:
        digits = "".join(c for c, x, y, s, col in sorted(chars, key=lambda t: t[1]) if abs(x - bx) < 3 and abs(y - by) < 3 and c in AR_DIGITS)
        n = int("".join(str(AR_DIGITS.index(c)) for c in digits)) if digits else None
        boxes.append((n, bx, by))
    # option letter inside each bubble (small gray glyph)
    letters = []
    for bx, by in qbub:
        found = [c for c, x, y, s, col in chars if c in LETTERS and abs(x - bx) < 1.6 and abs(y - by) < 2.2 and s < 10]
        letters.append(found[0] if found else None)
    # assign bubbles to the nearest number box above, same column first
    groups = {}
    for (bx, by), letter in zip(qbub, letters):
        col = 0 if bx > 105 else 1
        cands = [b for b in boxes if b[2] <= by + 1 and (0 if b[1] > 105 else 1) == col]
        if not cands:
            cands = [b for b in boxes if b[2] <= by + 1]
        n, _, _ = max(cands, key=lambda b: b[2])
        groups.setdefault(n, {})[letter] = {"x": round(bx - ox, 3), "y": round(by - oy, 3)}
    questions = []
    for n in sorted(groups):
        g = groups[n]
        assert sorted(g) == sorted(LETTERS), (pno, n, g.keys())
        questions.append({"key": f"q{n}", "options": LETTERS, "bubbles": [g[l] for l in LETTERS]})
    assert len(questions) == 10, len(questions)

    tpl = {
        "id": tid,
        "width": round(width, 3), "height": round(height, 3),
        "markerSize": round(msize, 3), "bubbleRadius": 3.175,
        "questions": questions,
    }
    if nbub:
        nbub.sort(key=lambda b: (round(b[1]), -b[0]))
        ones = [b for b in nbub if abs(b[1] - min(v[1] for v in nbub)) < 1]
        tens = [b for b in nbub if b not in ones]
        ones.sort(key=lambda b: -b[0]); tens.sort(key=lambda b: -b[0])  # digit 0 on the right
        grp = lambda key, pts: {"key": key, "options": [str(i) for i in range(len(pts))],
                                "bubbles": [{"x": round(x - ox, 3), "y": round(y - oy, 3)} for x, y in pts], "radius": number_radius}
        tpl["studentCode"] = {"ones": grp("code_ones", ones), "tens": grp("code_tens", tens)}
    tpl["_page"] = {"originMm": [round(ox, 3), round(oy, 3)], "pageMm": [page.rect.width * PT2MM, page.rect.height * PT2MM]}
    tpl["printedQr"] = {"x": round(qr[0] - ox, 3), "y": round(qr[1] - oy, 3), "size": qr[2], "modules": 25}
    return tpl
