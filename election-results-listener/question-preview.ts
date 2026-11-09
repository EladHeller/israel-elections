import { answerImagePng } from '../preview-runtime/answer-image';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { parseElectionQuestion, type QuestionContext } from '../elections-client/src/lib/election-questions';
import { executeQuestionWithData } from '../elections-client/src/lib/question-execution';
import { questionAnswerText } from '../elections-client/src/lib/question-answer-text';
import { cleanElectionResults } from '../elections-client/src/lib/data';
import { getElectionBlocs } from '../elections-client/src/lib/bloc-preferences';
import type { BlocsConfig, ElectionConfig, ElectionManifest, ElectionResultsPayload, PartyNames } from '../elections-client/src/types';
import namesAll from '../elections-client/src/data/party-names.json';
import blocsAll from '../elections-client/src/data/blocs.json';
import manifestsAll from '../elections-client/src/data/elections-manifests.json';

interface PreviewEvent { rawPath?: string; rawQueryString?: string; requestContext?: { http?: { method?: string } } }
type ReadText = (key: string) => Promise<string>;
const names = namesAll as Record<string, PartyNames>;
const manifests = manifestsAll as Record<string, ElectionManifest>;
const s3 = new S3Client({ maxAttempts: 1 });
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function previewHtml(siteUrl: string, election: string, question: string, sentences: string[]) {
  const title = escapeHtml(question);
  const description = escapeHtml(sentences.join(' ').slice(0, 300) + (sentences.join(' ').length > 300 ? '…' : ''));
  const url = escapeHtml(`${siteUrl}/questions/${election}?${new URLSearchParams({ q: question })}`);
  const image = escapeHtml(`${siteUrl}/api/question-preview/v1/${election}/image?${new URLSearchParams({ q: question })}`);
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + `<title>${title}</title><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:locale" content="he_IL"><meta property="og:site_name" content="בחירות לכנסת">`
    + `<meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`
    + `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}"></head>`
    + `<body><h1>${title}</h1>${sentences.map(sentence => `<p>${escapeHtml(sentence)}</p>`).join('')}<a href="${url}">פתיחת השאלה באתר הבחירות</a></body></html>`;
}

export function createPreviewHandler(read: ReadText, siteUrl: string) {
  return async (event: PreviewEvent) => {
    const method = event.requestContext?.http?.method;
    const match = /^\/api\/question-preview\/v1\/([1-9][0-9]*)(\/image)?$/.exec(event.rawPath ?? '');
    const params = new URLSearchParams(event.rawQueryString);
    const rawQuestion = params.get('q');
    const question = rawQuestion?.trim();
    const election = match?.[1];
    if (!['GET', 'HEAD'].includes(method ?? '') || !election || !Object.hasOwn(names, election)) {
      return { statusCode: 404, headers: { 'cache-control': 'no-store' }, body: '' };
    }
    if (params.getAll('q').length !== 1 || !question || question.length > 600 || [...rawQuestion!].some(char => char.charCodeAt(0) < 32 || char === '\u007f' || char === '\ufffd')) {
      return { statusCode: 400, headers: { 'cache-control': 'no-store' }, body: '' };
    }
    let sentences: string[] = [];
    let answered = false;
    try {
      // Memoize only within this invocation: warm containers must not retain live results.
      const reads = new Map<string, Promise<string>>();
      const text = (key: string) => {
        if (!reads.has(key)) reads.set(key, read(key));
        return reads.get(key)!;
      };
      const configs = JSON.parse(await text('election-config.json')) as Record<string, ElectionConfig>;
      const contextFor = async (id: string): Promise<QuestionContext> => {
        if (!Object.hasOwn(names, id) || !configs[id] || manifests[id] && !['counting', 'final'].includes(manifests[id].phase)) throw new Error('Election unavailable');
        const results = cleanElectionResults(JSON.parse(await text(`data/${id}/allResults.json`))) as ElectionResultsPayload;
        if (!results.voteData || Object.values(results.voteData).some(row => !row || !Number.isSafeInteger(row.votes) || row.votes < 0)) throw new Error('Invalid results');
        return { electionId: id, votes: results.voteData, config: configs[id],
          names: { ...Object.fromEntries((manifests[id]?.lists ?? []).map(list => [list.ballotLetter, list.name])), ...names[id] },
          blocs: getElectionBlocs(blocsAll as Record<string, BlocsConfig>, id) };
      };
      const context = await contextFor(election);
      const parsed = parseElectionQuestion(question, context);
      if (!('error' in parsed)) {
        const answer = await executeQuestionWithData(parsed.query, context, {
          text: path => text(path.replace(/^\//, '')),
          comparison: async id => {
            const comparison = await contextFor(id);
            return { id, config: comparison.config, votes: comparison.votes, names: names[id], blocs: (blocsAll as Record<string, BlocsConfig>)[id] };
          },
        });
        sentences = questionAnswerText(answer, parsed.query.kind);
        answered = sentences.length > 0;

      }
    } catch {
      console.error('Question preview unavailable');
    }
    const ttl = answered ? manifests[election]?.phase === 'counting' ? 30 : 86400 : 30;
    if (match![2]) {
      try {
        return {
          statusCode: 200,
          headers: { 'content-type': 'image/png', 'cache-control': `public, max-age=0, s-maxage=${ttl}`, 'x-content-type-options': 'nosniff' },
          isBase64Encoded: true,
          body: method === 'HEAD' ? '' : answerImagePng(election, question, sentences).toString('base64'),
        };
      } catch {
        console.error('Question preview image unavailable');
        return { statusCode: 302, headers: { location: `${siteUrl}/social/question-${election}-v2.png`, 'cache-control': 'public, max-age=0, s-maxage=30' }, body: '' };
      }
    }
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': `public, max-age=0, s-maxage=${ttl}`, 'x-content-type-options': 'nosniff' },
      body: method === 'HEAD' ? '' : previewHtml(siteUrl, election, question, sentences),
    };
  };
}

export async function readPreviewData(key: string, signal: AbortSignal) {
  if (!/^data\/[1-9][0-9]*\/(?:allResults\.json|elections\.csv|polling-stations\.csv)$/.test(key) && key !== 'election-config.json') throw new Error('Invalid data path');
  const response = await s3.send(new GetObjectCommand({ Bucket: process.env.CLIENT_BUCKET, Key: key }), { abortSignal: signal });
  if (!response.Body) throw new Error('Empty object');
  return response.Body.transformToString();
}

export async function handler(event: PreviewEvent) {
  const signal = AbortSignal.timeout(6000);
  return createPreviewHandler(key => readPreviewData(key, signal), process.env.SITE_URL!)(event);
}
