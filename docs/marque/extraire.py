"""Extraction alpha du logo officiel ClairDossier depuis le PNG (fond bleu nuit texturé).

Modèle : C = a·F + (1-a)·B, avec B = fond estimé localement (vignettage lissé),
F = couleur de premier plan la plus proche (pixel le plus éloigné du fond dans un
voisinage 7×7). a = projection de C-B sur F-B. Couleur décontaminée de l'ancien fond.
Usage : python3 extraire.py source.png sortie_dir
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1], sys.argv[2]
NAVY = np.array([0x0D, 0x1B, 0x3D], np.float32)   # --color-navy-900 (palette historique)
SLATE = np.array([0x5A, 0x63, 0x78], np.float32)  # --color-slate-500
R = 3            # rayon du voisinage de recherche de F
E_MIN = 90.0     # distance au fond minimale d'un vrai pixel de premier plan
LO, HI = 0.06, 0.93  # seuil bruit du grain / saturation de l'intérieur des tracés

C = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
H, W, _ = C.shape

# 1. Fond lissé : moyenne normalisée des seuls pixels de fond (hors tracés et ombres).
lum = C.mean(2)
med = np.median(C[:180].reshape(-1, 3), 0)
bgmask = (np.abs(C - med).max(2) < 30)
bgmask = ndi.binary_erosion(bgmask, iterations=3)
w = ndi.gaussian_filter(bgmask.astype(np.float32), 25)
B = np.stack([ndi.gaussian_filter(C[..., c] * bgmask, 25) for c in range(3)], 2) / np.maximum(w, 1e-4)[..., None]

# 2. F = couleur du pixel le plus éloigné du fond dans le voisinage.
D = C - B
e = np.sqrt((D ** 2).sum(2))
best_e = e.copy()
F = C.copy()
for dy in range(-R, R + 1):
    for dx in range(-R, R + 1):
        se = np.roll(np.roll(e, dy, 0), dx, 1)
        sc = np.roll(np.roll(C, dy, 0), dx, 1)
        upd = se > best_e
        best_e = np.where(upd, se, best_e)
        F = np.where(upd[..., None], sc, F)

FB = F - B
a_raw = (D * FB).sum(2) / np.maximum((FB ** 2).sum(2), 1.0)
a_raw = np.where(best_e >= E_MIN, a_raw, 0.0)
a = np.clip((a_raw - LO) / (HI - LO), 0, 1)

# Composantes isolées (grain) : on ne garde que ce qui touche un tracé franc.
core = a >= 0.999
lab, n = ndi.label(a > 0)
keep = np.zeros(n + 1, bool)
keep[np.unique(lab[core])] = True
keep[0] = False
a = np.where(keep[lab], a, 0.0)

# 3. Couleur décontaminée.
Fc = np.where((a_raw >= 0.5)[..., None], B + D / np.clip(a_raw, 0.5, 1)[..., None], F)
# Intérieur des tracés (hors liseré d'antialiasing) : opaque, couleur source intacte
# (les dégradés internes de l'or et des lignes ne sont pas de la transparence).
inner = ndi.binary_erosion(a_raw >= 0.5, iterations=1) & keep[lab]
a = np.where(inner, 1.0, a)
Fc = np.where(inner[..., None], C, Fc)
Fc = np.clip(Fc, 0, 255)

# 4. Variante fond clair : neutres -> bleu nuit (blanc) … ardoise (gris), or conservé.
hsv = np.asarray(Image.fromarray(Fc.astype(np.uint8)).convert('HSV')).astype(np.float32) / 255
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
# poids « or » : teinte chaude (reflets pâles compris) ; les gris du logo sont froids (bleutés)
warm = np.clip(1 - np.abs(h - 0.11) / 0.08, 0, 1)
g = np.clip(warm * 2, 0, 1) * np.clip((s - 0.10) / 0.12, 0, 1)
t = np.clip((0.995 - v) / (0.995 - 0.72), 0, 1)          # 0 = blanc, 1 = gris (lignes, signature)
neutral = NAVY[None, None] * (1 - t[..., None]) + SLATE[None, None] * t[..., None]
light = g[..., None] * Fc + (1 - g[..., None]) * neutral

def save(rgb, name):
    rgba = np.dstack([np.clip(rgb, 0, 255), a * 255]).round().astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/{name}.png')

save(Fc, 'master-sombre')   # blanc + or, pour fonds bleu nuit
save(light, 'master-clair')  # bleu nuit + or, pour fonds clairs
np.save(f'{OUT}/alpha.npy', a.astype(np.float32))
print('alpha>0', int((a > 0).sum()), 'alpha=1', int((a >= 0.999).sum()), 'composantes', n, 'gardees', int(keep.sum()))
