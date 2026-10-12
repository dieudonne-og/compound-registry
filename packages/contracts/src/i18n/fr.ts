import type { Shape } from './core';
import type { sharedEn } from './en';

export const sharedFr: Shape<typeof sharedEn> = {
  validation: {
    required: 'Ce champ est obligatoire',
    email: 'Saisissez une adresse e-mail valide',
    passwordRequired: 'Saisissez votre mot de passe',
    passwordMin: 'Utilisez au moins 12 caractères',
    purchaseId: {
      required: 'Le numéro d’achat est obligatoire',
      max: 'Le numéro d’achat compte au plus 20 caractères',
      chars: 'Utilisez uniquement des lettres, des chiffres et - _ / .',
    },
    percent: {
      format: 'Saisissez un nombre avec au plus 4 décimales',
      range: 'Doit être compris entre 0 et 100',
    },
    weight: {
      format: 'Saisissez un nombre avec au plus 3 décimales',
      positive: 'Doit être supérieur à zéro',
    },
    date: {
      format: 'Utilisez le format AAAA-MM-JJ',
      real: 'Saisissez une date de calendrier valide',
      future: 'La date de production ne peut pas être dans le futur.',
    },
    tag: {
      required: 'Le numéro d’étiquette est obligatoire',
      max: 'Le numéro d’étiquette compte au plus 32 caractères',
      chars: 'Utilisez uniquement des lettres, des chiffres et - _ / .',
    },
    code: {
      format: 'Utilisez 3 à 32 lettres, chiffres ou tirets',
      reserved:
        'Ce format est réservé aux identifiants générés. Laissez l’identifiant vide pour en générer un, ou utilisez un autre format.',
    },
    reference: {
      mineralTypeId: 'Le type de minerai est obligatoire',
      businessLocationId: 'Le site d’activité est obligatoire',
      traceabilityAgentId: 'L’agent de traçabilité est obligatoire',
      companyId: 'L’entreprise est obligatoire',
      inactiveMineral: 'Sélectionnez un type de minerai actif.',
      inactiveLocation: 'Sélectionnez un site d’activité actif.',
      inactiveAgent: 'Sélectionnez un agent de traçabilité actif.',
      inactiveCompany: 'Sélectionnez une entreprise active.',
      codeRequired: 'Les types de minerai ont besoin d’un code court, par exemple SN.',
      nothingToChange: 'Indiquez au moins un champ à modifier',
    },
    representative: 'Saisissez le nom du représentant',
    reason: {
      min: 'Expliquez la modification en au moins 5 caractères',
      required: 'Un motif est obligatoire pour cette modification.',
    },
    file: { required: 'Choisissez un rapport de laboratoire à téléverser.' },
    idempotencyKey: 'Utilisez 8 à 64 lettres, chiffres ou tirets.',
  },
  errors: {
    VALIDATION_FAILED: 'Certains champs demandent votre attention.',
    REASON_REQUIRED:
      'Indiquez un motif pour modifier le numéro d’étiquette, le poids, le type de minerai ou l’identifiant.',
    EXTRACTION_FAILED: 'Le rapport n’a pas pu être lu.',
    IDEMPOTENCY_KEY_REUSED: 'Cette clé de requête a déjà été utilisée pour d’autres données.',
    UNAUTHENTICATED: 'Connectez-vous pour continuer.',
    INVALID_CREDENTIALS: 'Adresse e-mail ou mot de passe incorrect.',
    FORBIDDEN: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
    CSRF_FAILED: 'Le jeton de sécurité de votre session est absent ou expiré. Actualisez la page.',
    NOT_FOUND: '{what} introuvable.',
    VERSION_CONFLICT: 'Quelqu’un d’autre a modifié cet enregistrement pendant que vous le modifiiez.',
    TAG_NUMBER_TAKEN: 'Ce numéro d’étiquette est déjà enregistré.',
    PRODUCTION_CODE_TAKEN: 'Cet identifiant de production est déjà utilisé.',
    DUPLICATE_NAME: 'Une entrée avec ce nom ou ce code existe déjà.',
    ALREADY_CONFIRMED: 'Ces résultats ont déjà été enregistrés.',
    REQUEST_IN_PROGRESS: 'Cette requête est encore en cours de traitement. Veuillez patienter.',
    EXTRACTION_EXPIRED: 'Cette extraction a expiré. Téléversez à nouveau le rapport.',
    FILE_TOO_LARGE: 'Le fichier dépasse la taille de téléversement autorisée.',
    UNSUPPORTED_FILE_TYPE: 'Seuls les fichiers PDF, JPG, JPEG et PNG sont pris en charge.',
    RATE_LIMITED: 'Trop de requêtes. Patientez un instant puis réessayez.',
    INTERNAL_ERROR: 'Un problème est survenu de notre côté. Veuillez réessayer.',
    LAST_ADMIN: 'Au moins un administrateur actif doit rester.',
    SELF_CHANGE_NOT_ALLOWED:
      'Vous ne pouvez pas désactiver votre propre compte ni retirer votre propre rôle d’administrateur.',
    EMAIL_TAKEN: 'Un compte avec cette adresse e-mail existe déjà.',
    WRONG_PASSWORD: 'Votre mot de passe actuel est incorrect.',
    PASSWORD_CHANGE_REQUIRED: 'Définissez un nouveau mot de passe avant de continuer.',
    ACCOUNT_DISABLED: 'Ce compte est désactivé. Contactez votre administrateur.',
    routeNotFound: 'Route introuvable.',
    sessionEnded: 'Votre session a pris fin. Veuillez vous reconnecter.',
    fileMismatch:
      'Ce fichier est de type {kind} mais son nom se termine par « .{ext} ». Téléversez le fichier d’origine.',
    extraction: {
      encrypted: 'Ce PDF est protégé par un mot de passe. Téléversez une copie non protégée du rapport.',
      unreadable:
        'Le fichier n’a pas pu être ouvert. Il est peut-être endommagé — exportez-le ou numérisez-le à nouveau.',
      too_many_pages: 'Un rapport compte au plus 10 pages. Téléversez uniquement les pages d’analyse.',
      no_text:
        'Aucun texte lisible n’a été trouvé. Téléversez un scan plus net (300 DPI ou plus) ou une photo prise de face, bien éclairée.',
      no_compounds:
        'Aucune valeur de composé n’a été reconnue. Vérifiez qu’il s’agit d’un rapport d’analyse de laboratoire, ou téléversez un scan plus net.',
      ocr_failed:
        'La reconnaissance du texte a échoué pour ce fichier. Essayez d’exporter le rapport en PDF ou en PNG.',
      too_slow:
        'La lecture de ce rapport a pris trop de temps. Téléversez uniquement les pages contenant les résultats d’analyse.',
    },
    things: {
      record: 'Enregistrement de production',
      extraction: 'Extraction',
      compound: 'Enregistrement de composé',
      file: 'Fichier du rapport',
      entry: 'Entrée',
      user: 'Utilisateur',
    },
  },
};
