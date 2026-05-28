import React from 'react';

export default function AdminWorkspaceBreadcrumb({ backLabel, currentLabel, onBack }) {
  return (
    <div className="admin-workspace-breadcrumb" aria-label="Breadcrumb">
      <button type="button" className="admin-workspace-crumb admin-workspace-crumbButton" onClick={onBack}>
        {backLabel}
      </button>
      <span className="admin-workspace-crumbDivider" aria-hidden="true">
        &gt;
      </span>
      <span className="admin-workspace-crumb admin-workspace-crumbCurrent">{currentLabel}</span>
    </div>
  );
}
