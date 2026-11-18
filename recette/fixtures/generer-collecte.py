"""Régénère les quatre originaux fictifs depuis les textes métier, avec Pillow et ReportLab."""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas

DEST = Path(__file__).resolve().parent
ROOT = DEST.parents[1]
DOCS = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    'import {FOOD_FIXTURES} from "./recette/sites/collecte.mjs"; process.stdout.write(JSON.stringify(FOOD_FIXTURES));'
], cwd=ROOT, text=True))
NOTICE = 'Simulation pédagogique — données fictives'
INK, GOLD, LIGHT = '#19253A', '#B8A275', '#F1F3F5'
WIDTH, HEIGHT = A4


def write_pdf(key, lines):
    page = Canvas(str(DEST / (key + '.pdf')), pagesize=A4, invariant=1, pageCompression=1)
    page.setTitle(lines[0])
    page.setAuthor('ClairDossier · Jeu fictif')
    page.setFillColor(HexColor(INK))
    page.setFont('Helvetica-Bold', 11)
    page.drawString(45, HEIGHT - 59, NOTICE)
    page.setStrokeColor(HexColor(GOLD))
    page.line(45, HEIGHT - 74, WIDTH - 45, HEIGHT - 74)
    page.setFont('Helvetica-Bold', 20)
    page.drawString(45, HEIGHT - 119, lines[0])
    for i, line in enumerate(lines[1:]):
        y = HEIGHT - 177 - i * 56
        if key == 'inventaire' and i in (1, 2, 3):
            page.setFillColor(HexColor(LIGHT))
            page.rect(42, y - 13, WIDTH - 84, 38, fill=1, stroke=0)
        if key == 'tournee' and i == 0:
            page.setStrokeColor(HexColor(GOLD))
            page.line(45, y - 19, WIDTH - 45, y - 19)
        page.setFillColor(HexColor(INK))
        font = 'Helvetica-Bold' if key == 'inventaire' and i == 3 else 'Helvetica'
        size = 12
        while page.stringWidth(line, font, size) > WIDTH - 98:
            size -= 0.25
        page.setFont(font, size)
        page.drawString(49, y, line)
    page.setFont('Helvetica', 9)
    page.drawString(45, 51, 'Exercice COL-19  ·  Banque Alimentaire des Bouches-du-Rhône')
    page.drawRightString(WIDTH - 45, 51, '1 / 1')
    page.showPage()
    page.save()


def write_scan(lines):
    # Numérisation synthétique monochrome. Aucun calque texte ni photographie d'une personne.
    img = Image.new('L', (1700, 690), 255)
    draw = ImageDraw.Draw(img)
    fontpath = Path('/usr/share/fonts/truetype/dejavu')
    regular = ImageFont.truetype(str(fontpath / 'DejaVuSans.ttf'), 32)
    bold = ImageFont.truetype(str(fontpath / 'DejaVuSans-Bold.ttf'), 36)
    for index, line in enumerate(lines):
        draw.text((60, 50 + index * 75), line, fill=0, font=bold if index == 0 else regular)
    draw.text((60, 565), NOTICE, fill=0, font=regular)
    img.point(lambda px: 255 if px > 145 else 0, mode='1').save(DEST / 'quai.png', optimize=True, dpi=(180, 180))


for ident, spec in DOCS.items():
    if ident == 'quai':
        write_scan(spec['lines'])
    else:
        write_pdf(ident, spec['lines'])
