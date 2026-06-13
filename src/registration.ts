import { isSupportedLocale, type Locale } from './i18n/messages';

export const kidGenderOptions = [
  'boy',
  'girl',
  'preferNotToSay',
] as const;

export type KidGender = (typeof kidGenderOptions)[number];

export type RegistrationInput = {
  nickname: string;
  age: number;
  gender: KidGender;
  languagePreference: Locale;
};

export type RegistrationPayload = RegistrationInput & {
  type: 'kid-a.registration';
  v: 1;
};

export const minimumKidAge = 3;
export const maximumKidAge = 17;

export function isKidGender(value: string): value is KidGender {
  return kidGenderOptions.some((gender) => gender === value);
}

export function isValidKidAge(age: number) {
  return (
    Number.isInteger(age) && age >= minimumKidAge && age <= maximumKidAge
  );
}

export function createRegistrationPayload({
  age,
  gender,
  languagePreference,
  nickname,
}: RegistrationInput): RegistrationPayload {
  return {
    age,
    gender,
    languagePreference,
    nickname: nickname.trim(),
    type: 'kid-a.registration',
    v: 1,
  };
}

function isRegistrationPayload(value: unknown): value is RegistrationPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    payload.type === 'kid-a.registration' &&
    payload.v === 1 &&
    typeof payload.nickname === 'string' &&
    payload.nickname.trim().length > 0 &&
    typeof payload.age === 'number' &&
    isValidKidAge(payload.age) &&
    typeof payload.gender === 'string' &&
    isKidGender(payload.gender) &&
    typeof payload.languagePreference === 'string' &&
    isSupportedLocale(payload.languagePreference)
  );
}

export function parseRegistrationPayload(rawPayload: string) {
  const parsedPayload: unknown = JSON.parse(rawPayload);

  if (!isRegistrationPayload(parsedPayload)) {
    return undefined;
  }

  return createRegistrationPayload(parsedPayload);
}
