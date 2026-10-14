import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from './i18n';

function Probe() {
  const { t, setLanguage, language } = useI18n();
  return (
    <>
      <p>{t('nav.dashboard')}</p>
      <p>{t('errors.TAG_NUMBER_TAKEN')}</p>
      <p>{t('compounds.review.pending', { count: 1 })}</p>
      <button onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}>switch</button>
    </>
  );
}

describe('I18nProvider', () => {
  it('translates interface and shared keys and switches language without reload', () => {
    render(
      <I18nProvider initial="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('1 value still needs review')).toBeInTheDocument();
    act(() => screen.getByText('switch').click());
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    expect(screen.getByText('Ce numéro d’étiquette est déjà enregistré.')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
  });
});
