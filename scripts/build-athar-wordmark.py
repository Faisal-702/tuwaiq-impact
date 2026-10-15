"""Builds the أثـ — ـر wordmark (src/components/brand/athar-wordmark.tsx) as SVG
paths from Cairo's own glyph outlines: the text is shaped with HarfBuzz, the
tatweel strokes are set to fixed lengths and ر is enlarged slightly about its
joining point. Not part of the build; run it only to redraw the wordmark.

Requirements (any Python 3 environment): pip install fonttools brotli uharfbuzz

Usage:
  python scripts/build-athar-wordmark.py <cairo-arabic.woff2> <out.json> \
      [weight] [thLen] [barLen] [rehLen] [gap] [rehScale]
Lengths and the gap are in font units (1000 per em). The current wordmark:
  python scripts/build-athar-wordmark.py \
      node_modules/@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2 \
      wordmark.json 650 420 470 150 235 1.1
The output lists the paths (with their x offsets) and the view box; copy them
into the component.
"""
import io, json, sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

src, out = sys.argv[1], sys.argv[2]
wght = float(sys.argv[3]) if len(sys.argv) > 3 else 650
th_len, bar_len, reh_len, gap = (float(x) for x in (sys.argv[4:8] if len(sys.argv) > 7 else (180, 420, 160, 210)))
reh_scale = float(sys.argv[8]) if len(sys.argv) > 8 else 1.0

font = TTFont(src)
font.flavor = None
inst = instancer.instantiateVariableFont(font, {"wght": wght})
buf = io.BytesIO(); inst.save(buf); data = buf.getvalue()
ttf = TTFont(io.BytesIO(data))
gs = ttf.getGlyphSet()
order = ttf.getGlyphOrder()
upem = ttf["head"].unitsPerEm

hbface = hb.Face(data); hbfont = hb.Font(hbface)

def shape(text):
    b = hb.Buffer(); b.add_str(text); b.guess_segment_properties()
    hb.shape(hbfont, b, {})
    # Visual order left→right for RTL runs.
    return [(order[i.codepoint], p.x_advance, p.x_offset, p.y_offset) for i, p in zip(b.glyph_infos, b.glyph_positions)]

TATWEEL = shape("ـ")[0][0]

def glyph_path(name, dx, sx=1.0, anchor=0.0, sy=1.0):
    """SVG path of a glyph, shifted by dx; scaled by (sx, sy) about (anchor, baseline) (glyph units)."""
    pen = SVGPathPen(gs)
    # x' = anchor + (x - anchor) * sx + dx ; y' = -y * sy (SVG y-down)
    t = TransformPen(pen, (sx, 0, 0, -sy, dx + anchor - anchor * sx, 0))
    gs[name].draw(t)
    return pen.getCommands()

def bounds(name):
    bp = BoundsPen(gs); gs[name].draw(bp); return bp.bounds

def part(text, stretch, scale=1.0):
    """Lays out a shaped part (left→right): its tatweel stretched to `stretch` units, its
    letters scaled by `scale` about their joining side (the right edge, at the baseline)."""
    glyphs = shape(text)
    paths, x = [], 0.0
    for name, adv, xo, yo in glyphs:
        if name == TATWEEL:
            b = bounds(name)
            w = b[2] - b[0]
            sx = stretch / w
            paths.append(glyph_path(name, x - b[0] * sx + 0, sx, 0))
            x += stretch
        else:
            w = adv * scale
            # Scale about the glyph's right edge (adv), then place it at x.
            paths.append(glyph_path(name, x + xo + (w - adv), scale, adv, scale))
            x += w
    return paths, x

# Visual order on the page (left → right): "ـر", bar, "أثـ".
reh, w_reh = part("ـر", reh_len)
bar, w_bar = part("ـ", bar_len)
alef_th, w_ath = part("أثـ", th_len)

items, x = [], 0.0
for paths, w in ((reh, w_reh), (bar, w_bar), (alef_th, w_ath)):
    items.append({"x": x, "paths": paths})
    x += w + gap
total = x - gap

# Vertical extent from the glyphs actually used.
ymin, ymax = 1e9, -1e9
for name in set(n for t in ("ـر", "أثـ") for n, *_ in shape(t)):
    b = bounds(name)
    if b:
        k = reh_scale if name not in (TATWEEL,) and name in [n for n, *_ in shape("\u0640\u0631")] else 1.0
        ymin, ymax = min(ymin, b[1] * k), max(ymax, b[3] * k)
d = " ".join(f'<path transform="translate({it["x"]:.1f} 0)" d="{p}"/>' for it in items for p in it["paths"] if p)
json.dump({"upem": upem, "width": round(total, 1), "top": round(-ymax, 1), "height": round(ymax - ymin, 1), "paths": [
    {"x": round(it["x"], 1), "d": p} for it in items for p in it["paths"] if p]}, open(out, "w"))
print("upem", upem, "width", round(total), "height", round(ymax - ymin), "tatweel", TATWEEL)
