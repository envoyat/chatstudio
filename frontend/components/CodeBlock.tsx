"use client"

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Highlight, type Language, type PrismTheme } from 'prism-react-renderer';

// Custom Cursor Dark Midnight theme for Prism
const cursorDarkMidnightTheme: PrismTheme = {
  plain: {
    color: "#e6edf3",
    backgroundColor: "#0d1117",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: {
        color: "#6a9955",
        fontStyle: "italic",
      },
    },
    {
      types: ["namespace"],
      style: {
        opacity: 0.7,
      },
    },
    {
      types: ["string", "attr-value"],
      style: {
        color: "#ce9178",
      },
    },
    {
      types: ["punctuation", "operator"],
      style: {
        color: "#d4d4d4",
      },
    },
    {
      types: ["entity", "url", "symbol", "number", "boolean", "variable", "constant", "property", "regex", "inserted"],
      style: {
        color: "#b5cea8",
      },
    },
    {
      types: ["atrule", "keyword", "attr-name", "selector"],
      style: {
        color: "#569cd6",
        fontWeight: "bold",
      },
    },
    {
      types: ["function", "deleted", "tag"],
      style: {
        color: "#dcdcaa",
      },
    },
    {
      types: ["function-variable"],
      style: {
        color: "#dcdcaa",
      },
    },
    {
      types: ["tag", "selector", "keyword"],
      style: {
        color: "#569cd6",
        fontWeight: "bold",
      },
    },
    {
      types: ["class-name"],
      style: {
        color: "#4ec9b0",
      },
    },
    {
      types: ["variable"],
      style: {
        color: "#9cdcfe",
      },
    },
    {
      types: ["builtin"],
      style: {
        color: "#4ec9b0",
      },
    },
    {
      types: ["char"],
      style: {
        color: "#ce9178",
      },
    },
    {
      types: ["property-access"],
      style: {
        color: "#9cdcfe",
      },
    },
    {
      types: ["maybe-class-name"],
      style: {
        color: "#4ec9b0",
      },
    },
    {
      types: ["console"],
      style: {
        color: "#9cdcfe",
      },
    },
    {
      types: ["imports"],
      style: {
        color: "#9cdcfe",
      },
    },
    // Markdown specific
    {
      types: ["title"],
      style: {
        color: "#569cd6",
        fontWeight: "bold",
      },
    },
    {
      types: ["parameter"],
      style: {
        color: "#9cdcfe",
      },
    },
    {
      types: ["code"],
      style: {
        color: "#ce9178",
      },
    },
    // JSX/TSX specific
    {
      types: ["attr-name"],
      style: {
        color: "#9cdcfe",
      },
    },
    {
      types: ["script"],
      style: {
        color: "#e6edf3",
      },
    },
  ],
};

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function CodeBlock({
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const text = String(children).replace(/\n$/, '');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  if (inline) {
    return (
      <code
        className="bg-[#21262d] text-[#e6edf3] px-1.5 py-0.5 rounded text-sm font-mono border border-[#30363d]"
        style={{ fontFeatureSettings: '"calt" 0, "liga" 0' }}
        {...props}
      >
        {children}
      </code>
    );
  }

  // Extract language from className (e.g., "language-javascript" -> "javascript")
  const language = className?.replace('language-', '') || 'text';
  const codeString = String(children).replace(/\n$/, '');

  return (
    <div className="not-prose flex flex-col my-4">
      <div className="bg-[#0d1117] rounded-lg border border-[#21262d] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#21262d] bg-[#21262d]">
          <span className="text-[#6e7681] text-sm font-medium font-mono">
            {language || 'code'}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#30363d] text-xs border-0"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>
        
        <Highlight
          theme={cursorDarkMidnightTheme}
          code={codeString}
          language={language as Language}
        >
          {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`p-4 overflow-x-auto bg-[#0d1117] font-mono text-sm leading-6 ${highlightClassName}`}
              style={{
                ...style,
                fontFeatureSettings: '"calt" 0, "liga" 0',
              }}
              {...props}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
} 