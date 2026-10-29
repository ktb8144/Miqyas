"""Synthetic phone photos of filled Dala answer sheets, with ground truth.

Each sheet: A4 page with header "text", the answer block pasted in, bubbles marked in
varied human ways, then photographed: perspective, rotation, lighting gradient,
shadow, blur, noise, JPEG. Some photos are upside-down; some sheets belong to
another test (pkg-B) to check the wrong-sheet guard.
"""
import json, math, os, random, sys
import numpy as np
import cv2

OUT = sys.argv[1] if len(sys.argv) > 1 else "photos"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 120
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 7
HARD = os.environ.get("HARD") == "1"
random.seed(SEED); np.random.seed(SEED)
os.makedirs(OUT, exist_ok=True)

index = json.load(open("blocks/index.json"))
PX = 12  # px per mm on the page render
PAGE_W, PAGE_H = 210 * PX, 297 * PX
STYLES = ["clean", "clean", "pencil", "pencil", "pencil", "light", "partial", "x", "double", "erased", "blank", "blank", "stray"]
LETTERS = ["أ", "ب", "ج", "د"]


def block_to_page_px(mm, block_origin):
    # template mm (from TL marker centre) -> page px
    return (block_origin[0] + (mm[0] + 6) * PX, block_origin[1] + (mm[1] + 6) * PX)


def pencil_texture(h, w, base, spread):
    tex = np.random.normal(base, spread, (h, w))
    tex = cv2.GaussianBlur(tex, (0, 0), 1.2)
    return np.clip(tex, 0, 255)


def fill_disc(page, cx, cy, r, gray, coverage=1.0, offset=(0, 0), spread=12):
    rr = int(r * 1.25) + 3
    x0, y0 = int(cx - rr), int(cy - rr)
    h = w = 2 * rr
    tex = pencil_texture(h, w, gray, spread)
    mask = np.zeros((h, w), np.uint8)
    ox, oy = offset
    axes = (int(r * random.uniform(0.85, 1.08)), int(r * random.uniform(0.85, 1.08)))
    cv2.ellipse(mask, (rr + int(ox), rr + int(oy)), axes, random.uniform(0, 180), 0, 360, 255, -1)
    if coverage < 1.0:
        # keep a random part of the disc (a half-shaded bubble)
        angle = random.uniform(0, 2 * math.pi)
        yy, xx = np.mgrid[0:h, 0:w]
        proj = (xx - rr) * math.cos(angle) + (yy - rr) * math.sin(angle)
        cut = np.percentile(proj[mask > 0], (1 - coverage) * 100)
        mask[proj < cut] = 0
    region = page[y0:y0 + h, x0:x0 + w].astype(np.float32)
    m = (mask > 0)
    region[m] = np.minimum(region[m], tex[m])
    page[y0:y0 + h, x0:x0 + w] = region.astype(np.uint8)


def draw_x(page, cx, cy, r, gray):
    t = max(2, int(r * 0.22))
    d = r * 0.9
    cv2.line(page, (int(cx - d), int(cy - d)), (int(cx + d), int(cy + d)), int(gray), t, cv2.LINE_AA)
    cv2.line(page, (int(cx - d), int(cy + d)), (int(cx + d), int(cy - d)), int(gray), t, cv2.LINE_AA)


def make_sheet(entry, choose_wrong_sheet=False):
    t = entry["template"]
    block = cv2.imread(f"blocks/{entry['name']}.png", cv2.IMREAD_GRAYSCALE)
    page = np.full((PAGE_H, PAGE_W), 250, np.uint8)
    # header lines that look like text
    for i in range(6):
        y = 18 * PX + i * 9 * PX
        x1 = random.randint(30, 60) * PX
        cv2.rectangle(page, (x1, y), (190 * PX, y + int(2.5 * PX)), random.randint(90, 140), -1)
    origin = (int(14 * PX), int(80 * PX))
    bh, bw = block.shape
    page[origin[1]:origin[1] + bh, origin[0]:origin[0] + bw] = block
    r = t["bubbleRadius"] * PX
    truth = {"answers": {}, "styles": {}}
    for q in t["questions"]:
        style = random.choice(STYLES)
        target = random.randrange(4)
        centres = [block_to_page_px((b["x"], b["y"]), origin) for b in q["bubbles"]]
        cx, cy = centres[target]
        off = (random.uniform(-0.15, 0.15) * r, random.uniform(-0.15, 0.15) * r)
        if style == "clean":
            fill_disc(page, cx, cy, r, random.uniform(25, 70), 1.0, off, 8); expect = LETTERS[target]
        elif style == "pencil":
            fill_disc(page, cx, cy, r, random.uniform(70, 125), random.uniform(0.85, 1.0), off, 22); expect = LETTERS[target]
        elif style == "light":
            fill_disc(page, cx, cy, r, random.uniform(140, 170), random.uniform(0.8, 1.0), off, 18); expect = LETTERS[target] + "?"
        elif style == "partial":
            fill_disc(page, cx, cy, r, random.uniform(50, 110), random.uniform(0.35, 0.6), off, 15); expect = LETTERS[target] + "?"
        elif style == "x":
            draw_x(page, cx, cy, r, random.uniform(30, 90)); expect = LETTERS[target] + "?"
        elif style == "double":
            other = (target + random.randint(1, 3)) % 4
            fill_disc(page, cx, cy, r, random.uniform(40, 110), 1.0, off, 15)
            ox, oy = centres[other]
            fill_disc(page, ox, oy, r, random.uniform(40, 110), 1.0, off, 15); expect = "unclear"
        elif style == "erased":
            other = (target + random.randint(1, 3)) % 4
            ox, oy = centres[other]
            fill_disc(page, ox, oy, r, random.uniform(185, 215), random.uniform(0.6, 1.0), off, 10)
            fill_disc(page, cx, cy, r, random.uniform(40, 110), 1.0, off, 15); expect = LETTERS[target] + "?"
        elif style == "stray":
            fill_disc(page, cx, cy, r, random.uniform(40, 100), 1.0, off, 15)
            # pencil stroke between rows
            x0 = centres[0][0] + random.uniform(-2, 2) * PX
            y0 = cy + random.choice([-1, 1]) * 4 * PX
            cv2.line(page, (int(x0), int(y0)), (int(x0 - 25 * PX), int(y0 + random.uniform(-1, 1) * PX)), 90, 2, cv2.LINE_AA)
            expect = LETTERS[target]
        else:
            expect = "blank"
        truth["answers"][q["key"]] = expect
        truth["styles"][q["key"]] = style

    # student number
    code = None
    if entry["prefill"]:
        code = entry["prefill"]
        truth["code_style"] = "printed"
    elif random.random() < 0.85:
        code = random.randint(1, 49)
        ones, tens = code % 10, code // 10
        sc = t["studentCode"]
        b = sc["ones"]["bubbles"][ones]
        cx, cy = block_to_page_px((b["x"], b["y"]), origin)
        fill_disc(page, cx, cy, r, random.uniform(40, 110), 1.0, (0, 0), 15)
        if tens > 0 or random.random() < 0.5:
            b = sc["tens"]["bubbles"][tens]
            cx, cy = block_to_page_px((b["x"], b["y"]), origin)
            fill_disc(page, cx, cy, r, random.uniform(40, 110), 1.0, (0, 0), 15)
        truth["code_style"] = "pencil"
    else:
        truth["code_style"] = "blank"
    truth["code"] = str(code) if code else ""
    return page, truth


def photograph(page, upside_down):
    H, W = 1754, 1240
    ph, pw = page.shape
    # background
    bg = np.random.normal(random.uniform(60, 160), 25, (H, W)).astype(np.float32)
    bg = cv2.GaussianBlur(bg, (0, 0), 6)
    # where the page lands
    scale = (random.uniform(0.55, 0.8) if HARD else random.uniform(0.72, 0.97)) * min(W / pw, H / ph)
    cw, ch = pw * scale, ph * scale
    cx, cy = W / 2 + random.uniform(-0.06, 0.06) * W, H / 2 + random.uniform(-0.04, 0.04) * H
    ang = math.radians(random.uniform(-10, 10))
    base = np.array([[-cw / 2, -ch / 2], [cw / 2, -ch / 2], [cw / 2, ch / 2], [-cw / 2, ch / 2]])
    rot = np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]])
    dst = base @ rot.T + [cx, cy]
    dst += np.random.uniform(-0.06, 0.06, (4, 2)) if HARD else np.random.uniform(-0.035, 0.035, (4, 2)) * [cw, ch]  # perspective
    src = np.array([[0, 0], [pw, 0], [pw, ph], [0, ph]], np.float32)
    if upside_down:
        src = src[[2, 3, 0, 1]]
    M = cv2.getPerspectiveTransform(src.astype(np.float32), dst.astype(np.float32))
    warped = cv2.warpPerspective(page.astype(np.float32), M, (W, H), flags=cv2.INTER_AREA, borderValue=-1)
    mask = cv2.warpPerspective(np.ones_like(page, np.float32), M, (W, H), flags=cv2.INTER_LINEAR)
    img = bg * (1 - mask) + np.where(warped < 0, 0, warped) * mask
    # lighting gradient
    gx, gy = np.meshgrid(np.linspace(-1, 1, W), np.linspace(-1, 1, H))
    a, b = random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25)
    light = np.clip(random.uniform(0.4, 0.75) if HARD else random.uniform(0.75, 1.0) + a * gx + b * gy, 0.45, 1.05)
    img *= light
    # shadow (hand / phone)
    if random.random() < 0.45:
        sm = np.zeros((H, W), np.float32)
        pts = np.array([[random.randint(0, W), 0], [random.randint(0, W), H], [random.choice([0, W]), random.randint(0, H)]], np.int32)
        cv2.fillPoly(sm, [pts], 1.0)
        sm = cv2.GaussianBlur(sm, (0, 0), 40)
        img *= 1 - sm * random.uniform(0.2, 0.45)
    sigma = random.choice([1.2, 1.8, 2.4, 3.0]) if HARD else random.choice([0, 0.6, 1.0, 1.4, 1.8])
    if sigma:
        img = cv2.GaussianBlur(img, (0, 0), sigma)
    img += np.random.normal(0, random.uniform(6, 14) if HARD else random.uniform(2, 7), img.shape)
    img = np.clip(img, 0, 255).astype(np.uint8)
    color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    color = (color.astype(np.float32) * np.array([random.uniform(0.9, 1.0), 1.0, random.uniform(0.95, 1.1)])).clip(0, 255).astype(np.uint8)
    ok, enc = cv2.imencode(".jpg", color, [cv2.IMWRITE_JPEG_QUALITY, random.randint(35, 60) if HARD else random.randint(60, 90)])
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)


truths = []
by_name = {e["name"]: e for e in index}
for i in range(N):
    q = random.choice([10, 12, 12, 20, 30, 5])
    prefill = random.random() < 0.2
    wrong = q == 12 and random.random() < 0.15
    seed = "pkg-B" if wrong else "pkg-A"
    entry = by_name[f"q{q}-{seed}-{23 if prefill else 'blank'}"]
    page, truth = make_sheet(entry)
    upside = random.random() < 0.12
    photo = photograph(page, upside)
    name = f"{i:03d}.jpg"
    cv2.imwrite(os.path.join(OUT, name), photo)
    truth.update({"file": name, "q": q, "expectSeed": "pkg-A", "sheetSeed": seed, "upside": upside})
    truths.append(truth)
json.dump(truths, open(os.path.join(OUT, "truth.json"), "w"), ensure_ascii=False, indent=1)
print("wrote", len(truths))
