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
/** English defaults for the settings panel; a host overrides any key through `config.strings`. */
export const settingsStrings: Record<string, string> = {
  "settings.title": "Settings",
  "settings.actions.legend": "Actions",
  "settings.actions.hint": "Choose which actions are shown and in what order.",
  "settings.actions.implies": "Implies: {list}",
  "settings.actions.impliesNone": "Implies no other action",
  "settings.actions.moveUp": "Move {label} up",
  "settings.actions.moveDown": "Move {label} down",
  "settings.moveUp": "Up",
  "settings.moveDown": "Down",
  "settings.actions.lastHint": "At least one action must stay visible.",
  "settings.kinds.legend": "Subject kinds",
  "settings.kinds.hint": "Choose which kinds of subject can be picked.",
  "settings.kinds.lastHint": "At least one subject kind must stay enabled.",
  "settings.behavior.legend": "Behavior",
  "settings.showInherited": "Show inherited entries",
  "settings.confirmDeny": "Confirm before saving a Deny",
  "settings.density.legend": "Density",
  "settings.density.comfortable": "Comfortable",
  "settings.density.compact": "Compact",
  "settings.reset": "Reset to defaults",
};
