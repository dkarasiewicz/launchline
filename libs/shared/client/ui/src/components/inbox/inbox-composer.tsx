'use client';

import { ComposerPrimitive, AssistantIf } from '@assistant-ui/react';
import { Button } from '../ui/button';
import { Send, SquareIcon } from 'lucide-react';

/**
 * InboxComposer - Composer for inbox thread following assistant-ui patterns
 *
 * Uses the official assistant-ui structure with proper layout:
 * - Full-width container with rounded border
 * - Textarea with proper min/max height for auto-resize
 * - Action buttons in a separate row below the input
 */
export function InboxComposer() {
  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <div className="aui-composer-wrapper flex w-full flex-col rounded-2xl border border-input bg-background px-1 pt-2 outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/20">
        <ComposerPrimitive.Input
          placeholder="Ask Linea about this item..."
          className="aui-composer-input mb-1 max-h-40 min-h-14 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.Root>
  );
}

/**
 * ComposerAction - Send/Cancel button wrapper
 */
function ComposerAction() {
  return (
    <div className="aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-end">
      <AssistantIf condition={({ thread }) => !thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <Button
            type="submit"
            size="icon"
            className="aui-composer-send size-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </ComposerPrimitive.Send>
      </AssistantIf>

      <AssistantIf condition={({ thread }) => thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="aui-composer-cancel size-8 rounded-full"
            aria-label="Stop generating"
          >
            <SquareIcon className="size-3 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AssistantIf>
    </div>
  );
}
