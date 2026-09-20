'use client';

import './solve-recap.css';

export function SolveRecapBodyPlaceholder() {
  return <div className="shell-recap-placeholder-body" aria-hidden="true" />;
}

export default function SolveRecapPlaceholder() {
  return (
    <section className="shell-recap shell-recap-placeholder" aria-hidden="true">
      <div className="shell-recap-head" />
      <div className="shell-recap-body">
        <SolveRecapBodyPlaceholder />
      </div>
    </section>
  );
}
