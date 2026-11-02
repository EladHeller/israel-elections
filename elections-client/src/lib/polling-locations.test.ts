import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { parsePollingStations } from './party-research';
import { findPollingLocation, locationMapLinks } from './polling-locations';
import PollingStationLocation from '../components/PollingStationLocation';
import locations from '../data/polling-locations-26.json';

test('joins station clusters by settlement and keeps cluster metadata out of party votes', () => {
  const rows = parsePollingStations('שם ישוב,סמל ישוב,קלפי,ריכוז,כשרים,א\nירושלים,03000,1,05,100,100\nאודם,4010,1,1,20,20');
  assert.equal(rows[0].clusterCode, '5');
  assert.deepEqual(rows[0].votes, { א: 100 });
  assert.equal(findPollingLocation(locations, rows[0])?.name, 'מרכז קהילתי "אשכולות"');
  assert.equal(findPollingLocation(locations, rows[1])?.name, 'מזכירות');
  assert.equal(findPollingLocation(locations, { ...rows[0], clusterCode: '99999' }), undefined);
  assert.equal(findPollingLocation(locations, { ...rows[0], clusterCode: undefined }), undefined);
  assert.equal(findPollingLocation(locations, { ...rows[0], pollingStation: undefined }), undefined);
  assert.equal(Object.keys(locations).length, 4399);
  for (const location of Object.values(locations)) {
    assert.ok(location.lat > 29 && location.lat < 34);
    assert.ok(location.lon > 34 && location.lon < 37);
  }
});

test('location panel loads the map only on request, supports closing, and links to exact coordinates', () => {
  const location = locations['3000:5'];
  const links = locationMapLinks(location);
  assert.equal(new URL(links.google).searchParams.get('query'), `${location.lat},${location.lon}`);
  assert.equal(new URL(links.embed).searchParams.get('marker'), `${location.lat},${location.lon}`);
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(React.createElement(PollingStationLocation, { location, localityName: 'ירושלים' })); });
  assert.equal(renderer.root.findAllByType('iframe').length, 0);
  const button = renderer.root.findByType('button');
  assert.equal(button.props['aria-expanded'], false);
  act(() => button.props.onClick());
  assert.equal(renderer.root.findByType('iframe').props.src, links.embed);
  assert.equal(button.props['aria-expanded'], true);
  act(() => button.props.onClick());
  assert.equal(renderer.root.findAllByType('iframe').length, 0);
  act(() => renderer.update(React.createElement(PollingStationLocation, { localityName: 'ירושלים' })));
  assert.equal(renderer.toJSON(), null);
  act(() => renderer.unmount());
});

test('a location import completing after unmount does not update the abandoned view', async () => {
  const { usePollingLocations } = await import('../hooks/use-polling-locations');
  function View() { usePollingLocations('26'); return null; }
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(React.createElement(View)); });
  act(() => renderer.unmount());
  await import('../data/polling-locations-26.json');
  await new Promise(resolve => setImmediate(resolve));
});
