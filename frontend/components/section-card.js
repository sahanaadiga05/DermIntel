export function SectionCard({ title, eyebrow, children, className = "" }) {
  return (
    <section className={`glass-panel min-w-0 overflow-hidden rounded-[28px] p-5 shadow-panel sm:p-6 ${className}`}>
      <div className="mb-5">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-pine/60">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="display-type text-2xl font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

