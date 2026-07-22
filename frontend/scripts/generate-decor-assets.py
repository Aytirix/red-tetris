#!/usr/bin/env python3
"""Genere les eclairs decoratifs de la page d'accueil en PNG transparents.

Le sujet interdit SVG cote client: ces traces vectoriels sont donc rasterises ici,
hors ligne, et le client se contente d'afficher les PNG (etires par le CSS, comme le
faisait preserveAspectRatio="none"). Les PNG sont commites: ce script n'est a relancer
que si le trace ou les couleurs changent.

Dependance: Pillow (pip install Pillow).
Usage: python3 scripts/generate-decor-assets.py
"""
import os
from PIL import Image, ImageDraw

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "..", "public", "img", "decor")

# Trace partage par les deux eclairs (coordonnees du viewBox 0 0 100 100).
BOLT = [(58, 0), (68, 12), (49, 27), (61, 42), (43, 56), (55, 72), (39, 86), (47, 100)]

SUPERSAMPLE = 4


def draw_stroke(size_px, scale_x, scale_y, offset_y, width, rgba):
    """Rasterise la polyline comme un stroke SVG: joints et extremites arrondis.

    Le trace est dessine opaque sur son propre calque, puis son alpha est module par
    la couleur demandee. Cela evite que les segments qui se chevauchent additionnent
    leur transparence, exactement comme un <path stroke> unique en SVG.
    """
    w_px, h_px = size_px
    layer = Image.new("RGBA", (w_px * SUPERSAMPLE, h_px * SUPERSAMPLE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    points = [
        ((x * scale_x) * SUPERSAMPLE, ((y + offset_y) * scale_y) * SUPERSAMPLE)
        for x, y in BOLT
    ]
    # preserveAspectRatio="none" deforme le stroke: son epaisseur suit chaque axe.
    radius_x = (width / 2) * scale_x * SUPERSAMPLE
    radius_y = (width / 2) * scale_y * SUPERSAMPLE
    solid = (rgba[0], rgba[1], rgba[2], 255)

    draw.line(points, fill=solid, width=int(round(max(radius_x, radius_y) * 2)), joint="curve")

    # stroke-linecap="round" / "linejoin=round": PIL n'arrondit pas les bouts, on pose
    # une ellipse a chaque sommet (et donc aux deux extremites).
    for px, py in points:
        draw.ellipse([px - radius_x, py - radius_y, px + radius_x, py + radius_y], fill=solid)

    alpha = layer.getchannel("A").point(lambda value: int(round(value * rgba[3])))
    layer.putalpha(alpha)
    return layer.resize(size_px, Image.LANCZOS)


def compose(size_px, scale_x, scale_y, offset_y, layers):
    canvas = Image.new("RGBA", size_px, (0, 0, 0, 0))
    for width, rgba in layers:
        canvas = Image.alpha_composite(canvas, draw_stroke(size_px, scale_x, scale_y, offset_y, width, rgba))
    return canvas


def save(image, name):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, name)
    image.save(path, optimize=True)
    print(f"wrote {os.path.relpath(path, os.path.join(SCRIPT_DIR, '..'))} ({image.size[0]}x{image.size[1]})")


# --- Eclair du hero (choix de faction) ---------------------------------------
# Le SVG avait overflow:visible, les extremites arrondies debordaient donc de 9 unites
# en haut et en bas. Le PNG couvre -9..109 et le CSS le repositionne (top:-9%, height:118%).
HERO_MARGIN = 9
HERO_SCALE = 8
hero_size = (100 * HERO_SCALE, (100 + 2 * HERO_MARGIN) * HERO_SCALE)
hero = compose(
    hero_size,
    HERO_SCALE,
    HERO_SCALE,
    HERO_MARGIN,
    [
        (18, (167, 223, 255, 0.34)),
        (9, (255, 243, 205, 0.78)),
        (3.2, (255, 252, 242, 0.98)),
    ],
)
save(hero, "bolt-hero.png")

# --- Eclair de la carte personnage -------------------------------------------
# Ici la couleur large depend de la faction: on exporte des masques alpha que le CSS
# colore via background-color + mask-image. Pas d'overflow visible: on clippe a 100x100.
CARD_SCALE = 6
card_size = (100 * CARD_SCALE, 100 * CARD_SCALE)
save(draw_stroke(card_size, CARD_SCALE, CARD_SCALE, 0, 10, (255, 255, 255, 1.0)), "bolt-card-wide.png")
save(draw_stroke(card_size, CARD_SCALE, CARD_SCALE, 0, 3, (255, 255, 255, 1.0)), "bolt-card-thin.png")
