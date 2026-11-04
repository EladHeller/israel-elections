import React, { useState } from 'react';
import { questionHref } from '../lib/question-link';

export default function QuestionShare({ election, question, disabled }: { election: string; question: string; disabled: boolean }) {
  const href = questionHref(election, question);
  const [feedback, setFeedback] = useState<{ href: string; copied: boolean; url: string }>();
  const current = feedback?.href === href ? feedback : undefined;
  const copy = async () => {
    const url = new URL(href, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setFeedback({ href, copied: true, url });
    } catch {
      setFeedback({ href, copied: false, url });
    }
  };
  return <div className="question-share">
    <button type="button" className="ui-button ui-button-quiet" disabled={disabled || !question.trim()} onClick={() => { void copy(); }}>העתקת קישור לשאלה</button>
    {current && <span role="status">{current.copied ? 'הקישור הועתק' : 'אפשר להעתיק את הקישור מהשדה הבא'}
      {!current.copied && <input aria-label="קישור לשאלה" dir="ltr" readOnly value={current.url} onFocus={event => event.target.select()} />}
    </span>}
  </div>;
}
