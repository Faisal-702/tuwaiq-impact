"""Builds the English "Atha-r" wordmark (src/components/brand/athar-wordmark.tsx)
as SVG paths from Cairo's own Latin glyph outlines, the companion of the Arabic
أثـ — ـر wordmark (scripts/build-athar-wordmark.py). At the same weight and
scale, Cairo's Latin ascenders (710 units) and stems (113) match the Arabic
alef, and its hyphen is as thick as the Arabic bar (99), so both wordmarks
share one baseline and one view-box height. Not part of the build; run it
only to redraw the wordmark.

Requirements (any Python 3 environment): pip install fonttools brotli uharfbuzz

Usage:
  python scripts/build-athar-wordmark-en.py <cairo-latin.woff2> <out.json> [weight] [tracking]
Tracking is extra space between letters, in font units (1000 per em). The current wordmark:
  python scripts/build-athar-wordmark-en.py \
      src/app/fonts/cairo/cairo-latin-wght-normal.woff2 wordmark-en.json 650 12
The output lists the paths and the view box width; copy them into the component.
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
tracking = float(sys.argv[4]) if len(sys.argv) > 4 else 0
TEXT = "Atha-r"

font = TTFont(src)
font.flavor = None
inst = instancer.instantiateVariableFont(font, {"wght": wght})
buf = io.BytesIO(); inst.save(buf); data = buf.getvalue()
ttf = TTFont(io.BytesIO(data))
gs = ttf.getGlyphSet()
order = ttf.getGlyphOrder()

hbfont = hb.Font(hb.Face(data))
b = hb.Buffer(); b.add_str(TEXT); b.guess_segment_properties()
hb.shape(hbfont, b, {"kern": True, "liga": False})
glyphs = [(order[i.codepoint], p.x_advance, p.x_offset) for i, p in zip(b.glyph_infos, b.glyph_positions)]

def bounds(name):
    bp = BoundsPen(gs); gs[name].draw(bp); return bp.bounds

# Trim the first letter's left side bearing so the wordmark starts at x = 0,
# like the Arabic one; the last letter's right side bearing is trimmed too.
x = -bounds(glyphs[0][0])[0]
paths = []
for k, (name, adv, xo) in enumerate(glyphs):
    pen = SVGPathPen(gs)
    gs[name].draw(TransformPen(pen, (1, 0, 0, -1, x + xo, 0)))
    paths.append({"name": name, "d": pen.getCommands()})
    if k < len(glyphs) - 1:
        x += adv + tracking
    else:
        x += bounds(name)[2]
json.dump({"weight": wght, "tracking": tracking, "width": round(x, 1), "paths": paths}, open(out, "w"))
print("width", round(x, 1), [p["name"] for p in paths])
