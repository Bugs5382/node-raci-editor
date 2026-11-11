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
import { useId } from "react";
import type { SimulatorViewProps } from "@/react/simulator/view";

/**
 * The pool and obligation lists: a heading and a real list per entry, with the reason in text.
 * Nothing is drawn when there are no lists.
 */
export const Lists = ({ lists, t }: Pick<SimulatorViewProps, "lists" | "t">) => {
  const uid = useId();
  if (lists.length === 0) return null;
  return (
    <div className="raci-lists">
      {lists.map((list) => {
        const titleId = `${uid}-${list.id}`;
        return (
          <section key={list.id} className="raci-list" aria-labelledby={titleId}>
            <h3 className="raci-list-title" id={titleId}>
              {list.title}
            </h3>
            {list.items.length === 0 ? (
              <p className="raci-list-empty">{t("simulator.list.nobody")}</p>
            ) : (
              <ul className="raci-list-items" aria-labelledby={titleId}>
                {list.items.map((item) => (
                  <li
                    key={item.person}
                    className="raci-list-item"
                    data-everyone={item.everyone || undefined}
                  >
                    <span className="raci-list-person">{item.label}</span>{" "}
                    <span className="raci-list-reason">{item.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
