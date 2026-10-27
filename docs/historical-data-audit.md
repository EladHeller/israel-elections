# Election data audit — 27 October 2026

Compared the complete Hebrew Wikipedia results tables for Knessets 1–25 against every published `voteData` entry and the concise display names in `party-names.json`. The baseline is develop commit `489ca148d77c197232fd84cffe191907e8a74b2f`, which already includes the first-election corrections from PR #479. Checked embedded vote counts in `realResults`, `withoutAgreements`, and `beforeBaderOffer` for consistency, the static historical listener inputs, and the summary totals.

Short names, established acronyms, spelling variants and omitted campaign slogans are intentional; they are not errors. Missing constituent parties are restored where the shortened name concealed the identity of a joint list. No new snapshot tests are added.

## Coverage and vote totals

Every list in each Wikipedia result table was matched. The extra repository entries in Knessets 22–24 are zero-vote registered lists omitted from the Wikipedia result tables; they do not change the totals.

| Knesset | Wikipedia lists | Repository lists | Corrected valid-vote sum | Result |
|---|---:|---:|---:|---|
| [1](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%90%D7%A1%D7%A4%D7%94_%D7%94%D7%9E%D7%9B%D7%95%D7%A0%D7%A0%D7%AA) | 21 | 21 | 434,684 | summary/listener synchronized with PR #479 |
| [2](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%A0%D7%99%D7%99%D7%94) | 17 | 17 | 687,492 | 13 display names corrected |
| [3](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%9C%D7%99%D7%A9%D7%99%D7%AA) | 18 | 18 | 853,219 | 13 display names corrected |
| [4](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A8%D7%91%D7%99%D7%A2%D7%99%D7%AA) | 24 | 24 | 969,337 | 15 display names corrected |
| [5](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%97%D7%9E%D7%99%D7%A9%D7%99%D7%AA) | 14 | 14 | 1,006,964 | 7 display names corrected |
| [6](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%99%D7%A9%D7%99%D7%AA) | 17 | 17 | 1,206,728 | 9 display names corrected |
| [7](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%91%D7%99%D7%A2%D7%99%D7%AA) | 16 | 16 | 1,367,743 | 7 display names corrected |
| [8](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%9E%D7%99%D7%A0%D7%99%D7%AA) | 21 | 21 | 1,566,855 | 1 display names corrected; retain official חל טעם; fix listener symbol |
| [9](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%AA%D7%A9%D7%99%D7%A2%D7%99%D7%AA) | 22 | 22 | 1,747,820 | Names and votes match |
| [10](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%99%D7%A8%D7%99%D7%AA) | 31 | 31 | 1,937,366 | Names and votes match |
| [11](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%90%D7%97%D7%AA_%D7%A2%D7%A9%D7%A8%D7%94) | 26 | 26 | 2,073,321 | לובה אליאב symbol רף → דף |
| [12](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%AA%D7%99%D7%9D_%D7%A2%D7%A9%D7%A8%D7%94) | 27 | 27 | 2,283,123 | הכח השקט 1,574 → 1,579 |
| [13](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%9C%D7%95%D7%A9_%D7%A2%D7%A9%D7%A8%D7%94) | 25 | 25 | 2,616,841 | stale listener counts corrected |
| [14](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%90%D7%A8%D7%91%D7%A2_%D7%A2%D7%A9%D7%A8%D7%94_%D7%95%D7%9C%D7%A8%D7%90%D7%A9%D7%95%D7%AA_%D7%94%D7%9E%D7%9E%D7%A9%D7%9C%D7%94) | 20 | 20 | 3,052,130 | 2 display names corrected; stale listener counts corrected |
| [15](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%97%D7%9E%D7%A9_%D7%A2%D7%A9%D7%A8%D7%94_%D7%95%D7%9C%D7%A8%D7%90%D7%A9%D7%95%D7%AA_%D7%94%D7%9E%D7%9E%D7%A9%D7%9C%D7%94) | 31 | 31 | 3,309,416 | Names and votes match |
| [16](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%A9_%D7%A2%D7%A9%D7%A8%D7%94) | 27 | 27 | 3,148,364 | 2 display names corrected |
| [17](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%91%D7%A2_%D7%A2%D7%A9%D7%A8%D7%94) | 31 | 31 | 3,137,064 | 3 display names corrected; Wikipedia total row is turnout, not valid votes |
| [18](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A9%D7%9E%D7%95%D7%A0%D7%94_%D7%A2%D7%A9%D7%A8%D7%94) | 33 | 33 | 3,373,490 | 3 display names corrected |
| [19](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%AA%D7%A9%D7%A2_%D7%A2%D7%A9%D7%A8%D7%94) | 32 | 32 | 3,792,742 | 1 display names corrected |
| [20](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%A8%D7%99%D7%9D) | 25 | 25 | 4,210,884 | Names and votes match |
| [21](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%A8%D7%99%D7%9D_%D7%95%D7%90%D7%97%D7%AA) | 40 | 40 | 4,309,270 | stale summary total corrected |
| [22](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%A8%D7%99%D7%9D_%D7%95%D7%A9%D7%AA%D7%99%D7%99%D7%9D) | 29 | 32 | 4,436,806 | keep zero-vote registered lists |
| [23](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%A8%D7%99%D7%9D_%D7%95%D7%A9%D7%9C%D7%95%D7%A9) | 29 | 30 | 4,590,062 | retain official symbols קי and זך; keep zero-vote registered lists |
| [24](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%A8%D7%99%D7%9D_%D7%95%D7%90%D7%A8%D7%91%D7%A2) | 38 | 39 | 4,410,052 | 1 display names corrected; keep zero-vote registered lists |
| [25](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%A8%D7%99%D7%9D_%D7%95%D7%97%D7%9E%D7%A9) | 40 | 40 | 4,764,742 | 1 display names corrected |

## Corrected names

| Knesset | Symbol | Previous display | Corrected display |
|---|---|---|---|
| 2 | ו | חרות | הפועל המזרחי |
| 2 | ח | חזית דתית לאומית | חרות |
| 2 | ק | המפלגה הפרוגרסיבית | מק"י |
| 2 | פ | ספרדים ועדות המזרח | המפלגה הפרוגרסיבית |
| 2 | יד | מק"י | הרשימה הדמוקרטית לערביי ישראל |
| 2 | ג | אחדות העבודה | אגודת ישראל |
| 2 | סצ | רשימת הדמוקרטים הערבים | ספרדים ועדות המזרח |
| 2 | ד | פיתוח ועבודה | פועלי אגודת ישראל |
| 2 | ב | חקלאות ופיתוח | המזרחי |
| 2 | ל | שיתוף ואחווה | התאחדות התימנים בישראל |
| 2 | ע | פרוגרסיבים | חקלאות ופיתוח |
| 2 | טת | ברית הציונים הרוויזיוניסטים | אמוני ישראל |
| 2 | ש | התאחדות התימנים בישראל | למען העולים החדשים והחיילים המשוחררים |
| 3 | צ | אחדות העבודה | הציונים הכלליים |
| 3 | ב | המפד"ל | חזית דתית לאומית |
| 3 | תו | מפלגה פרוגרסיבית | אחדות העבודה |
| 3 | פ | פיתוח ועבודה | המפלגה הפרוגרסיבית |
| 3 | יד | קדמה ועבודה | הרשימה הדמוקרטית לערביי ישראל |
| 3 | נ | שיתוף ואחווה | קידמה ועבודה |
| 3 | ע | התאחדות התימנים | חקלאות ופיתוח |
| 3 | סצ | הציונים הכלליים | ספרדים ועדות המזרח |
| 3 | צח | הרשימה הסוציאליסטית | הרשימה הערבית – המרכז |
| 3 | ש | זכויות האזרח | ליכוד – תנועה כלכלית עממית |
| 3 | ל | אל חורייה | התאחדות התימנים בישראל |
| 3 | יט | שחר | רשימה דתית מקורית – תנועת בני תימן |
| 3 | רי | הרשימה הדמוקרטית הערבית | רשימת העולה החדש |
| 4 | צ | אחדות העבודה | הציונים הכלליים |
| 4 | תו | המפלגה הליברלית | אחדות העבודה |
| 4 | ע | קדמה ופיתוח | חקלאות ופיתוח |
| 4 | יס | אחדות העדה התימנית | ליכוד יוצאי צפון אפריקה |
| 4 | נ | תנועה לעבודת מיעוטים | קידמה ועבודה |
| 4 | יד | הרשימה הדמוקרטית לערביי ישראל | סיעה עצמאית לערביי ישראל |
| 4 | שת | שוויון ושיתוף | מפלגת עבודה ערבית ישראלית |
| 4 | סש | סוציאליזם ושיתוף | מפלגה לאומית ספרדית ועדות המזרח |
| 4 | סר | שיתוף ורעות | איחוד לאומי של ספרדים ובני עדות המזרח |
| 4 | ש | התאחדות התימנים בישראל | סיעת נכים ונפגעי השואה |
| 4 | לש | למען ילדי ישראל | סיעת תימנים |
| 4 | רט | רשימה טכנית שלוש | בלתי תלויים |
| 4 | רנ | ציונים כלליים | בונד |
| 4 | רי | רשימת הפועלים החקלאים | חזית העולה החדש |
| 4 | טש | תנועה שמאלית | כוח שלישי |
| 5 | מ | אחדות העבודה | מפ"ם |
| 5 | תו | מפ"ם | אחדות העבודה |
| 5 | ג | פועלי אגודת ישראל ואגודת ישראל | אגודת ישראל |
| 5 | ד | הרשימות הערביות | פועלי אגודת ישראל |
| 5 | נ | חרות ועבודה | קידמה ועבודה |
| 5 | סש | סוציאליסטים עצמאיים | למען הצדק והאחווה |
| 5 | עט | עולם חדש | שוחרי הדמוקרטיה |
| 6 | מ | אחדות העבודה | מפ"ם |
| 6 | ג | אגודת ישראל ופועלי אגודת ישראל | אגודת ישראל |
| 6 | ד | רשימה קומוניסטית חדשה | פועלי אגודת ישראל |
| 6 | ש | קידמה ושותפות | העולם הזה – כוח חדש |
| 6 | ק | פועלי רשימה ערבית | מק"י |
| 6 | ענ | העולם הזה | התנועה לאחווה |
| 6 | כנ | כוח חדש | רשימת השלום |
| 6 | נס | סדר חדש | אייבי נתן לכנסת |
| 6 | פש | פיתוח ושלום | ישראל הצעירה |
| 7 | ג | אגודת ישראל ופועלי אגודת ישראל | אגודת ישראל |
| 7 | ד | העולם הזה | פועלי אגודת ישראל |
| 7 | ש | מק"י | העולם הזה – כוח חדש |
| 7 | ק | פועלי רשימה ערבית | מק"י |
| 7 | כן | זכויות האזרח | למען ארץ ישראל |
| 7 | נס | סדר חדש | רשימת שלום |
| 7 | פז | כוח חדש וצעירי ישראל | ישראל הצעירה |
| 8 | גד | אגודת ישראל | חזית דתית תורתית |
| 14 | ו | החזית הדמוקרטית לשלום ולשוויון | חד"ש–בל"ד |
| 14 | ע | המפלגה הדמוקרטית הערבית | מד"ע–רע"ם |
| 16 | אמת | העבודה | העבודה–מימד |
| 16 | ו | החזית הדמוקרטית לשלום ולשוויון | חד"ש–תע"ל |
| 17 | אמת | העבודה | העבודה–מימד |
| 17 | טב | איחוד לאומי | האיחוד הלאומי–מפד"ל |
| 17 | פץ | מפלגה למלחמה בבנקים | כוח הכסף |
| 18 | מחל | הליכוד | הליכוד–אח"י |
| 18 | ו | חד"ש החזית הדמוקרטית לשלום ושיוויון | חד"ש – החזית הדמוקרטית לשלום ולשוויון |
| 18 | אר | מפלגת "אור" בראשון ירון ידען | אור |
| 19 | מחל | הליכוד | הליכוד–ישראל ביתנו |
| 24 | ק | נועם | נועם קולמן, לירון עופרי וסולי וולף |
| 25 | ת | עלה ירוק | דעת טוב ורע וברית שבט אברהם – עלה ירוק ואוסרת אל איסלמיה |
| 26 | ק | תקומה | דרך חזון ותקומה |
| 26 | ני | נעם | נעם לישראל |

## Other data corrections

- Knesset 11: `לובה אליאב לכנסת` uses `דף`, not `רף`. Updated the name key, published vote key and static listener input together. The National Library preserves a contemporary campaign poster explicitly titled [דף – לובה אליאב לכנסת](https://www.nli.org.il/he/sheets/NNL_Ephemera997001300310405171/NLI).
- Knesset 12: Wikipedia gives `הכח השקט` 1,579 votes; the repository had 1,574. Corrected the published snapshot and listener input. The new sum, 2,283,123, also matches the [official Knesset total](https://main.knesset.gov.il/About/History/pages/knessethistory.aspx?kns=12). IDI still gives 1,574 for this list, and its table has additional differences; the original gazette PDF could not be retrieved during this audit. The +5 correction is supported by Wikipedia and consistency with the official total, rather than a direct reading of that PDF.
- Knesset 13 listener input: התחיה 31,057 → 31,957. The published snapshot already matches Wikipedia.
- Knesset 14 listener input: מרצ 226,775 → 226,275; תלם אמונה 11,697 → 12,737; זכויות הגבר 2,388 → 2,338. The published snapshot already matches Wikipedia.
- Knesset 8 listener input used the later Likud symbol מחל. It now matches the published historical key חל טעם.
- Knesset 1 listener input and summary still held the pre-PR #479 counts. Synchronized יא = 3,214 and יט = 239; valid votes = 434,684; unrepresented votes = 19,424.
- Knesset 12 summary: valid votes 2,283,118 → 2,283,123; unrepresented votes 55,500 → 55,505.
- Knesset 21 summary: valid votes 4,309,054 → 4,309,270. The detailed snapshot already contained the correct votes; unrepresented votes stay 366,016.

## Wikipedia discrepancies intentionally not copied

- Knesset 8: Wikipedia spells Likud’s symbol חל טעמ. The original [official gazette](https://free-justice.openapi.gov.il/free/moj/portal/rest/searchpredefinedapi/v1/SearchPredefinedApi/Documents/u8kRhBVng132qlQNmAqJteIufZaBK~wOy8sPxmEjgF0=), p. 608, and [CBS](https://www.cbs.gov.il/he/publications/doclib/2023/shnatonelectionstheknessetandgovernment.27/st27_01.pdf) use חל טעם. The repository spelling is retained.
- Knesset 23: the Wikipedia results table uses קע for שמע and צן for פעולה לישראל. The [official national results](https://votes23.bechirot.gov.il/) give קי (442 votes) and זך (210 votes), matching the repository. Those keys are retained.
- Knesset 17: the Wikipedia table’s total row says 3,186,739, which is total turnout. Its individual list rows sum to 3,137,064 valid votes, matching the repository. This is a total-row issue, not missing list votes.
- Knessets 22–24: preserve the zero-vote entries omitted by Wikipedia (22: זן, כ, נץ; 23: זץ; 24: רק).

## Knesset 26

The election has no published counted results at audit time, so vote totals cannot be checked against a Wikipedia result table. Compared all 38 registered list identities, including the two withdrawn lists, against the [Wikipedia list sections](https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%A8%D7%99%D7%9D_%D7%95%D7%A9%D7%A9). Corrected ק to דרך חזון ותקומה and ני to נעם לישראל in both display-name data and the current manifest. Existing registered symbols and withdrawals are unchanged.

## Validation

- Recompared every Wikipedia list vote after the edits, with the documented official-symbol exceptions.
- Checked all embedded result-section votes against their `voteData` values.
- Checked every static historical listener input against the corresponding published snapshot.
- Recalculated every summary entry from detailed votes and the official represented-list set.
- All resulting valid-vote sums match the Wikipedia list-row sums.
