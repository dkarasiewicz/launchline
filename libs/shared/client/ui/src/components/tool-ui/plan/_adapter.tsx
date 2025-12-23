"use client";

/**
 * Plan Tool UI Adapter for assistant-ui
 * 
 * Provides the makeAssistantToolUI wrapper for deepagents' write_todos tool.
 * 
 * Note: We only use write_todos from deepagents - custom show_plan/update_plan_step 
 * tools have been removed as write_todos handles all plan/todo operations.
 */

import { useState, useEffect } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Plan, PlanErrorBoundary } from "./plan";

// ============================================================================
// Loading Component with Delay
// ============================================================================

function ThinkingLoader({ message, delayMs = 300 }: { message: string; delayMs?: number }) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!showLoader) return null;

  return (
    <div className="bg-card/60 text-muted-foreground w-full min-w-[400px] max-w-xl rounded-2xl border px-5 py-4 text-sm shadow-xs my-2">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span>{message}</span>
      </div>
    </div>
  );
}

// ============================================================================
// WRITE TODOS TOOL UI (deepagents built-in)
// ============================================================================

/**
 * Deepagents write_todos schema:
 * {
 *   todos: Array<{
 *     content: string,  // The todo item text
 *     status: "pending" | "in_progress" | "completed"
 *   }>
 * }
 * 
 * Note: The todos are also stored in state.todos
 */
type WriteTodosArgs = {
  todos?: Array<{
    content: string;
    status: string;
  }>;
};

export const WriteTodosToolUI = makeAssistantToolUI<WriteTodosArgs, string>({
  toolName: "write_todos",
  render: function WriteTodosUI({ args, result, status }) {
    const [showContent, setShowContent] = useState(false);

    // Only show content after delay when running
    useEffect(() => {
      if (status.type === "running") {
        setShowContent(false);
        const timer = setTimeout(() => setShowContent(true), 300);
        return () => clearTimeout(timer);
      } else {
        setShowContent(true);
      }
    }, [status.type]);

    // Handle case where todos might be undefined or empty
    const todos = args?.todos || [];
    
    // Convert deepagents format to our Plan format
    const convertTodos = (items: Array<{ content: string; status: string }>) =>
      items.map((todo, index) => ({
        id: `todo-${index}`,
        label: todo.content,
        // Map deepagents status to our Plan status (no 'cancelled' in deepagents)
        status: (todo.status === "completed" ? "completed" :
                 todo.status === "in_progress" ? "in_progress" : 
                 "pending") as "pending" | "in_progress" | "completed" | "cancelled",
      }));

    // Generate a key based on todos state for proper re-rendering
    const todosKey = todos.map(t => `${t.content}:${t.status}`).join("|");

    const isRunning = status.type === "running";

    // Show loading state when running and no todos yet (with delay)
    if (isRunning && todos.length === 0) {
      if (!showContent) {
        return <ThinkingLoader message="Creating task plan…" />;
      }
      return null;
    }

    // Show the todos being written (streaming) - only after delay
    if (isRunning && todos.length > 0) {
      if (!showContent) {
        return <ThinkingLoader message="Creating task plan…" />;
      }
      return (
        <PlanErrorBoundary key={todosKey}>
          <Plan
            id={`plan-streaming-${todosKey}`}
            title="Planning..."
            description="Creating task breakdown"
            todos={convertTodos(todos)}
            showProgress={true}
            className="min-w-[400px]"
          />
        </PlanErrorBoundary>
      );
    }

    // Show final result
    if (result) {
      try {
        const parsed = typeof result === "string" ? JSON.parse(result) : result;
        // Result might be the updated todos or a confirmation message
        if (parsed.todos) {
          const resultTodosKey = parsed.todos.map((t: { content: string; status: string }) => 
            `${t.content}:${t.status}`
          ).join("|");
          return (
            <PlanErrorBoundary key={resultTodosKey}>
              <Plan
                id={`plan-result-${resultTodosKey}`}
                title="Task Plan"
                description="Breakdown of steps to complete"
                todos={convertTodos(parsed.todos)}
                showProgress={true}
                className="min-w-[400px]"
              />
            </PlanErrorBoundary>
          );
        }
      } catch {
        // Fallback to args if result parsing fails
      }
    }

    // Fallback to args todos
    if (todos.length > 0) {
      return (
        <PlanErrorBoundary key={todosKey}>
          <Plan
            id={`plan-fallback-${todosKey}`}
            title="Task Plan"
            todos={convertTodos(todos)}
            showProgress={true}
            className="min-w-[400px]"
          />
        </PlanErrorBoundary>
      );
    }

    // No todos to show
    return null;
  },
});

// Note: UpdateTodoToolUI and UpdatePlanStepToolUI have been removed.
// DeepAgents uses write_todos for all todo operations (create, update, complete).
// The write_todos tool updates the entire todo list at once via state.todos.
