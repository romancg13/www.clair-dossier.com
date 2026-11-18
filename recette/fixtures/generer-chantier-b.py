"""Reproduire le devis PDF et le scan PNG fictifs du chantier du Canal."""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas

dest = Path(__file__).resolve().parent
root = dest.parents[1]
records = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import {fixtures} from './recette/sites/chantier-b.mjs'; process.stdout.write(JSON.stringify(fixtures));"
], cwd=root, text=True))
pdf = Canvas(str(dest / "devis-b.pdf"), pagesize=A4, invariant=1, pageCompression=1)
pdf.setTitle("Devis CAN-072 — Atelier du Canal — spécimen fictif")
pdf.setAuthor("ClairDossier · recette")
pdf.setFillColor(HexColor("#0D1B3D"))
pdf.setFont("Helvetica-Bold", 16)
pdf.drawString(45, 764, records["devis-b"]["lines"][0])
pdf.setStrokeColor(HexColor("#B69A61"))
pdf.line(45, 740, 550, 740)
for index, line in enumerate(records["devis-b"]["lines"][1:]):
    pdf.setFont("Helvetica", 11)
    pdf.drawString(45, 694-index*40, line)
pdf.setFont("Helvetica", 9)
pdf.drawString(45, 54, "Spécimen fictif ClairDossier. Atelier, chantier et montant inventés pour la recette. Page 1/1.")
pdf.showPage()
pdf.save()

image = Image.new("L", (1080, 625), color=255)
draw = ImageDraw.Draw(image)
fonts = "/usr/share/fonts/truetype/dejavu/"
bold = ImageFont.truetype(fonts+"DejaVuSans-Bold.ttf", 31)
font = ImageFont.truetype(fonts+"DejaVuSans.ttf", 29)
foot = ImageFont.truetype(fonts+"DejaVuSans.ttf", 19)
draw.text((55,50), records["reception-b"]["lines"][0], fill=0, font=bold)
draw.line((55,110,1010,110),fill=0,width=2)
for index, line in enumerate(records["reception-b"]["lines"][1:]):
    draw.text((55,150+index*66),line,fill=0,font=font)
draw.text((55,544),"Document fictif ClairDossier - specimen de recette - page 1/1",fill=0,font=foot)
image.save(dest/"reception-b.png", optimize=True)
