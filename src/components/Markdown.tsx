import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
  if (!content) return null;

  // Split content into code blocks and normal text blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 leading-relaxed text-slate-800 break-words text-[12px]">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // It's a code block
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : '';
          const code = match ? match[2] : part.slice(3, -3);
          return <CodeBlock key={index} code={code.trim()} language={lang} />;
        } else {
          // Regular text block
          return <TextBlock key={index} text={part} />;
        }
      })}
    </div>
  );
}

interface CodeBlockProps {
  code: string;
  language?: string;
  key?: any;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between bg-slate-950 px-4 py-2 text-xs text-slate-400 border-b border-slate-800 font-mono">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title="Скопировать"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Скопировано!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <pre className="font-mono text-[11px] text-slate-200 leading-relaxed whitespace-pre select-all">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

interface TextBlockProps {
  text: string;
  key?: any;
}

function TextBlock({ text }: TextBlockProps) {
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (key: string | number) => {
    if (!currentList) return;
    const ListTag = currentList.type;
    renderedElements.push(
      <ListTag
        key={`list-${key}`}
        className={`my-1.5 pl-4 space-y-0.5 ${currentList.type === 'ul' ? 'list-disc' : 'list-decimal'}`}
      >
        {currentList.items.map((item, idx) => (
          <li key={idx} className="text-slate-800">
            {parseInlineStyles(item)}
          </li>
        ))}
      </ListTag>
    );
    currentList = null;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Check for bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = line.substring(line.indexOf(trimmed.charAt(0)) + 2);
      if (!currentList || currentList.type !== 'ul') {
        flushList(idx);
        currentList = { type: 'ul', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      return;
    }

    // Check for ordered list (e.g. 1. 2.)
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      const itemText = orderedMatch[2];
      if (!currentList || currentList.type !== 'ol') {
        flushList(idx);
        currentList = { type: 'ol', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      return;
    }

    // If we reach a non-list line, flush any active list
    if (currentList) {
      flushList(idx);
    }

    // Check for headers
    if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h4 key={idx} className="text-[12.5px] font-bold text-slate-900 mt-3 mb-1 font-display">
          {parseInlineStyles(trimmed.slice(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h3 key={idx} className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5 font-display">
          {parseInlineStyles(trimmed.slice(3))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      renderedElements.push(
        <h2 key={idx} className="text-base font-bold text-slate-900 mt-4 mb-2 font-display border-b border-slate-100 pb-0.5">
          {parseInlineStyles(trimmed.slice(2))}
        </h2>
      );
      return;
    }

    // Check for blockquotes
    if (trimmed.startsWith('> ')) {
      renderedElements.push(
        <blockquote key={idx} className="border-l-4 border-sky-400 pl-3 py-0.5 my-1.5 bg-slate-50/70 text-slate-600 rounded-r italic text-[11px]">
          {parseInlineStyles(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // Otherwise, it's a paragraph
    if (trimmed) {
      renderedElements.push(
        <p key={idx} className="my-1.5 text-slate-800 leading-relaxed">
          {parseInlineStyles(line)}
        </p>
      );
    } else {
      // Empty line adds visual spacing
      renderedElements.push(<div key={idx} className="h-1.5" />);
    }
  });

  // Flush any final list left over at the end
  if (currentList) {
    flushList('final');
  }

  return <>{renderedElements}</>;
}

// Inline styling parser (**bold**, *italic*, `inline code`, links)
function parseInlineStyles(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match bold, italic, code, and links
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);

  return tokens.map((token, idx) => {
    // Bold
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={idx} className="font-semibold text-slate-950">{token.slice(2, -2)}</strong>;
    }
    // Italic
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={idx} className="italic text-slate-900">{token.slice(1, -1)}</em>;
    }
    // Inline Code
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={idx} className="font-mono text-xs bg-slate-100 text-slate-800 border border-slate-200/60 px-1 py-0.5 rounded">
          {token.slice(1, -1)}
        </code>
      );
    }
    // Links [text](url)
    if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const match = token.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a
            key={idx}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:text-sky-700 underline font-medium transition-colors inline-flex items-center gap-0.5"
          >
            {match[1]}
          </a>
        );
      }
    }

    // Normal text
    return token;
  });
}
