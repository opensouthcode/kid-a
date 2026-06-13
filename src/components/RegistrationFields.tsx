import { useI18n } from '../i18n/I18nProvider';
import { supportedLocales, type Locale } from '../i18n/messages';
import {
  ageGaugeMaximum,
  ageGaugeMiddle,
  ageGaugeMinimum,
  kidGenderOptions,
  type KidGender,
} from '../registration';

type RegistrationFieldsProps = {
  age: string;
  gender: KidGender;
  languagePreference: Locale;
  nickname: string;
  setAge: (age: string) => void;
  setGender: (gender: KidGender) => void;
  setLanguagePreference: (languagePreference: Locale) => void;
  setNickname: (nickname: string) => void;
};

const fallbackAgeGaugeValue = Math.round((ageGaugeMinimum + ageGaugeMaximum) / 2);

function getAgeGaugeValue(age: string) {
  const ageNumber = Number(age);

  if (!Number.isInteger(ageNumber)) {
    return fallbackAgeGaugeValue;
  }

  return Math.min(Math.max(ageNumber, ageGaugeMinimum), ageGaugeMaximum);
}

export function RegistrationFields({
  age,
  gender,
  languagePreference,
  nickname,
  setAge,
  setGender,
  setLanguagePreference,
  setNickname,
}: RegistrationFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="registration-fields">
      <label>
        <span>{t('registration.nickname')}</span>
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          autoComplete="nickname"
          required
        />
      </label>
      <label>
        <span>{t('registration.age')}</span>
        <div className="age-control">
          <input
            type="number"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            required
          />
          <input
            type="range"
            min={ageGaugeMinimum}
            max={ageGaugeMaximum}
            value={getAgeGaugeValue(age)}
            aria-label={t('registration.ageGauge')}
            onChange={(event) => setAge(event.target.value)}
          />
          <div className="age-gauge-labels" aria-hidden="true">
            <span>{ageGaugeMinimum}</span>
            <span>{ageGaugeMiddle}</span>
            <span>{ageGaugeMaximum}</span>
          </div>
        </div>
      </label>
      <label>
        <span>{t('registration.gender')}</span>
        <div className="segmented-toggle" role="group">
          {kidGenderOptions.map((option) => (
            <button
              className={gender === option ? 'active' : undefined}
              key={option}
              type="button"
              aria-pressed={gender === option}
              onClick={() => setGender(option)}
            >
              {t(`registration.gender.${option}`)}
            </button>
          ))}
        </div>
      </label>
      <label>
        <span>{t('registration.languagePreference')}</span>
        <div className="segmented-toggle language-toggle" role="group">
          {supportedLocales.map((availableLocale) => (
            <button
              className={
                languagePreference === availableLocale ? 'active' : undefined
              }
              key={availableLocale}
              type="button"
              aria-pressed={languagePreference === availableLocale}
              onClick={() => setLanguagePreference(availableLocale)}
            >
              {t(`language.${availableLocale}`)}
            </button>
          ))}
        </div>
      </label>
    </div>
  );
}
