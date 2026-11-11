/*
MIT License

Copyright (c) 2026 Shane

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
import type { CSSProperties, ReactNode } from "react";
import type { CellStateId, CellStateStyle, Effect } from "@/core/types";
import { EffectIcon } from "@/react/editor/Icon";

/** The inline style of a cell from its state style. Never a size: the box size comes from the tokens only. */
export const cellInline = (st: CellStateStyle): CSSProperties | undefined => {
  const style: CSSProperties = {};
  if (st.colors?.fg) style.color = st.colors.fg;
  if (st.colors?.bg) style.background = st.colors.bg;
  if (st.colors?.border) style.borderColor = st.colors.border;
  if (st.shape?.radius) style.borderRadius = st.shape.radius;
  if (st.shape?.borderStyle) style.borderStyle = st.shape.borderStyle;
  if (st.shape?.borderWidth) style.borderWidth = st.shape.borderWidth;
  return Object.keys(style).length > 0 ? style : undefined;
};

/** The glyph of a cell: the host's, or the default icon. An empty string draws none. */
export const cellGlyph = (
  st: CellStateStyle,
  id: CellStateId,
  effect: Effect | undefined,
): ReactNode => {
  if (st.glyph === undefined) return <EffectIcon effect={effect} />;
  const content = typeof st.glyph === "function" ? st.glyph(id) : st.glyph;
  return content === "" ? null : <span className="raci-cell__glyph">{content}</span>;
};

const EFFECT: Record<CellStateId, Effect | undefined> = {
  allow: "allow",
  deny: "deny",
  none: undefined,
  included: undefined,
  inheritedAllow: "allow",
  inheritedDeny: "deny",
};

/** One cell face for the settings preview, drawn with the same pieces as an editor cell. */
export const PreviewCell = ({
  id,
  st,
  stateText,
  includedText,
}: {
  id: CellStateId;
  st: CellStateStyle;
  stateText: string;
  includedText: string;
}) => {
  const effect = EFFECT[id];
  const inherited = id === "inheritedAllow" || id === "inheritedDeny";
  const included = id === "included";
  const css = [
    "raci-cell",
    `raci-cell--${effect ?? "blank"}`,
    included ? "raci-cell--included" : "",
    inherited ? "raci-cell--inherited" : "",
    st.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={css} style={cellInline(st)} aria-hidden="true">
      <span className="raci-cell__primary">
        {cellGlyph(st, id, effect)}
        <span className="raci-cell__text">{st.text ?? stateText}</span>
      </span>
      <span className={`raci-cell__secondary${included ? "" : " raci-cell__secondary--off"}`}>
        {includedText}
      </span>
    </span>
  );
};
