"""Variantes recadrées (kit pleine résolution) + assets web. Usage : python3 variantes.py out kit web"""
import sys, os
import numpy as np
from PIL import Image
OUT, KIT, WEB = sys.argv[1:4]
os.makedirs(KIT, exist_ok=True); os.makedirs(WEB, exist_ok=True)
PAD = 2

def crop(im, keep):
    a = np.asarray(im).copy()
    a[..., 3] = np.where(keep, a[..., 3], 0)
    out = Image.fromarray(a, 'RGBA')
    x0, y0, x1, y1 = out.getbbox()
    return out.crop((x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD))

def resize(im, h):
    w = round(im.width * h / im.height)
    return im.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')

H, W = 887, 1774
yy, xx = np.mgrid[0:H, 0:W]
masks = {
    'complet': np.ones((H, W), bool),
    'horizontal': ~((yy >= 548) & (xx >= 640)),   # sans la signature
    'symbole': xx < 620,
}
kit = {}
for ton in ('clair', 'sombre'):
    src = Image.open(f'{OUT}/master-{ton}.png')
    for nom, m in masks.items():
        v = crop(src, m); kit[(nom, ton)] = v
        v.save(f'{KIT}/logo-{nom}-{ton}.png', optimize=True)
        print('kit', nom, ton, v.size, os.path.getsize(f'{KIT}/logo-{nom}-{ton}.png'))

def web(nom, ton, h_css, mult=(1, 2, 3)):
    """Asset de h_css px CSS de haut : logo sur h_css-2 px + 1 px CSS de marge transparente
    (l'antialiasing extérieur n'est pas tronqué par le bord du fichier)."""
    for k in mult:
        r = resize(kit[(nom, ton)], (h_css - 2) * k)
        canvas = Image.new('RGBA', (r.width + 2 * k, h_css * k), (0, 0, 0, 0))
        canvas.paste(r, (k, k))
        f = f'{WEB}/logo-{nom}-{ton}-{canvas.width}.webp'
        canvas.save(f, 'WEBP', lossless=True, quality=100, method=6, exact=False)
        print('web', os.path.basename(f), canvas.size, os.path.getsize(f))

web('horizontal', 'clair', 44)
web('symbole', 'clair', 36)
