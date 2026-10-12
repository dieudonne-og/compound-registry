import type { Shape } from '@cr/contracts';
import type { webEn } from './en';

export const webFr: Shape<typeof webEn> = {
  common: {
    cancel: 'Annuler',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    close: 'Fermer',
    back: 'Retour',
    retry: 'Réessayer',
    loading: 'Chargement…',
    edit: 'Modifier',
    unknownError: 'Un problème est survenu. Veuillez réessayer.',
    networkError: 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
  },
  roles: { admin: 'Administrateur', supervisor: 'Superviseur', operator: 'Opérateur', auditor: 'Auditeur' },
  nav: {
    main: 'Principal',
    sections: { overview: 'Vue d’ensemble', laboratory: 'Laboratoire', production: 'Production' },
    dashboard: 'Tableau de bord',
    compounds: 'Analyses de composés',
    upload: 'Téléverser un rapport',
    production: 'Enregistrements de production',
    register: 'Enregistrer une production',
  },
  layout: {
    openNavigation: 'Ouvrir la navigation',
    search: 'Rechercher',
    searchPlaceholder: 'Rechercher…',
    theme: { change: 'Changer de thème', light: 'Clair', dark: 'Sombre', system: 'Système' },
    language: 'Langue',
    account: 'Menu du compte',
    signOut: 'Se déconnecter',
    expandSidebar: 'Déplier la barre latérale',
    collapseSidebar: 'Replier la barre latérale',
    collapse: 'Replier',
    command: {
      title: 'Rechercher',
      description: 'Aller à une page ou trouver un enregistrement de production',
      placeholder: 'Rechercher des pages, des identifiants de production ou des numéros d’étiquette…',
      searching: 'Recherche…',
      empty: 'Aucun résultat.',
    },
  },
  auth: {
    tagline: 'Analyses de laboratoire et traçabilité de la production, en un seul endroit.',
    features: {
      read: 'Lire les rapports de laboratoire à partir de PDF, de scans et de photos',
      review: 'Vérifier chaque valeur avant son enregistrement',
      history: 'Historique inviolable des enregistrements de production',
    },
    restricted: 'Accès réservé au personnel autorisé.',
    signIn: 'Se connecter',
    intro: 'Utilisez votre adresse e-mail professionnelle et votre mot de passe.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    tooManyAttempts: 'Trop de tentatives. Patientez une minute, puis réessayez.',
    demo: {
      title: 'Comptes de démonstration',
      password: 'Tous les comptes utilisent le mot de passe {password}.',
    },
  },
  compounds: {
    review: {
      pending: { one: '{count} valeur reste à vérifier', other: '{count} valeurs restent à vérifier' },
    },
  },
};
