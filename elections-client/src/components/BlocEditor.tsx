import React, { useState } from 'react';
import type { BlocsConfig } from '../types';

interface Props {
  blocs: BlocsConfig;
  parties: string[];
  partyToBloc: Record<string, string | null | undefined>;
  onPartyBlocChange: (party: string, bloc: string | null) => void;
  getPartyName: (party: string) => string;
}

export default function BlocEditor({ blocs, parties, partyToBloc, onPartyBlocChange, getPartyName }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const order = blocs.order || Object.keys(blocs.blocks);
  const targets: (string | null)[] = [...order, null];
  const assign = (party: string, target: string | null) => {
    if (!parties.includes(party)) return;
    onPartyBlocChange(party, target);
    setSelected(null);
    setDragged(null);
  };

  if (!parties.length) return null;

  return <div className="bloc-editor">
    <div className="bloc-editor-head">
      <span className="bloc-editor-title" role="status">
        {selected ? `${getPartyName(selected)} נבחרה — בחר גוש להעברה` : 'גרור מפלגה לגוש, או בחר מפלגה ואז גוש'}
      </span>
      {selected && <button type="button" className="ghost" onClick={() => setSelected(null)}>ביטול</button>}
    </div>
    <div className="bloc-editor-columns bloc-editor-all-groups" style={{ '--bloc-count': targets.length } as React.CSSProperties}>
      {targets.map((target) => {
        const label = target ? blocs.blocks[target].label : 'ללא שיוך';
        const members = parties.filter((party) => target
          ? partyToBloc[party] === target
          : !partyToBloc[party] || !order.includes(partyToBloc[party]!));
        return <div key={target || '__unassigned__'} className={`bloc-editor-column ${selected ? 'is-drop-target' : ''} ${!target && members.length ? 'has-unassigned' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            assign(dragged || event.dataTransfer.getData('text/plain'), target);
          }}
          onClick={() => { if (selected) assign(selected, target); }}>
          <button type="button" className="bloc-editor-target" disabled={!selected}
            aria-label={`העברה אל ${label}`}>
            <span style={{ color: target ? blocs.blocks[target].color : undefined }}>●</span> {label}{!target && members.length > 0 && <span className="bloc-unassigned-count">{members.length}</span>}
          </button>
          <div className="bloc-editor-chips">
            {members.map((party) => <button key={party} type="button" draggable
              className={`bloc-chip ${selected === party ? 'is-selected' : ''}`}
              aria-pressed={selected === party}
              onClick={(event) => {
                event.stopPropagation();
                setSelected((previous) => previous === party ? null : party);
              }}
              onDragStart={(event) => {
                setDragged(party);
                setSelected(party);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', party);
              }}
              onDragEnd={() => { setDragged(null); setSelected(null); }}>
              {getPartyName(party)}
            </button>)}
            {!members.length && <span className="bloc-editor-title">אין מפלגות משויכות</span>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
