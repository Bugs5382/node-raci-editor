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
/** English defaults for the simulator. Hosts override any key through `config.strings`. */
export const simulatorStrings: Record<string, string> = {
  "simulator.title": "Previews what these rules would allow",
  "simulator.person": "Person",
  "simulator.personPlaceholder": "Search for a person",
  "simulator.memberships": "Extra memberships",
  "simulator.membershipsPlaceholder": "Add a membership",
  "simulator.noMatches": "No matches",
  "simulator.remove": "Remove {label}",
  "simulator.results": "Results",
  "simulator.action": "Action",
  "simulator.result": "Result",
  "simulator.why": "Why",
  "simulator.walk": "Checked, nearest first",
  "simulator.allowed": "Would be allowed",
  "simulator.denied": "Would be denied",
  "simulator.allCategories": "All categories",
  "simulator.emptyPerson": "Choose a person to preview what these rules would allow.",
  "simulator.emptyCategory": "There are no categories to preview.",
  "simulator.emptyActions": "There are no actions to show.",
  "simulator.reason.entry": "{verdict} by {subject} in {category} ({action})",
  "simulator.reason.inherited": "{verdict} by {subject} ({action}), inherited from {category}",
  "simulator.reason.global": "{verdict} by {subject} ({action}), from the rules for all categories",
  "simulator.reason.stopped":
    "Would be denied: no rule matched, and inheriting stopped at {category}",
  "simulator.reason.owner": "{verdict}: an owner of this category or of one above it",
  "simulator.reason.superuser": "{verdict}: this subject always has this action",
  "simulator.reason.requires": "{verdict}: needs {action} first",
  "simulator.reason.default": "Would be denied: no rule matched (default deny)",
  "simulator.loading": "Previewing...",
  "simulator.error": "Could not preview the result.",
  "simulator.retry": "Retry",
  "simulator.strip.title": "{action} - {answer}",
  "simulator.strip.yes": "Would be allowed",
  "simulator.strip.no": "Would be denied",
  "simulator.box.reason": "Reason",
  "simulator.box.decidedBy": "Decided by",
  "simulator.box.walk": "Walk",
  "simulator.box.overridden": "Overridden ({count})",
  "simulator.box.noRule": "No rule matched",
  "simulator.box.noMatch": "no match",
  "simulator.box.stopped": "Inheriting stopped here",
  "simulator.box.direct": "direct",
  "simulator.box.implied": "implied",
  "simulator.box.deciding": "deciding",
  "simulator.box.effectAllow": "Allow",
  "simulator.box.effectDeny": "Deny",
  "simulator.box.entry": "Entry #{n}",
};
