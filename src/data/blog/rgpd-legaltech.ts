import { SRC } from './sources';
import type { BlogPostInput } from './types';

export const rgpdLegaltech: BlogPostInput = {
  slug: 'rgpd-legaltech',
  title: 'Protéger ses dossiers : ce que le RGPD exige des prestataires qui y accèdent',
  metaTitle: 'RGPD et prestataires : protéger ses dossiers',
  metaDescription:
    "Hébergeur, éditeur, infogérant : le prestataire qui traite vos dossiers est en principe un sous-traitant. Ce qu'exige le RGPD (art. 28 et 32).",
  summary:
    "Dès qu'un prestataire accède à vos dossiers pour votre compte, il devient en principe votre sous-traitant au sens du RGPD, et vous restez responsable. Ce qu'impose l'article 28, comment penser la sécurité, et les réflexes à adopter.",
  author: 'redaction',
  date: '2026-04-28',
  updated: '2026-09-18',
  revisionNote:
    "Article réécrit à partir des textes et fiches de la CNIL : affirmations techniques non vérifiées retirées, obligations de l'article 28 détaillées, section ClairDossier alignée sur la page Sécurité.",
  reviewBy: '2027-03-18',
  category: 'Conformité',
  tags: ['RGPD', 'sous-traitant', 'sécurité', 'article 28'],
  illustration: 'shield',
  content: [
    {
      type: 'p',
      text:
        "Un dossier client, un dossier salarié ou un litige contiennent presque toujours des données personnelles. Dès que vous les confiez à un prestataire (hébergeur, éditeur de logiciel, infogérant, service d'envoi d'e-mails), celui-ci devient en principe votre sous-traitant au sens du RGPD. Vous restez responsable de ce qu'il fait des données : autant bien le choisir et bien l'encadrer.",
    },
    { type: 'h2', text: 'Qui est responsable, qui est sous-traitant ?' },
    {
      type: 'p',
      text:
        "La CNIL résume la distinction ainsi : le responsable du traitement décide pourquoi et comment les données sont utilisées ; le sous-traitant les traite pour son compte, sur ses instructions. Un éditeur qui héberge vos dossiers dans son logiciel est typiquement un sous-traitant. S'il fait lui-même appel à un autre prestataire, celui-ci est un sous-traitant ultérieur.",
    },
    { type: 'h2', text: "Ce qu'impose l'article 28" },
    {
      type: 'p',
      text:
        "Vous ne pouvez recourir qu'à un sous-traitant offrant des garanties suffisantes. La relation doit être encadrée par un contrat, ou un autre acte juridique, qui prévoit notamment :",
    },
    {
      type: 'list',
      items: [
        'un traitement uniquement sur instruction documentée de votre part ;',
        'la confidentialité des personnes autorisées à accéder aux données ;',
        'les mesures de sécurité exigées par l’article 32 ;',
        'votre autorisation écrite préalable avant tout recours à un autre sous-traitant, avec information en cas de changement si l’autorisation est générale ;',
        'l’aide apportée pour répondre aux droits des personnes et pour la sécurité ;',
        'la suppression ou le renvoi des données à la fin de la prestation ;',
        'la mise à disposition des informations utiles et la possibilité d’audits.',
      ],
    },
    {
      type: 'p',
      text:
        "La CNIL présente des clauses contractuelles types qui reprennent ces mentions ; elles ne sont pas obligatoires si le contrat contient déjà tous les éléments requis.",
    },
    { type: 'h2', text: 'Une sécurité adaptée au risque' },
    {
      type: 'p',
      text:
        "L'article 32 ne dresse pas une liste unique de techniques : il exige un niveau de sécurité adapté au risque, en citant par exemple le chiffrement, la confidentialité, l'intégrité, la disponibilité et des tests réguliers. Pour passer à la pratique, le guide de la sécurité des données personnelles de la CNIL (édition 2024) sert de référence : authentification, habilitations, traçabilité, sauvegardes, sous-traitance.",
    },
    { type: 'h2', text: 'Les bons réflexes' },
    {
      type: 'list',
      items: [
        'Avant de signer, demander le contrat de sous-traitance et la liste des sous-traitants ultérieurs.',
        'Savoir où les données sont hébergées et, si elles quittent l’Union européenne, comment le transfert est encadré.',
        'Limiter les accès : un compte nominatif par personne, des droits réduits au nécessaire, retirés au départ.',
        'Prévoir la fin du contrat : restitution des données, puis suppression.',
      ],
    },
    { type: 'h2', text: 'Un exemple concret' },
    {
      type: 'p',
      text:
        "Exemple fictif. Un cabinet d'expertise comptable confie à un prestataire informatique la maintenance du serveur où sont stockés les dossiers de ses clients. Le prestataire accède aux données pour le compte du cabinet : c'est un sous-traitant. Le cabinet lui fait signer un contrat reprenant les mentions de l'article 28, lui ouvre un compte nominatif limité à la maintenance, et prévoit qu'à la fin du contrat toute copie détenue par le prestataire sera supprimée.",
    },
    { type: 'h2', text: 'Et chez ClairDossier ?' },
    {
      type: 'p',
      text:
        "Ce que nous affirmons est détaillé et daté sur notre page Sécurité : pièces stockées dans un espace privé et accessibles par liens temporaires, isolation des comptes appliquée en base, échanges en HTTPS et chiffrement au repos côté hébergeur. Notre registre des sous-traitants y est publié, et les points encore à confirmer, comme la région d'hébergement de la base de données, y sont signalés comme tels. La plateforme ne lit pas vos documents.",
    },
  ],
  takeaways: [
    'Le prestataire qui traite vos dossiers pour votre compte est, en principe, un sous-traitant : vous restez responsable.',
    'Un contrat conforme à l’article 28 du RGPD encadre la relation avant tout accès aux données.',
    'La sécurité doit être adaptée au risque : le guide CNIL 2024 est la référence pratique.',
    'Contrôlez toute la chaîne : sous-traitants ultérieurs, localisation, fin de contrat.',
  ],
  faq: [
    {
      q: 'Le RGPD s’applique-t-il aux dossiers archivés ?',
      a: "Oui. Un dossier archivé qui contient des données personnelles reste un traitement : la sécurité, la durée de conservation limitée et les droits des personnes continuent de s'appliquer jusqu'à la suppression effective.",
    },
    {
      q: 'Que faire si mon prestataire ne propose pas de contrat de sous-traitance ?',
      a: "Demandez-le par écrit. Sans contrat comportant les mentions de l'article 28, la relation n'est pas encadrée comme l'exige le RGPD. Faites-vous accompagner (délégué à la protection des données, conseil) pour régulariser la situation ou changer de prestataire.",
    },
  ],
  sources: [
    SRC.cnilRgpdChap4,
    SRC.cnilRoles,
    SRC.cnilSousTraitant,
    SRC.cnilSecuriteSousTraitance,
    SRC.cnilClausesTypes,
    SRC.cnilGuideSecurite2024,
  ],
  relatedSlugs: ['conservation-documents', 'organiser-un-dossier', 'ia-droit'],
};
