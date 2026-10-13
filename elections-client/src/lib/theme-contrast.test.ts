import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

const css = readFileSync('elections-client/src/styles.css', 'utf8');
const dark = css.split(":root[data-theme='dark'] {")[1].split('}')[0];
const tokens = Object.fromEntries([...dark.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map(([, name, value]) => [name, value]));
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (color: number[]) => color.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: number[], b: number[]) => {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
};

test('dark text and status labels remain legible on their surfaces', () => {
  const pairs = [
    ...['ink-90', 'ink-70', 'ink-50'].flatMap((text) => ['card', 'surface-muted', 'surface-hover', 'ink-20'].map((bg) => [text, bg])),
    ['gain', 'gain-background'], ['loss', 'loss-background'],
    ['pass-text', 'pass-background'], ['fail-text', 'fail-background'],
    ['warning-text', 'edited-background'], ['info-text', 'info-background'],
    ['demo-text', 'demo-background'], ['demo-label', 'demo-background'],
  ];
  for (const [fg, bg] of pairs) assert(ratio(rgb(tokens[fg]), rgb(tokens[bg])) >= 4.5, `${fg} on ${bg}`);
});

test('control boundaries contrast with both default and hover surfaces', () => {
  for (const bg of ['card', 'surface-muted', 'surface-hover']) {
    assert(ratio(rgb(tokens['control-border']), rgb(tokens[bg])) >= 3, `control border on ${bg}`);
  }
});

test('configured bloc colors contrast with dark chart surfaces and tracks', () => {
  const configs = JSON.parse(readFileSync('elections-client/src/data/blocs.json', 'utf8'));
  const colors = [...JSON.stringify(configs).matchAll(/"color":"(#[\da-f]{6})"/g)].map(([, color]) => color);
  assert(colors.length > 0);
  const tint = Number(dark.match(/--chart-tint:\s*(\d+)%/)![1]) / 100;
  for (const color of colors) {
    const adjusted = rgb(color).map((c) => c * (1 - tint) + tint);
    for (const bg of ['card', 'chart-track']) assert(ratio(adjusted, rgb(tokens[bg])) >= 3, `${color} on ${bg}`);
  }
});
