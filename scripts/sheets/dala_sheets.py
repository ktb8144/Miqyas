"""Dala question sheets: master files for the platform, and per-class print sets.

Two commands:

  master  Turn approved question sheets (one page per test, footer DALA-G6-C1-MATH-10-Vn) into V5 masters:
          Arabic decimal separator, written + shaded student number, room for the class QR, class name and
          school name, and the layout embedded in the PDF ("DalaSheet"). Upload a master as the test's
          question PDF; the platform stamps each class's copy when the teacher prints.

              python3 dala_sheets.py master --source Dala_G6_Cycle1_All_4_sheets.pdf --out masters/

  print   Stamp masters for a class list without the platform (same stamping code the platform runs,
          executed in headless Chromium). Codes are issued here and kept in a registry; a re-run reuses them.
          In the platform the database issues the codes instead (class_package_assignments.sheet_code).

              python3 dala_sheets.py print --masters masters/ --classes classes.csv --out print/ [--registry print/codes.csv]

          classes.csv columns: school, stage, grade, class

Needs: pymupdf, qrcode, playwright (Python) and the repo's node_modules (esbuild, pdf-lib, qrcode).
"""
import argparse, base64, csv, glob, json, os, re, secrets, subprocess, sys, time
import pymupdf
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from decimal_fix import fix_decimals  # noqa: E402
from templates import template_for_page  # noqa: E402

PT2MM, MM2PT = 25.4 / 72, 72 / 25.4
FONT_DIR = os.path.join(REPO, "public", "fonts")
AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
VERSION = "V5"
MASTER_KEY = "DalaSheet"

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # same as the database (migration 20261031010000)
CODE_LEN = 7

SUBJECT_TITLES = {"MATH": "تدريب الرياضيات", "ARABIC": "تدريب لغتي", "SCIENCE": "تدريب العلوم", "MOCK": "المحاكي المصغّر"}

# ── Header layout (mm from the page's top-left) ─────────────────────────────
QR_X, QR_Y, QR_SIZE = 15.4, 12.9, 16.0              # QR version 2 = 25 modules → 0.64 mm each
SCAN_TEXT = "امسح الكود بالكاميرا لترى نتيجتك"
SCAN_TOP = 33.0
NUM_RIGHT = 105.0
LABEL_W = 11.5
BOX = (75.5, 13.0, 15.0, 6.6)                       # write-in box: x, y, w, h
NUM_R, NUM_PITCH = 2.2, 5.6
DIGITS_TOP, ONES_Y, TENS_Y = 20.2, 25.6, 31.2
TENS_MAX = 4                                        # numbers 1–49
FIRST_X = NUM_RIGHT - LABEL_W - 2.2 - NUM_R
INSTRUCTION = "اكتب رقمك في المربع وظلّله، ثم ظلّل دائرة واحدة لكل سؤال بقلم الرصاص. المسودة على ظهر الورقة."
INSTR_BOX = (79.1, 42.59, 194.49, 47.36)
DALA_MARK = "أُعدّ بمنصة دالة"

# Where the platform stamps (see lib/omr/sheet-master.ts). Title metrics measured from the V3 title.
STAMP = {
    "title": {"right": 195.26, "left": 108.5, "baseline": 21.96, "size": 19.0, "minSize": 13.0, "gap": 2.6,
              "bar": {"width": 0.53, "above": 5.29, "below": 1.32, "color": "#9a9a9a"},
              "twoLine": {"right": 191.5, "baseline": 12.4, "size": 11.0, "minSize": 7.0}},  # keeps clear of the corner square
    "classLabel": {"cx": QR_X + QR_SIZE / 2, "baseline": 32.54, "size": 8.0, "minSize": 5.5, "maxWidth": 26.0, "prefix": "فصل"},
    "qr": {"x": QR_X, "y": QR_Y, "size": QR_SIZE},
}


def font_css():
    faces = []
    for weight in (500, 700):
        for subset in ("arabic", "latin"):
            data = base64.b64encode(open(f"{FONT_DIR}/ibm-plex-sans-arabic-{subset}-{weight}-normal.woff2", "rb").read()).decode()
            faces.append(f"@font-face{{font-family:Plex;font-weight:{weight};src:url(data:font/woff2;base64,{data}) format('woff2');}}")
    return "".join(faces)


def page_html(w, h, body):
    return f"""<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>{font_css()}
@page {{ size: {w}mm {h}mm; margin: 0 }} html,body {{ margin:0; padding:0; background:transparent }}
.t {{ position:absolute; font-family:Plex; font-weight:500; white-space:nowrap; line-height:1.3; color:#111 }}
.b {{ font-weight:700 }} .r {{ text-align:right }} .c {{ text-align:center }} .l {{ text-align:left }}
</style></head><body>{body}</body></html>"""


def number_bubbles():
    ones = [(round(FIRST_X - d * NUM_PITCH, 3), ONES_Y) for d in range(10)]
    tens = [(round(FIRST_X - d * NUM_PITCH, 3), TENS_Y) for d in range(TENS_MAX + 1)]
    return ones, tens


def static_overlay(w, h, footer, footer_box):
    ones, tens = number_bubbles()
    p = [f'<div class="t l" style="left:{QR_X}mm;width:60mm;top:{SCAN_TOP}mm;font-size:7pt;color:#333">{SCAN_TEXT}</div>']
    bx, by, bw, bh = BOX
    p.append(f'<div class="t r b" style="left:{NUM_RIGHT-20}mm;width:20mm;top:{by+bh/2-2.0}mm;font-size:8pt">رقم الطالب</div>')
    p.append(f'<div style="position:absolute;left:{bx}mm;top:{by}mm;width:{bw}mm;height:{bh}mm;box-sizing:border-box;border:0.3mm solid #555;border-radius:1.2mm"></div>')
    p.append(f'<div class="t r" style="left:{bx-30.5}mm;width:29mm;top:{by+bh/2-1.8}mm;font-size:7pt;color:#666">اكتبه ثم ظلّله</div>')
    for d, (x, _) in enumerate(ones):
        p.append(f'<div class="t c b" style="left:{x-2}mm;width:4mm;top:{DIGITS_TOP}mm;font-size:7.5pt;color:#555">{AR_DIGITS[d]}</div>')
    p.append(f'<div class="t r" style="left:{NUM_RIGHT-LABEL_W}mm;width:{LABEL_W}mm;top:{ONES_Y-2.1}mm;font-size:7.5pt;color:#555">الآحاد</div>')
    p.append(f'<div class="t r" style="left:{NUM_RIGHT-LABEL_W}mm;width:{LABEL_W}mm;top:{TENS_Y-2.1}mm;font-size:7.5pt;color:#555">العشرات</div>')
    circles = "".join(f'<circle cx="{x}" cy="{y}" r="{NUM_R-0.1323}"/>' for x, y in ones + tens)
    p.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" style="position:absolute;left:0;top:0;width:{w}mm;height:{h}mm" '
             f'fill="#fff" stroke="#444" stroke-width="0.2646">{circles}</svg>')
    x0, y0, x1, _ = INSTR_BOX
    p.append(f'<div class="t r" style="left:{x1-150+0.1}mm;width:150mm;top:{y0+0.82}mm;font-size:9pt;line-height:1">{INSTRUCTION}</div>')
    fx0, fy0, fx1, _ = footer_box
    p.append(f'<div class="t c" dir="ltr" style="left:{(fx0+fx1)/2-30}mm;width:60mm;top:{fy0+0.99}mm;font-size:7.5pt;color:#777;line-height:1">{footer}</div>')
    p.append(f'<div class="t r" style="left:{190.0-60}mm;width:60mm;top:{fy0+0.85}mm;font-size:7pt;color:#888;line-height:1">{DALA_MARK}</div>')
    return page_html(w, h, "".join(p))


FOOTER_RE = re.compile(r"^DALA-G(\d+)-C(\d+)-([A-Z]+)-(\d+)-V\d+$")


def read_tests(src):
    tests = []
    for idx, page in enumerate(src):
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    m = FOOTER_RE.match(s["text"].strip())
                    if m:
                        grade, cycle, subject, count = m.groups()
                        tests.append({"page": idx, "footer": s["text"].strip(), "footer_box": [v * PT2MM for v in s["bbox"]],
                                      "grade": int(grade), "cycle": int(cycle), "subject": subject, "count": int(count)})
    return tests


def make_master(src, test, ctx):
    doc = pymupdf.open()
    doc.insert_pdf(src, from_page=test["page"], to_page=test["page"])
    page = doc[0]
    fix_decimals(page)
    mm = lambda *v: pymupdf.Rect(*[x * MM2PT for x in v])
    page.add_redact_annot(mm(14.0, 12.6, 60.5, 31.0), fill=False)       # old written-number boxes
    page.add_redact_annot(mm(108.0, 13.0, 197.0, 24.0), fill=False)     # "دالة | <subject>" title and its bar
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
                          text=pymupdf.PDF_REDACT_TEXT_REMOVE)
    fb = test["footer_box"]
    page.add_redact_annot(mm(62.0, 41.6, 196.0, 48.2), fill=False)      # instruction sentence
    page.add_redact_annot(mm(fb[0] - 1, fb[1] - 0.3, fb[2] + 1, fb[3] + 0.3), fill=False)
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
                          text=pymupdf.PDF_REDACT_TEXT_REMOVE)
    w, h = page.rect.width * PT2MM, page.rect.height * PT2MM
    sheet = re.sub(r"-V\d+$", f"-{VERSION}", test["footer"])
    pg = ctx.new_page()
    pg.set_content(static_overlay(w, h, sheet, fb), wait_until="load")
    pg.evaluate("document.fonts.ready")
    ov = pymupdf.open("pdf", pg.pdf(width=f"{w}mm", height=f"{h}mm", print_background=True,
                                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}))
    pg.close()
    page.show_pdf_page(page.rect, ov, 0, overlay=True)

    template = template_for_page(page, sheet, NUM_R, (QR_X, QR_Y, QR_SIZE))
    template.pop("_page", None)
    stamp = dict(STAMP, page={"width": round(w, 3), "height": round(h, 3)}, subjectTitle=SUBJECT_TITLES.get(test["subject"], "تدريب"))
    layout = {"version": 1, "sheet": sheet, "template": template, "stamp": stamp}
    doc.set_metadata({"title": f"دالة — {sheet} (نسخة رئيسية)", "creator": "Dala", "producer": "Dala sheets"})
    info = doc.xref_get_key(-1, "Info")
    info_xref = int(info[1].split()[0])
    doc.xref_set_key(info_xref, MASTER_KEY, pymupdf.get_pdf_str(json.dumps(layout, ensure_ascii=True, separators=(",", ":"))))
    return doc, sheet, layout


def cmd_master(a):
    os.makedirs(a.out, exist_ok=True)
    src = pymupdf.open(a.source)
    tests = read_tests(src)
    if not tests:
        sys.exit("no DALA-… footer found in the source PDF")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context()
        for t in tests:
            doc, sheet, layout = make_master(src, t, ctx)
            path = os.path.join(a.out, f"{sheet}.pdf")
            doc.save(path, garbage=3, deflate=True)
            print(f"{path}: {len(layout['template']['questions'])} questions, number grid, QR at {layout['template']['printedQr']}")
        browser.close()


# ── print: the platform's own stamping code, run in headless Chromium ──────
def stamp_bundle():
    out = os.path.join(HERE, ".stamp-bundle.js")
    entry = os.path.join(REPO, "lib", "omr", "stamp-sheet.ts")
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(entry):
        subprocess.run(["npx", "esbuild", entry, "--bundle", "--format=iife", "--global-name=DalaStamp",
                        "--platform=browser", f"--outfile={out}"], cwd=REPO, check=True, capture_output=True)
    return open(out, encoding="utf-8").read()


def new_code(taken):
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LEN))
        if code not in taken:
            taken.add(code)
            return code


def cmd_print(a):
    os.makedirs(a.out, exist_ok=True)
    reg_path = a.registry or os.path.join(a.out, "codes.csv")
    registry = {}
    if os.path.exists(reg_path):
        for row in csv.DictReader(open(reg_path, encoding="utf-8-sig")):
            registry[row["key"]] = row
    taken = {r["code"] for r in registry.values()}
    masters = {}
    for path in sorted(glob.glob(os.path.join(a.masters, "*.pdf"))):
        doc = pymupdf.open(path)
        info = doc.xref_get_key(-1, "Info")
        if info[0] != "xref":
            continue
        raw = doc.xref_get_key(int(info[1].split()[0]), MASTER_KEY)
        if raw[0] == "null":
            continue
        layout = json.loads(raw[1] if raw[0] == "string" else _pdf_string(raw[1]))
        m = FOOTER_RE.match(layout["sheet"])
        masters[layout["sheet"]] = {"bytes": open(path, "rb").read(), "grade": int(m.group(1)), "subject": m.group(3)}
    if not masters:
        sys.exit(f"no Dala masters in {a.masters}")
    classes = list(csv.DictReader(open(a.classes, encoding="utf-8-sig")))
    fonts = {k: "data:font/woff2;base64," + base64.b64encode(open(f"{FONT_DIR}/ibm-plex-sans-arabic-{k}-700-normal.woff2", "rb").read()).decode()
             for k in ("arabic", "latin")}
    started, pages, issued = time.time(), 0, 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content("<!doctype html><html><body></body></html>")
        page.add_script_tag(content=stamp_bundle())
        for school in sorted({c["school"].strip() for c in classes}):
            rows = [c for c in classes if c["school"].strip() == school]
            folder = os.path.join(a.out, re.sub(r'[\\/:*?"<>|]+', "-", school))
            os.makedirs(folder, exist_ok=True)
            for sheet, m in masters.items():
                mine = [c for c in rows if int(c["grade"]) == m["grade"]]
                if not mine:
                    continue
                out = pymupdf.open()
                for c in mine:
                    key = "|".join([school, c["stage"].strip(), str(int(c["grade"])), c["class"].strip(), sheet.rsplit("-", 1)[0]])
                    if key not in registry:
                        code = new_code(taken)
                        registry[key] = {"key": key, "code": code, "url": "HTTPS://DALAEDU.COM/R/" + code, "school": school,
                                         "stage": c["stage"].strip(), "grade": str(int(c["grade"])), "class": c["class"].strip(),
                                         "subject": m["subject"], "sheet": sheet}
                        issued += 1
                    stamped = page.evaluate(
                        """async ([b64, school, cls, code, fonts]) => {
                             const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
                             const out = await DalaStamp.stampClassSheet({ master: bytes, schoolName: school, className: cls, sheetCode: code, fonts });
                             let s = ""; for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode(...out.subarray(i, i + 0x8000));
                             return btoa(s);
                           }""",
                        [base64.b64encode(m["bytes"]).decode(), school, c["class"].strip(), registry[key]["code"], fonts])
                    out.insert_pdf(pymupdf.open("pdf", base64.b64decode(stamped)))
                    pages += 1
                out.save(os.path.join(folder, f"{sheet}.pdf"), garbage=3, deflate=True)
        browser.close()
    fields = ["key", "code", "url", "school", "stage", "grade", "class", "subject", "sheet"]
    with open(reg_path, "w", newline="", encoding="utf-8-sig") as f:
        wr = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        wr.writeheader()
        wr.writerows(registry.values())
    codes = [r["code"] for r in registry.values()]
    assert len(codes) == len(set(codes)), "duplicate code in registry"
    print(json.dumps({"masters": len(masters), "pages": pages, "new_codes": issued, "codes_in_registry": len(codes),
                      "seconds": round(time.time() - started, 1)}, ensure_ascii=False))


def _pdf_string(raw):
    """Decode a PDF string object as returned by xref_get_key: (...) literal or <...> hex."""
    raw = raw.strip()
    if raw.startswith("<") and raw.endswith(">"):
        data = bytes.fromhex(raw[1:-1])
        return data[2:].decode("utf-16-be") if data[:2] == b"\xfe\xff" else data.decode("latin-1")
    body, out, i = raw[1:-1], [], 0
    escapes = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "(": "(", ")": ")", "\\": "\\"}
    while i < len(body):
        ch = body[i]
        if ch == "\\" and i + 1 < len(body):
            nxt = body[i + 1]
            if nxt in escapes:
                out.append(escapes[nxt]); i += 2; continue
            if nxt.isdigit():
                j = i + 1
                while j < len(body) and j < i + 4 and body[j] in "01234567":
                    j += 1
                out.append(chr(int(body[i + 1:j], 8))); i = j; continue
            i += 1; continue
        out.append(ch); i += 1
    return "".join(out)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("master")
    m.add_argument("--source", required=True)
    m.add_argument("--out", required=True)
    pr = sub.add_parser("print")
    pr.add_argument("--masters", required=True)
    pr.add_argument("--classes", required=True)
    pr.add_argument("--out", required=True)
    pr.add_argument("--registry")
    a = ap.parse_args()
    cmd_master(a) if a.cmd == "master" else cmd_print(a)


if __name__ == "__main__":
    main()
