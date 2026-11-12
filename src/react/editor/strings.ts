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
/** English defaults for the rules editor. Hosts override any key through `config.strings`. */
export const editorStrings: Record<string, string> = {
  "editor.title": "Rules for {category}",
  "editor.pathSeparator": " / ",
  "editor.subject": "Subject",
  "editor.everyone": "Everyone",
  "editor.addPlaceholder": "Add a subject",
  "editor.pickMatcher": "Choose who to add",
  "editor.key": "Key",
  "editor.group.access": "Access",
  "editor.group.obligation": "Obligations",
  "editor.empty": "No subjects have rules in this category yet.",
  "editor.allow": "allow",
  "editor.deny": "deny",
  "editor.blank": "not set",
  "editor.allowText": "Allow",
  "editor.denyText": "Deny",
  "editor.blankText": "Not set",
  "editor.included": "included",
  "editor.includedVia": "Included by {action}",
  "editor.cellLabel": "{subject}, {action}: {state}",
  "editor.cellLabelIncluded": "{subject}, {action}: {state}, included by {via}",
  "editor.remove": "Remove",
  "editor.removeLabel": "Remove {subject}",
  "editor.stopInheriting": "Stop inheriting",
  "editor.stopInheritingHelp": "Ignore rules from parent categories and the all-categories rules.",
  "editor.inheritanceStopped": "Inheritance stops at this category.",
  "editor.inheritedFrom": "Inherited from {resource}",
  "editor.allCategories": "All categories",
  "editor.inheritedNote": "Read-only. Change these in their own category.",
  "editor.addSubject": "Add subject",
  "editor.kind": "Subject type",
  "editor.search": "Search",
  "editor.searchPlaceholder": "Search by name",
  "editor.searching": "Searching...",
  "editor.noResults": "No matches.",
  "editor.searchError": "Search failed. Try again.",
  "editor.confirmDenyTitle": "Confirm deny",
  "editor.confirmDenyBody":
    "Deny {action} for {subject}? A deny overrides any allow in this category.",
  "editor.confirm": "Deny",
  "editor.cancel": "Cancel",
  "editor.edit": "Edit",
  "editor.save": "Save",
  "editor.unsaved": "Unsaved changes",
  "editor.discardTitle": "Discard unsaved changes?",
  "editor.discardBody": "Your changes to {category} have not been saved.",
  "editor.discard": "Discard",
  "editor.keepEditing": "Keep editing",
  "editor.rank": "#",
  "editor.rankLabel": "Row order",
  "editor.fromCategory": "from {category}",
  "editor.moveUp": "Move {subject} up",
  "editor.moveDown": "Move {subject} down",
  "editor.dragHandle": "Reorder {subject}",
  "editor.dragPicked":
    "Picked up {subject}, position {position} of {total}. Use the arrow keys to move, Space or Enter to drop, Escape to cancel.",
  "editor.dragMoved": "{subject} moved to position {position} of {total}.",
  "editor.dragDropped": "{subject} dropped at position {position} of {total}.",
  "editor.dragCancelled": "Move cancelled. {subject} is back at position {position} of {total}.",
  "editor.legend": "Legend",
  "editor.owners": "Owners",
  "editor.ownersHelp": "Owners always have their actions and are not affected by any row.",
  "editor.noOwners": "No owners.",
  "editor.removeOwner": "Remove {subject} from owners",
  "editor.addOwner": "Add owner",
  "editor.searchOwner": "Search owners",
  "legend.allow": "Allow",
  "legend.deny": "Deny",
  "legend.own": "Own",
  "legend.blank": "Not set, skipped",
  "legend.inherited": "From a parent category",
  "legend.locked": "Locked",
};
