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
import type { RenderCellProps } from "@/react/editor/index";

/**
 * A sample `renderCell` for the rules editor: a round dot that is filled for Allow, crossed for
 * Deny and hollow for Not set. It shows what a host gets to work with: it keeps the fixed cell
 * size from `size`, puts the editor's `label` on its control, and calls `onCycle`.
 */
export const demoRenderCell = (cell: RenderCellProps) => (
  <button
    type="button"
    className={`demo-custom-cell demo-custom-cell--${cell.state}${cell.includedBy ? " demo-custom-cell--included" : ""}`}
    aria-label={cell.label}
    title={cell.title}
    disabled={cell.readOnly}
    style={{ width: cell.size.width, height: cell.size.height }}
    onClick={cell.onCycle}
  >
    <span className="demo-custom-cell__dot" aria-hidden="true">
      {cell.state === "allow" ? "+" : cell.state === "deny" ? "-" : ""}
    </span>
  </button>
);
