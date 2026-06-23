type KidIdentifier = {
  id: string;
};

const KID_QR_ID_PREFIX = 'kid-a:';
const KID_PASSPORT_URL = 'https://kid-a.netlify.app/passport';

export function createKidQrIdData(kidId: string) {
  return `${KID_QR_ID_PREFIX}${kidId}`;
}

export function createKidPassportUrl(kidId: string) {
  const url = new URL(KID_PASSPORT_URL);
  url.searchParams.set('id', kidId);

  return url.toString();
}

export function parseKidQrPayload(qrPayload: string) {
  const trimmedPayload = qrPayload.trim();

  if (trimmedPayload.startsWith(KID_QR_ID_PREFIX)) {
    return trimmedPayload.slice(KID_QR_ID_PREFIX.length);
  }

  try {
    const url = new URL(trimmedPayload, KID_PASSPORT_URL);
    const kidId = url.searchParams.get('id')?.trim();

    return kidId || undefined;
  } catch {
    return undefined;
  }
}

export function getKidSequenceNumber(kidId: string) {
  const numericId = kidId.replace(/\D/g, '');
  const sequenceDigits = numericId.slice(-4);

  return sequenceDigits ? Number(sequenceDigits) : undefined;
}

export function getNextKidId(existingKids: KidIdentifier[], kidIdPrefix: string) {
  const existingIds = new Set(existingKids.map((kid) => kid.id.toLowerCase()));
  let sequence = existingKids.length + 1;
  let nextId = `${kidIdPrefix}${sequence.toString().padStart(4, '0')}`;

  while (existingIds.has(nextId.toLowerCase())) {
    sequence += 1;
    nextId = `${kidIdPrefix}${sequence.toString().padStart(4, '0')}`;
  }

  return nextId;
}
