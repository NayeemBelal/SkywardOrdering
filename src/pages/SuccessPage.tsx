import { useTranslation } from 'react-i18next';

export default function SuccessPage() {
  const { t } = useTranslation();
  return <div className="text-center text-2xl">✅ {t('sent')}</div>;
}
