export type TokenKind =
  | "plain"
  | "comment"
  | "string"
  | "keyword"
  | "number"
  | "literal"
  | "property"
  | "heading"
  | "marker";

export interface Token {
  text: string;
  kind: TokenKind;
}

export type Language = "ts" | "tsx" | "json" | "md" | "css" | "text";

const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "default",
  "const",
  "let",
  "var",
  "async",
  "await",
  "function",
  "return",
  "new",
  "type",
  "interface",
  "extends",
  "implements",
  "class",
  "if",
  "else",
  "for",
  "while",
  "try",
  "catch",
  "throw",
  "typeof",
  "as",
  "satisfies",
  "yield",
]);

const LITERALS = new Set(["true", "false", "null", "undefined", "this", "void"]);

/**
 * Deliberately small: enough structure to read a generated file at a glance,
 * with no parser dependency in the bundle. Tokens render as spans, so nothing
 * here is interpreted as markup.
 */
function tokenizeCode(source: string): Token[] {
  const pattern =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: source.slice(lastIndex, match.index), kind: "plain" });
    }

    const [text, comment, string, number, word] = match;
    if (comment) tokens.push({ text, kind: "comment" });
    else if (string) tokens.push({ text, kind: "string" });
    else if (number) tokens.push({ text, kind: "number" });
    else if (word) {
      const kind: TokenKind = KEYWORDS.has(word)
        ? "keyword"
        : LITERALS.has(word)
          ? "literal"
          : "plain";
      tokens.push({ text, kind });
    }

    lastIndex = match.index + text.length;
  }

  if (lastIndex < source.length) {
    tokens.push({ text: source.slice(lastIndex), kind: "plain" });
  }
  return tokens;
}

function tokenizeJson(source: string): Token[] {
  const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g;

  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: source.slice(lastIndex, match.index), kind: "plain" });
    }

    const [text, string, colon, number, literal] = match;
    if (string) {
      tokens.push({ text: string, kind: colon ? "property" : "string" });
      if (colon) tokens.push({ text: colon, kind: "plain" });
    } else if (number) tokens.push({ text, kind: "number" });
    else if (literal) tokens.push({ text, kind: "literal" });

    lastIndex = match.index + text.length;
  }

  if (lastIndex < source.length) {
    tokens.push({ text: source.slice(lastIndex), kind: "plain" });
  }
  return tokens;
}

function tokenizeMarkdown(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split("\n");
  let inFence = false;
  let inFrontmatter = false;

  lines.forEach((line, index) => {
    const suffix = index < lines.length - 1 ? "\n" : "";

    if (index === 0 && line.trim() === "---") {
      inFrontmatter = true;
      tokens.push({ text: line + suffix, kind: "marker" });
      return;
    }
    if (inFrontmatter) {
      tokens.push({ text: line + suffix, kind: line.trim() === "---" ? "marker" : "comment" });
      if (line.trim() === "---") inFrontmatter = false;
      return;
    }
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      tokens.push({ text: line + suffix, kind: "marker" });
      return;
    }
    if (inFence) {
      tokens.push({ text: line + suffix, kind: "string" });
      return;
    }
    if (/^#{1,6}\s/.test(line)) {
      tokens.push({ text: line + suffix, kind: "heading" });
      return;
    }
    if (/^\s*[-*+]\s/.test(line)) {
      const bullet = line.match(/^\s*[-*+]\s/)![0];
      tokens.push({ text: bullet, kind: "marker" });
      tokens.push({ text: line.slice(bullet.length) + suffix, kind: "plain" });
      return;
    }
    tokens.push({ text: line + suffix, kind: "plain" });
  });

  return tokens;
}

export function highlight(source: string, language: Language): Token[] {
  switch (language) {
    case "ts":
    case "tsx":
    case "css":
      return tokenizeCode(source);
    case "json":
      return tokenizeJson(source);
    case "md":
      return tokenizeMarkdown(source);
    default:
      return [{ text: source, kind: "plain" }];
  }
}
