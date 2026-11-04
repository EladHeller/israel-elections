import { normalizeQuestion, parseElectionQuestion, resolveParties, type QuestionContext } from './election-questions';
import type { LocalityVotes } from './party-research';

export interface QuestionPlaces { localities: LocalityVotes[]; stations: LocalityVotes[] }
export interface EntityOption { id: string; name: string; text: string }
export interface QuestionEntity { start: number; end: number; kind: 'party' | 'locality' | 'station'; id: string; label: string; options: EntityOption[] }
export const emptyQuestionPlaces: QuestionPlaces = { localities: [], stations: [] };

// Offsets refer to the original UTF-16 string, including quotes, niqqud and clitics.
function mappedText(input: string) {
  let text = ''; const starts: number[] = []; const ends: number[] = [];
  for (let offset = 0; offset < input.length;) {
    const char = String.fromCodePoint(input.codePointAt(offset)!);
    for (const unit of char.normalize('NFKC')) {
      if (/[\u0591-\u05bd\u05bf-\u05c2\u05c4-\u05c5\u05c7"'״׳?？!,:;]/.test(unit)) continue;
      const next = /[\s־–—-]/.test(unit) ? ' ' : unit;
      if (next === ' ' && (!text || text.endsWith(' '))) continue;
      text += next; for (let index = 0; index < next.length; index++) { starts.push(offset); ends.push(offset + char.length); }
    }
    offset += char.length;
  }
  return { text, starts, ends };
}
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const stationText = (place: LocalityVotes) => `${place.pollingStation}${place.split === undefined ? '' : ` פיצול ${place.split}`}`;
export const localityOptions = (places: QuestionPlaces): EntityOption[] => places.localities.map(place => ({ id: place.id, name: place.name, text: place.name }));

export function questionEntities(input: string, context: QuestionContext, places: QuestionPlaces = emptyQuestionPlaces): QuestionEntity[] {
  const mapped = mappedText(input);
  const entities: QuestionEntity[] = [];
  const add = (start: number, end: number, kind: QuestionEntity['kind'], option: EntityOption, options: EntityOption[]) => {
    if (!entities.some(entity => start < entity.end && end > entity.start)) entities.push({ start, end, kind, id: option.id, label: option.name, options });
  };
  const localities = localityOptions(places);
  // Locations only occur after an explicit geographic clause, never in national rankings.
  const parsed = parseElectionQuestion(input, context);
  const geographic = !('error' in parsed) && parsed.query.kind === 'insight' && ['winner', 'local-results'].includes(parsed.query.metric);
  if (geographic) {
    const query = parsed.query as import('./question-insights').InsightQuery;
    const requested = normalizeQuestion(query.place!);
    const locality = localities.find(option => normalizeQuestion(option.text) === requested || (requested === 'תל אביב' && normalizeQuestion(option.text) === 'תל אביב יפו'));
    if (locality) {
      const start = mapped.text.lastIndexOf(requested);
      if (start >= 0) add(mapped.starts[start], mapped.ends[start + requested.length - 1], 'locality', locality, localities);
      const stations = places.stations.filter(place => place.name === locality.name && place.pollingStation !== undefined)
        .map(place => ({ id: place.id, name: `קלפי ${stationText(place)}`, text: stationText(place) }));
      const station = stations.find(option => option.text === `${query.station}${query.split === undefined ? '' : ` פיצול ${query.split}`}`);
      if (station) {
        const expression = / בקלפי (\d+(?:\.\d+)?(?: פיצול \d+)?)/.exec(mapped.text);
        if (expression) {
          const at = expression.index + ' בקלפי '.length;
          add(mapped.starts[at], mapped.ends[at + expression[1].length - 1], 'station', station, stations);
        }
      }
    }
  }
  const parties: EntityOption[] = Object.keys(context.votes).map(id => {
    const name = context.names[id] ?? id;
    const resolved = resolveParties(normalizeQuestion(name), context);
    return { id, name, text: !resolved.ambiguous && resolved.text === '@0' && resolved.parties[0] === id ? name : id };
  });
  const reserved = new Set(['מה', 'אם', 'לא', 'כל', 'את', 'של', 'בין', 'בלי', 'ללא', 'היה', 'היו', 'קולות', 'אחוז', 'החסימה']);
  const candidates = parties.flatMap(option => [option.text, option.id, ...(option.name.startsWith('ה') ? [option.name.slice(1)] : [])]
    .map(normalizeQuestion).filter(name => name && !reserved.has(name)).map(name => ({ name, option })))
    .sort((a, b) => b.name.length - a.name.length);
  for (const { name, option } of candidates) {
    const pattern = new RegExp(`(^| )([בלו]?)(${escape(name)})(?=$| )`, 'g');
    for (const match of mapped.text.matchAll(pattern)) {
      const start = match.index! + match[1].length + match[2].length;
      const resolved = resolveParties(name, context);
      if (!resolved.ambiguous && resolved.parties[0] === option.id) add(mapped.starts[start], mapped.ends[start + name.length - 1], 'party', option, parties);
    }
  }
  const chosen = new Set(entities.filter(entity => entity.kind === 'party').map(entity => entity.id));
  return entities.sort((a, b) => a.start - b.start).map(entity => entity.kind !== 'party' ? entity : {
    ...entity, options: entity.options.filter(option => option.id === entity.id || !chosen.has(option.id))
  });
}

export function replaceQuestionEntity(input: string, entity: QuestionEntity, next: string, context: QuestionContext): string {
  const option = entity.options.find(option => option.id === next);
  if (!option) return input;
  let suffix = input.slice(entity.end);
  if (entity.kind === 'locality' && next !== entity.id) suffix = suffix.replace(/^\s+בקלפי\s+\d+(?:\.\d+)?(?:\s+פיצול\s+\d+)?/, '');
  if (entity.kind === 'party' && /^ (?:לעבור את אחוז החסימה|למנדט נוסף)[?？]?$/.test(suffix)) {
    const total = Object.values(context.votes).reduce((sum, entry) => sum + entry.votes, 0);
    suffix = context.votes[next].votes < total * context.config.blockPercentage ? ' לעבור את אחוז החסימה' : ' למנדט נוסף';
  }
  return input.slice(0, entity.start) + option.text + suffix;
}

/** Only supported geographic question forms request place suggestions. */
export function placeCompletions(input: string, context: QuestionContext, places: QuestionPlaces) {
  const text = normalizeQuestion(input);
  const winner = /^(?:(?:איזו (?:רשימה|מפלגה)|איזה (?:רשימה|מפלגה)|מי) (?:קיבלה|קבלה|קיבל) (?:את )?הכי הרבה קולות|מי (?:ניצחה|ניצח)) ב(?:(?:יישוב|ישוב)(?: |$))?/.exec(text);
  let prefix = winner?.[0];
  let remainder = winner ? text.slice(winner[0].length) : '';
  if (prefix && /(?:יישוב|ישוב)$/.test(prefix)) prefix += ' ';
  if (!prefix) {
    for (const party of Object.keys(context.votes)) {
      const name = context.names[party] ?? party;
      for (const token of [name, party, ...(name.startsWith('ה') ? [name.slice(1)] : [])]) {
       for (const verb of ['קיבלה', 'קבלה', 'קיבל', 'קבלו', 'קיבלו']) {
        const base = normalizeQuestion(`כמה קולות ${verb} ${token}`);
        if (text.startsWith(`${base} ב`)) {
          remainder = text.slice(base.length + 2);
          const marker = /^(יישוב|ישוב)(?: |$)/.exec(remainder);
          prefix = `${base} ב${marker ? marker[1] + ' ' : ''}`;
          if (marker) remainder = remainder.slice(marker[0].length);
        }
       }
      }
    }
  }
  if (!prefix) return null;
  const locality = places.localities.find(place => remainder === normalizeQuestion(place.name) || remainder.startsWith(`${normalizeQuestion(place.name)} בקלפי`));
  if (locality) {
    const base = `${prefix}${normalizeQuestion(locality.name)}`;
    const tail = text.slice(base.length);
    if (!tail) return { label: 'אפשר לדייק לקלפי', options: [{ label: 'בחירת קלפי ביישוב', value: `${base} בקלפי ` }] };
    if (tail.startsWith(' בקלפי')) {
      const search = tail.slice(' בקלפי'.length).trim();
      return { label: `קלפיות ב${locality.name}`, options: places.stations.filter(place => place.name === locality.name && place.pollingStation !== undefined)
        .map(place => ({ label: `קלפי ${stationText(place)}`, value: `${base} בקלפי ${stationText(place)}`, detail: locality.name }))
        .filter(option => normalizeQuestion(option.value) !== text && option.label.replace('קלפי ', '').startsWith(search)) };
    }
  }
  return { label: 'בחרו יישוב', options: places.localities.filter(place => normalizeQuestion(place.name).startsWith(remainder))
    .map(place => ({ label: place.name, value: `${prefix}${place.name}` })) };
}
