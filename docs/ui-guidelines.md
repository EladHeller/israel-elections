# UI guidelines

Apply these rules to every client change, as required by AGENTS.md. Shared CSS in `elections-client/src/styles.css` provides a baseline for every button, select and link; component-specific controls refine it.

Use `ui-button ui-button-primary` for the main action and `ui-button ui-button-quiet` for suggestions or secondary actions. Existing `ghost` and `primary` controls inherit the baseline. Reuse `ElectionSelector` for election choice and `SearchableSelect` when options need filtering. Every control needs intentional typography, padding, borders, surfaces, hover, disabled and keyboard-focus states. Never rely on default browser button or dropdown presentation.

Never underline links in any state. Use `ui-link` for standalone navigation or a deliberate inline color/icon treatment. Keep a clear focus ring and meaningful label; do not replace semantic anchors with clickable spans.

Use shared light/dark tokens. Gains use `--gain`/`--gain-background`; losses use `--loss`/`--loss-background`, alongside textual gain/loss labels. Support RTL, long text and narrow mobile widths, with 44px targets for main actions.

Check actual light/dark rendering, keyboard navigation, Enter submission, loading and disabled states, and mobile layout. Disclose unavailable visual verification. Extend shared components instead of duplicating dropdown behavior.
