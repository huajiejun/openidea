import type { Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { sass } from "@codemirror/lang-sass";
import { languages } from "@codemirror/language-data";

export function detectLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "ts":
    case "mts":
    case "cts":
      return "typescript";
    case "tsx":
      return "typescriptreact";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascriptreact";
    case "json":
      return "json";
    case "rs":
      return "rust";
    case "py":
      return "python";
    case "html":
      return "html";
    case "css":
    case "scss":
      return "css";
    case "md":
    case "markdown":
      return "markdown";
    case "sql":
      return "sql";
    case "yaml":
    case "yml":
      return "yaml";
    case "toml":
      return "toml";
    case "vue":
      return "vue";
    default:
      return ext || "text";
  }
}

export async function getLanguageExtension(language: string, filename: string): Promise<Extension> {
  const norm = language.toLowerCase();
  if (norm === "typescript" || norm === "ts") {
    return javascript({ typescript: true });
  }
  if (norm === "typescriptreact" || norm === "tsx") {
    return javascript({ typescript: true, jsx: true });
  }
  if (norm === "javascript" || norm === "js") {
    return javascript();
  }
  if (norm === "javascriptreact" || norm === "jsx") {
    return javascript({ jsx: true });
  }
  if (norm === "html") {
    return html();
  }
  if (norm === "css" || norm === "scss") {
    return sass();
  }

  // Try finding in @codemirror/language-data
  const desc = LanguageDescription.matchFilename(languages, filename);
  if (desc) {
    try {
      const support = await desc.load();
      return support;
    } catch {
      // fallback
    }
  }

  return [];
}
