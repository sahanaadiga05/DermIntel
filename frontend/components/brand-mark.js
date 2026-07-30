export function BrandMark({ tone = "light" }) {
  const eyebrowClass = tone === "dark" ? "text-lime-200/70" : "text-pine/52";
  const titleClass = tone === "dark" ? "text-white" : "text-ink";

  return (
    <div className="inline-flex max-w-full items-center gap-3">
      <div className={`relative flex h-11 w-11 flex-none items-center justify-center rounded-[15px] ${tone === "dark" ? "bg-white text-pine" : "bg-pine text-white"} shadow-panel`}>
        <span className="display-type -translate-y-px text-[24px] font-semibold">D</span>
        <span className={`absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full ${tone === "dark" ? "bg-lime-400" : "bg-[#cde77f]"}`} />
      </div>
      <div className="min-w-0">
        <p className={`truncate text-left text-[11px] font-bold uppercase tracking-[0.26em] ${eyebrowClass}`}>
          DermIntel
        </p>
        <p className={`truncate text-left text-sm font-semibold ${titleClass}`}>Formula intelligence</p>
      </div>
    </div>
  );
}

