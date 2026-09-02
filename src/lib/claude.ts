import Anthropic from "@anthropic-ai/sdk";

/** Reads ANTHROPIC_API_KEY from env. */
export const anthropic = new Anthropic();

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";

export interface StructuredOpts {
  system: string;
  user: string;
  toolName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  description?: string;
}

/**
 * Force Claude to answer via a single tool call and return the tool input,
 * cast to T. The schema is a JSON schema for an object.
 */
export async function structured<T>(opts: StructuredOpts): Promise<T> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    tools: [
      {
        name: opts.toolName,
        description:
          opts.description ?? `Return the ${opts.toolName} result as structured data.`,
        input_schema: opts.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
  });

  const block = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === opts.toolName,
  );
  if (!block) {
    throw new Error(
      `Claude returned no tool_use block for "${opts.toolName}" (stop_reason=${res.stop_reason})`,
    );
  }
  return block.input as T;
}
