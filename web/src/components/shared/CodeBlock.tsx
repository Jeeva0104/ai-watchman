interface CodeBlockProps {
  code: unknown;
  language?: string;
  maxHeight?: string;
}

export function CodeBlock({ code, language = 'json', maxHeight = '200px' }: CodeBlockProps) {
  const formattedCode =
    typeof code === 'string' ? code : JSON.stringify(code, null, 2);

  // Simple syntax highlighting colors
  const highlightCode = (text: string): string => {
    // Escape HTML
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (language === 'json') {
      // String values (green)
      escaped = escaped.replace(
        /"([^"]+)":/g,
        '<span style="color: #00f0ff">"$1"</span>:'
      );
      // String content (green)
      escaped = escaped.replace(
        /: "([^"]*)"/g,
        ': <span style="color: #00ff88">"$1"</span>'
      );
      // Numbers (orange)
      escaped = escaped.replace(
        /: (\d+)/g,
        ': <span style="color: #ff8800">$1</span>'
      );
      // Booleans (purple)
      escaped = escaped.replace(
        /: (true|false)/g,
        ': <span style="color: #b829f7">$1</span>'
      );
      // Null (red)
      escaped = escaped.replace(
        /: (null)/g,
        ': <span style="color: #ff3366">$1</span>'
      );
    }

    return escaped;
  };

  return (
    <div className="bg-bg-primary border border-border rounded overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary border-b border-border">
        <span className="text-[10px] text-text-secondary uppercase">{language}</span>
      </div>
      <pre
        className="p-3 text-[11px] font-mono overflow-auto"
        style={{ maxHeight }}
      >
        <code
          dangerouslySetInnerHTML={{
            __html: highlightCode(formattedCode),
          }}
        />
      </pre>
    </div>
  );
}
