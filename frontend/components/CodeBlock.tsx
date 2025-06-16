"use client"

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Highlight, type Language, type PrismTheme } from 'prism-react-renderer';
import { useTheme } from 'next-themes';

// Tokyo Night Storm theme for Prism (Dark Mode)
const tokyoNightStormTheme: PrismTheme = {
  plain: {
    color: "#a9b1d6",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: {
        color: "#5f6996",
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
        color: "#9ece6a",
      },
    },
    {
      types: ["punctuation", "operator"],
      style: {
        color: "#89ddff",
      },
    },
    {
      types: ["entity", "url", "symbol", "number", "boolean", "variable", "constant", "property", "regex", "inserted"],
      style: {
        color: "#ff9e64",
      },
    },
    {
      types: ["atrule", "keyword", "attr-name", "selector"],
      style: {
        color: "#bb9af7",
        fontWeight: "bold",
      },
    },
    {
      types: ["function", "deleted", "tag"],
      style: {
        color: "#7aa2f7",
      },
    },
    {
      types: ["function-variable"],
      style: {
        color: "#7aa2f7",
      },
    },
    {
      types: ["tag", "selector", "keyword"],
      style: {
        color: "#f7768e",
      },
    },
    {
      types: ["class-name"],
      style: {
        color: "#2ac3de",
      },
    },
    {
      types: ["variable"],
      style: {
        color: "#c0caf5",
      },
    },
    {
      types: ["builtin"],
      style: {
        color: "#2ac3de",
      },
    },
    {
      types: ["char"],
      style: {
        color: "#9ece6a",
      },
    },
    {
      types: ["property-access"],
      style: {
        color: "#7dcfff",
      },
    },
    {
      types: ["maybe-class-name"],
      style: {
        color: "#2ac3de",
      },
    },
    {
      types: ["console"],
      style: {
        color: "#c0caf5",
      },
    },
    {
      types: ["imports"],
      style: {
        color: "#7dcfff",
      },
    },
    // Markdown specific
    {
      types: ["title"],
      style: {
        color: "#89ddff",
        fontWeight: "bold",
      },
    },
    {
      types: ["parameter"],
      style: {
        color: "#e0af68",
      },
    },
    {
      types: ["code"],
      style: {
        color: "#bb9af7",
      },
    },
    // JSX/TSX specific
    {
      types: ["attr-name"],
      style: {
        color: "#bb9af7",
      },
    },
    {
      types: ["script"],
      style: {
        color: "#a9b1d6",
      },
    },
  ],
};

// Tokyo Night Light theme for Prism (Light Mode)
const tokyoNightLightTheme: PrismTheme = {
  plain: {
    color: "#343b59",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: {
        color: "#888b94",
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
        color: "#385f0d",
      },
    },
    {
      types: ["punctuation", "operator"],
      style: {
        color: "#006C86",
      },
    },
    {
      types: ["entity", "url", "symbol", "number", "boolean", "variable", "constant", "property", "regex", "inserted"],
      style: {
        color: "#965027",
      },
    },
    {
      types: ["atrule", "keyword", "attr-name", "selector"],
      style: {
        color: "#65359d",
        fontWeight: "bold",
      },
    },
    {
      types: ["function", "deleted", "tag"],
      style: {
        color: "#2959aa",
      },
    },
    {
      types: ["function-variable"],
      style: {
        color: "#2959aa",
      },
    },
    {
      types: ["tag", "selector", "keyword"],
      style: {
        color: "#8c4351",
      },
    },
    {
      types: ["class-name"],
      style: {
        color: "#006c86",
      },
    },
    {
      types: ["variable"],
      style: {
        color: "#343b58",
      },
    },
    {
      types: ["builtin"],
      style: {
        color: "#006c86",
      },
    },
    {
      types: ["char"],
      style: {
        color: "#385f0d",
      },
    },
    {
      types: ["property-access"],
      style: {
        color: "#0f4b6e",
      },
    },
    {
      types: ["maybe-class-name"],
      style: {
        color: "#006c86",
      },
    },
    {
      types: ["console"],
      style: {
        color: "#343b58",
      },
    },
    {
      types: ["imports"],
      style: {
        color: "#0f4b6e",
      },
    },
    // Markdown specific
    {
      types: ["title"],
      style: {
        color: "#363c4d",
        fontWeight: "bold",
      },
    },
    {
      types: ["parameter"],
      style: {
        color: "#8f5e15",
      },
    },
    {
      types: ["code"],
      style: {
        color: "#65359d",
      },
    },
    // JSX/TSX specific
    {
      types: ["attr-name"],
      style: {
        color: "#65359d",
      },
    },
    {
      types: ["script"],
      style: {
        color: "#343b59",
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
  const { theme, systemTheme } = useTheme();

  // Determine if we're in dark mode
  const isDark = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

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
        className={
          isDark
            ? "bg-secondary text-foreground px-1.5 py-0.5 rounded text-sm font-mono border border-border"
            : "bg-secondary text-foreground px-1.5 py-0.5 rounded text-sm font-mono border border-border"
        }
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

  // Select theme based on current mode
  const selectedTheme = isDark ? tokyoNightStormTheme : tokyoNightLightTheme;

  // Dynamic styles based on theme
  const containerClass = "bg-secondary rounded-lg border border-border overflow-hidden max-w-full w-full";

  const headerClass = "flex items-center justify-between px-4 py-2 border-b border-border bg-background";

  const labelClass = "text-foreground text-sm font-medium font-mono";

  const buttonClass = "h-6 text-foreground hover:text-muted-foreground hover:bg-muted text-xs border-0";

  const preClass = "p-4 overflow-x-auto bg-secondary font-mono text-sm leading-6 max-w-full w-full";

  return (
    <div 
      className="not-prose my-4 w-full" 
      style={{ 
        maxWidth: '100%', 
        overflow: 'hidden',
        minWidth: '0',
        display: 'grid',
        gridTemplateColumns: '1fr'
      }}
    >
      <div className={`${containerClass} w-full`} style={{ maxWidth: '100%', width: '100%' }}>
        <div className={headerClass}>
          <span className={labelClass}>
            {language || 'code'}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className={buttonClass}
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
          theme={selectedTheme}
          code={codeString}
          language={language as Language}
        >
          {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${preClass} ${highlightClassName}`}
              style={{
                ...style,
                backgroundColor: 'transparent',
                fontFeatureSettings: '"calt" 0, "liga" 0',
                width: '100%',
                maxWidth: '100%',
                minWidth: '0',
                boxSizing: 'border-box',
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