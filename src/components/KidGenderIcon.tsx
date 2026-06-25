import type { KidGender } from '../utils/kid-registration';

type KidGenderIconProps = {
  gender: KidGender;
  label: string;
};

export function KidGenderIcon({ gender, label }: KidGenderIconProps) {
  return (
    <span
      className={`kid-gender-icon ${gender}`}
      aria-label={label}
      role="img"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path className="kid-gender-shoulders" d="M10 43c1.4-8.1 7.1-13 14-13s12.6 4.9 14 13" />
        {gender === 'girl' ? (
          <>
            <path className="kid-gender-hair" d="M11 31c-2.2-7.5-1.1-17.7 3.9-23 2.4-2.6 5.5-4 9.1-4s6.7 1.4 9.1 4c5 5.3 6.1 15.5 3.9 23" />
            <path className="kid-gender-face" d="M14 19c0-8.8 4.1-14 10-14s10 5.2 10 14c0 7.2-4.5 12-10 12S14 26.2 14 19Z" />
            <path className="kid-gender-detail" d="M14.5 17.2c4.4-.3 8.1-2.2 10.8-6.1 1.7 3.4 4.5 5.4 8.2 6.1" />
          </>
        ) : gender === 'boy' ? (
          <>
            <path className="kid-gender-face" d="M13 19c0-8.7 4.4-14 11-14s11 5.3 11 14c0 7.2-4.8 12-11 12S13 26.2 13 19Z" />
            <path className="kid-gender-hair" d="M13.5 17.8c1.6-8.1 6.6-12.8 13-12.2 4.8.4 8.1 4.3 8.6 10.4-5.2.3-10.1-1.2-14.2-4.5-1.6 3.1-4.1 5.1-7.4 6.3Z" />
          </>
        ) : (
          <>
            <path className="kid-gender-face" d="M13 19c0-8.6 4.2-14 11-14s11 5.4 11 14c0 7.1-4.7 12-11 12S13 26.1 13 19Z" />
            <path className="kid-gender-hair" d="M14 16.2c1.2-7.1 5-11.2 10-11.2s8.8 4.1 10 11.2H14Z" />
            <path className="kid-gender-detail" d="M18 22h12" />
          </>
        )}
      </svg>
    </span>
  );
}
