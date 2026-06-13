type KidIdentifier = {
  id: string;
};

export function createKidQrIdData(kidId: string) {
  return `kid-a:${kidId}`;
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
