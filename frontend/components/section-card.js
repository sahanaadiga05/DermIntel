export function SectionCard({
  title,
  eyebrow,
  children,
  className = "",
  eyebrowClassName = "text-pine/60",
  titleClassName = "text-ink"
}) {
  return (
    <section className={`glass-panel min-w-0 overflow-hidden rounded-[28px] p-5 shadow-panel sm:p-6 ${className}`}>
      <div className="mb-5">
        {eyebrow ? (
          <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.3em] ${eyebrowClassName}`}>
            {eyebrow}
          </p>
        ) : null}
        <h2 className={`display-type text-2xl font-semibold ${titleClassName}`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}