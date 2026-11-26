-- Retour arrière de 20261126100000 : volontairement SANS effet.
-- La fonction est partagée avec le moteur IA (20261023120000) et appelée par 20261118130000 / 20261125130000 :
-- la supprimer casserait ces fonctions. Elle ne donne aucun droit (exécution retirée à anon / authenticated).
select 1;
