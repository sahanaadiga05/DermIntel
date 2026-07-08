export function SectionCard({ title, eyebrow, children, className = "" }) {
  return (
    <section className={`glass-panel rounded-[28px] p-6 shadow-panel ${className}`}>
      <div className="mb-5">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-pine/60">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

