"use client";

import { useMemo } from "react";
import type { GeneratedFile } from "@/lib/generate";
import { highlight, type Language } from "@/lib/highlight";
import { CopyButton } from "./ui";

const LANGUAGE_TAG: Record<string, string> = {
  ts: "TS",
  tsx: "TSX",
  md: "MD",
  json: "{}",
  css: "CSS",
  text: "•",
};

function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "root" : path.slice(0, index);
}

function basenameOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function Files({
  files,
  selected,
  onSelect,
}: {
  files: GeneratedFile[];
  selected: string;
  onSelect: (path: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, GeneratedFile[]>();
    for (const file of files) {
      const directory = directoryOf(file.path);
      const bucket = map.get(directory);
      if (bucket) bucket.push(file);
      else map.set(directory, [file]);
    }
    // Project root first, then agent/ and its subdirectories, then the rest.
    return [...map.entries()].sort(([a], [b]) => {
      const rank = (value: string) =>
        value === "root" ? 0 : value.startsWith("agent") ? 1 : 2;
      return rank(a) - rank(b) || a.localeCompare(b);
    });
  }, [files]);

  const active = files.find((file) => file.path === selected) ?? files[0];

  return (
    <div className="files">
      <nav className="filetree" aria-label="Generated files">
        {groups.map(([directory, entries]) => (
          <div key={directory}>
            <div className="filetree-group">{directory}</div>
            {entries.map((file) => (
              <button
                type="button"
                key={file.path}
                className="filetree-item"
                data-active={file.path === active?.path}
                onClick={() => onSelect(file.path)}
                title={file.path}
              >
                <span className="file-icon" data-lang={file.language} aria-hidden="true">
                  {LANGUAGE_TAG[file.language] ?? "•"}
                </span>
                <span className="filetree-name">{basenameOf(file.path)}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="viewer">
        {active ? (
          <>
            <div className="viewer-head">
              <span className="viewer-path">
                {directoryOf(active.path) === "root" ? null : (
                  <>{directoryOf(active.path)}/</>
                )}
                <b>{basenameOf(active.path)}</b>
              </span>
              <span style={{ flex: 1 }} />
              <CopyButton value={active.content} label="Copy file" />
            </div>
            <Code source={active.content} language={active.language as Language} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function Code({ source, language }: { source: string; language: Language }) {
  const tokens = useMemo(() => highlight(source, language), [source, language]);
  return (
    <pre className="code">
      <code>
        {tokens.map((token, index) =>
          token.kind === "plain" ? (
            token.text
          ) : (
            <span key={index} className={`tok-${token.kind}`}>
              {token.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
