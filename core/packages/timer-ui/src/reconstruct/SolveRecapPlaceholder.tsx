'use client';

import './solve-recap.css';

export function SolveRecapBodyPlaceholder() {
  return <div className="shell-recap-placeholder-body" aria-hidden="true">
    <div className="shell-recap-skeleton-summary">
      {[0, 1, 2].map(cell => <span key={cell} className="shell-recap-skeleton-block" />)}
    </div>
    <div className="shell-recap-skeleton-steps">
      {[0, 1, 2, 3, 4, 5].map(row => <div key={row} className="shell-recap-skeleton-row">
        <span className="shell-recap-skeleton-block" />
        <span className="shell-recap-skeleton-block" />
      </div>)}
    </div>
  </div>;
}

export default function SolveRecapPlaceholder() {
  return (
    <section className="shell-recap shell-recap-placeholder" aria-hidden="true">
      <div className="shell-recap-head">
        {[0, 1, 2].map(button => <span key={button} className="shell-recap-skeleton-block shell-recap-skeleton-button" />)}
      </div>
      <div className="shell-recap-body">
        <SolveRecapBodyPlaceholder />
      </div>
    </section>
  );
}
