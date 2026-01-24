'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../../lib/utils';

export function ToolMarkdown({
  content,
  className,
}: {
  content?: string;
  className?: string;
}) {
  if (!content) {
    return null;
  }

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none text-foreground/90',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
