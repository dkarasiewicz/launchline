/**
 * Shared Tool UI Schema Types
 */

import { z } from "zod";

// ============================================================================
// ACTION SCHEMA
// ============================================================================

export const ActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  variant: z.enum(["default", "secondary", "destructive", "outline", "ghost"]).optional(),
  disabled: z.boolean().optional(),
});

export type Action = z.infer<typeof ActionSchema>;

export const ActionsConfigSchema = z.object({
  actions: z.array(ActionSchema),
  position: z.enum(["start", "end", "between"]).optional(),
});

export type ActionsConfig = z.infer<typeof ActionsConfigSchema>;

// ============================================================================
// PLAN SCHEMA
// ============================================================================

export const PlanTodoStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export type PlanTodoStatus = z.infer<typeof PlanTodoStatusSchema>;

export const PlanTodoSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: PlanTodoStatusSchema,
  description: z.string().optional(),
});

export type PlanTodo = z.infer<typeof PlanTodoSchema>;

export const PlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  todos: z.array(PlanTodoSchema).min(1),
});

export type Plan = z.infer<typeof PlanSchema>;

// ============================================================================
// SERIALIZABLE PLAN (for tool results)
// ============================================================================

export const SerializablePlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  todos: z.array(z.object({
    id: z.string(),
    label: z.string(),
    status: z.string(),
    description: z.string().optional(),
  })),
});

export type SerializablePlan = z.infer<typeof SerializablePlanSchema>;

/**
 * Parse a serializable plan into a Plan object
 */
export function parseSerializablePlan(data: unknown): Plan {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      throw new Error("Invalid plan data: could not parse JSON");
    }
  }
  
  const parsed = SerializablePlanSchema.parse(data);
  
  return {
    id: parsed.id,
    title: parsed.title,
    description: parsed.description,
    todos: parsed.todos.map((todo) => ({
      id: todo.id,
      label: todo.label,
      status: PlanTodoStatusSchema.parse(todo.status),
      description: todo.description,
    })),
  };
}
