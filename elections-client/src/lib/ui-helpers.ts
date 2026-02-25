export const numberFormat = new Intl.NumberFormat('he-IL');

const PARTY_COLORS_CACHE: Record<string, string> = {};

export const formatTime = (iso?: string | null): string => {
  if (!iso) return '';
  const time = new Date(iso);
  return `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')} ${new Intl.DateTimeFormat('he-IL').format(time)}`;
};

const hashPartyKey = (party: string): number => {
  let hash = 17;
  for (let i = 0; i < party.length; i += 1) {
    hash = ((hash * 31) + party.charCodeAt(i)) % 1000003;
  }
  return hash;
};

export const getStablePartyColor = (party: string): string => {
  if (PARTY_COLORS_CACHE[party]) return PARTY_COLORS_CACHE[party];
  const hash = hashPartyKey(party);
  const hue = hash % 360;
  const saturation = 60 + (Math.floor(hash / 7) % 20);
  const lightness = 42 + (Math.floor(hash / 97) % 14);
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  PARTY_COLORS_CACHE[party] = color;
  return color;
};

export const algorithmLabel = (algorithm: 'baderOffer' | 'ceilRound'): string =>
  (algorithm === 'baderOffer'
    ? 'שיטת בדר־עופר'
    : 'עיגול כלפי מעלה');

