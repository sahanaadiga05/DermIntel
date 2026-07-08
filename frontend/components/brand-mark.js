export function BrandMark({ tone = "light" }) {
  const eyebrowClass = tone === "dark" ? "text-white/58" : "text-pine/56";
  const titleClass = tone === "dark" ? "text-white" : "text-ink";

  return (
    <div className="inline-flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pine text-lg font-semibold text-white shadow-panel">
        D
      </div>
      <div>
        <p className={`text-left text-xs font-semibold uppercase tracking-[0.3em] ${eyebrowClass}`}>
          DermIntel
        </p>
        <p className={`text-left text-sm font-medium ${titleClass}`}>Personalized Ingredient Analyzer</p>
      </div>
    </div>
  );
}

