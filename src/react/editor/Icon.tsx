import type { Effect } from "@/core/types";

/** Decorative icon for a cell state, so state is never carried by colour alone. */
export const EffectIcon = ({ effect }: { effect: Effect | undefined }) => {
  const path =
    effect === "allow"
      ? "M3 8.5l3.5 3.5L13 4.5"
      : effect === "deny"
        ? "M4 4l8 8M12 4l-8 8"
        : "M4 8h8";
  return (
    <svg
      className="raci-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
