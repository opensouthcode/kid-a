import { ArrowLeftIcon } from '@primer/octicons-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

export function BackHomeButton() {
  const { t } = useI18n();

  return (
    <Link className="icon-link-button" to="/" aria-label={t('navigation.home')}>
      <ArrowLeftIcon size={24} aria-hidden="true" />
    </Link>
  );
}
