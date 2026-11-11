import type { SimulatorViewProps } from "@/react/simulator/view";

/** The strips view: one full-width strip per visible action with the answer and one reason line. */
export const Strips = ({ results, t }: SimulatorViewProps) => (
  <ul className="raci-strips" aria-label={t("simulator.results")}>
    {results.map(({ action, decision, reasonText }) => (
      <li
        key={action.id}
        className={`raci-strip raci-strip--${decision.allowed ? "allow" : "deny"}`}
      >
        <span className="raci-strip-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false">
            {decision.allowed ? (
              <path d="M3.5 8.5l3 3L12.5 5" fill="none" stroke="currentColor" strokeWidth="2" />
            ) : (
              <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="2" />
            )}
          </svg>
        </span>
        <div className="raci-strip-body">
          <strong className="raci-strip-title">
            {t("simulator.strip.title", {
              action: action.label ?? action.id,
              answer: t(decision.allowed ? "simulator.strip.yes" : "simulator.strip.no"),
            })}
          </strong>
          <p className="raci-strip-reason">{reasonText}</p>
        </div>
      </li>
    ))}
  </ul>
);

/** Placeholder strips while a host evaluation is running. */
export const StripsSkeleton = ({ count, label }: { count: number; label: string }) => (
  <div aria-busy="true">
    <ul className="raci-strips" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="raci-strip raci-strip--skeleton" />
      ))}
    </ul>
    <p className="raci-strips-note">{label}</p>
  </div>
);
