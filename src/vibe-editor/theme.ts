import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const vibeDarkTheme = EditorView.theme(
  {
    "&": {
      color: "#bcbec4",
      backgroundColor: "#1e1f22",
      fontFamily: "'JetBrains Mono', Consolas, Menlo, Monaco, monospace",
      fontSize: "13px",
      lineHeight: "1.5",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "#3871e1",
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeft: "2px solid #3871e1",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "#2a4371 !important",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    ".cm-gutters": {
      backgroundColor: "#1e1f22",
      color: "#5f6269",
      borderRight: "1px solid #2b2d30",
      paddingRight: "6px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      color: "#dfe1e5",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 12px",
      minWidth: "24px",
      textAlign: "right",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "#2b2d30",
      border: "1px solid #3c3f41",
      color: "#8c8f95",
      borderRadius: "2px",
      padding: "0 4px",
      margin: "0 2px",
    },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
      backgroundColor: "#3b514d",
      outline: "1px solid #437163",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit",
    },
  },
  { dark: true },
);

export const vibeDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#cf8e6d", fontWeight: "bold" },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: "#bcbec4" },
  { tag: [t.function(t.variableName), t.labelName], color: "#56a8f5" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#cf8e6d" },
  { tag: [t.definition(t.name), t.separator], color: "#bcbec4" },
  { tag: [t.typeName, t.className, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: "#c77dbb" },
  { tag: [t.number], color: "#2aacb8" },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#a9b7c6" },
  { tag: [t.meta, t.comment], color: "#7a7e85", fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#71a1fe", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#56a8f5" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#cf8e6d" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#6aab73" },
  { tag: t.invalid, color: "#f57e84" },
]);

export const vibeDarkSyntax = syntaxHighlighting(vibeDarkHighlightStyle);
