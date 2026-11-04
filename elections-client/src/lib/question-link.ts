/** Pin the election as well as the text so shared questions remain reproducible. */
export function questionHref(election: string, question: string): string {
  return `/questions/${encodeURIComponent(election)}?${new URLSearchParams({ q: question.trim() })}`;
}
