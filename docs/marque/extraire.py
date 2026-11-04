"""Extraction alpha du logo officiel ClairDossier depuis le PNG (fond bleu nuit texturé).

Modèle : C = a·F + (1-a)·B, avec B = fond estimé localement (vignettage lissé) et
F = couleur d'un pixel intérieur voisin (7×7) dont la teinte explique le mieux C-B
(similarité cosinus) ; a = projection de C-B sur F-B. Le liseré prend la couleur F
(aucune division : pas de surexposition près des ombres portées de la source).
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
med = np.median(C[:180].reshape(-1, 3), 0)
bgmask = (np.abs(C - med).max(2) < 30)
bgmask = ndi.binary_erosion(bgmask, iterations=3)
w = ndi.gaussian_filter(bgmask.astype(np.float32), 25)
B = np.stack([ndi.gaussian_filter(C[..., c] * bgmask, 25) for c in range(3)], 2) / np.maximum(w, 1e-4)[..., None]

# 2. F = pixel intérieur voisin de même teinte que le mélange observé.
D = C - B
e = np.sqrt((D ** 2).sum(2))
fg = e >= E_MIN
cand = ndi.binary_erosion(fg, iterations=1)
Dn = D / np.maximum(e, 1e-3)[..., None]
best = np.full((H, W), -2.0, np.float32)
F = C.copy()
for dy in range(-R, R + 1):
    for dx in range(-R, R + 1):
        sc = np.roll(np.roll(C, dy, 0), dx, 1)
        sk = np.roll(np.roll(cand, dy, 0), dx, 1)
        sn = np.roll(np.roll(Dn, dy, 0), dx, 1)
        score = np.where(sk, (Dn * sn).sum(2) - 0.002 * (dy * dy + dx * dx) ** 0.5, -2.0)
        upd = score > best
        best = np.where(upd, score, best)
        F = np.where(upd[..., None], sc, F)

FB = F - B
a_raw = (D * FB).sum(2) / np.maximum((FB ** 2).sum(2), 1.0)
a_raw = np.where(best > -2.0, a_raw, 0.0)
a = np.clip((a_raw - LO) / (HI - LO), 0, 1)

# Composantes isolées (grain) : on ne garde que ce qui touche un tracé franc.
core = a >= 0.999
lab, n = ndi.label(a > 0)
keep = np.zeros(n + 1, bool)
keep[np.unique(lab[core])] = True
keep[0] = False
a = np.where(keep[lab], a, 0.0)

# 3. Couleur : liseré = couleur intérieure voisine F (décontaminée de l'ancien fond).
Fc = F.copy()
# Intérieur des tracés (hors liseré d'antialiasing) : opaque, couleur source intacte
# (les dégradés internes de l'or et des lignes ne sont pas de la transparence).
inner = ndi.binary_erosion(a_raw >= 0.5, iterations=1) & keep[lab]
a = np.where(inner, 1.0, a)
Fc = np.where(inner[..., None], C, Fc)
# Micro-fentes internes (trait d'ombrage du relief entre deux parties d'une lettre,
# ouverture ≤ 4 px, qui n'est pas du fond dans la source) : comblées. Les contre-formes
# et encoches réelles (fond visible dans la source) restent intactes.
solid = a >= 0.999
slit = ndi.binary_closing(solid, structure=np.ones((5, 5), bool)) & ~solid & (a_raw > 0.15)
a = np.where(slit, 1.0, a)
Fc = np.where(slit[..., None], C, Fc)
# Reste de biseau à très faible alpha, détaché des tracés : supprimé.
a = np.where((a < 0.12) & (ndi.distance_transform_edt(a < 0.5) > 2), 0.0, a)
Fc = np.clip(Fc, 0, 255)

# 4. Variante fond clair : chaque élément neutre prend UNE couleur — bleu nuit (éléments
# blancs) ou ardoise (lignes du document, signature) ; l'or garde ses couleurs d'origine.
hsv = np.asarray(Image.fromarray(Fc.astype(np.uint8)).convert('HSV')).astype(np.float32) / 255
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
opaque = a >= 0.999
# Cœurs francs : or saturé (teinte chaude) et neutres (blancs, gris bleutés).
gold_core = opaque & (s >= 0.55) & (np.abs(h - 0.12) < 0.08)
neutral_core = opaque & ((s < 0.12) | (np.abs(h - 0.12) >= 0.08))  # blancs, gris bleutés
# Chaque pixel prend la classe du cœur le plus proche (reflets pâles de l'or compris),
# avec une rampe d'un pixel à la jonction or/neutre.
d_gold, (iy, ix) = ndi.distance_transform_edt(~gold_core, return_indices=True)
d_neutral = ndi.distance_transform_edt(~neutral_core)
g = np.clip(0.5 + (d_neutral - d_gold) / 2, 0, 1) * (a > 0)
# Couleur de l'or : la sienne à l'intérieur, l'or saturé voisin dans la rampe (pas de teinte olive).
G = np.where((g >= 0.999)[..., None], Fc, Fc[iy, ix])
elem, n_elem = ndi.label(a > 0)
idx = np.arange(1, n_elem + 1)
neutral_v = np.nan_to_num(ndi.median(v, elem * (neutral_core & (g < 0.5)), idx))
neutral_lut = np.array([NAVY] + [NAVY if (nv == 0 or nv >= 0.93) else SLATE for nv in neutral_v], np.float32)
light = g[..., None] * G + (1 - g[..., None]) * neutral_lut[elem]

def save(rgb, name):
    rgb = np.where((a > 0)[..., None], np.clip(rgb, 0, 255), 0)  # pixels transparents : RGB nul
    rgba = np.dstack([rgb, a * 255]).round().astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/{name}.png')

save(Fc, 'master-sombre')   # blanc + or, pour fonds bleu nuit
save(light, 'master-clair')  # bleu nuit + or, pour fonds clairs
np.save(f'{OUT}/alpha.npy', a.astype(np.float32))
print('alpha>0', int((a > 0).sum()), 'alpha=1', int((a >= 0.999).sum()), 'composantes', n, 'gardees', int(keep.sum()))
