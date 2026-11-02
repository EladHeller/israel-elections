import React from 'react';

interface BetaBadgeProps {
  compact?: boolean;
}

export default function BetaBadge({ compact = false }: BetaBadgeProps) {
  return (
    <span
      className="beta-badge"
      style={compact ? { paddingBlock: 0, paddingInline: '.4rem', fontSize: '.7rem', lineHeight: 1.2 } : undefined}
    >
      בטא
    </span>
  );
}
