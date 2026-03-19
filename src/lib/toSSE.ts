// ─── Convert buffered Anthropic response → SSE stream ────────────────────────
// RooCode/Windsurf send "stream: true" and expect SSE chunks back.
// Since upstream doesn't support streaming, we fake it by converting
// the buffered response into proper SSE events.
//
// Supports both text and tool_use content blocks.

export function toSSE(data: unknown): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      try {
        const msg = data as Record<string, unknown>;
        const content = (msg.content as Array<Record<string, unknown>>) ?? [];
        const stopReason = (msg.stop_reason as string) ?? "end_turn";

        // ── event: message_start ─────────────────────────────────────────────
        controller.enqueue(encoder.encode(
          `event: message_start\ndata: ${JSON.stringify({
            type: "message_start",
            message: {
              id: msg.id,
              type: "message",
              role: "assistant",
              content: [],
              model: msg.model,
              stop_reason: null,
              stop_sequence: null,
              usage: (msg.usage as Record<string, unknown>) ?? {},
            },
          })}\n\n`
        ));

        // ── event: ping ──────────────────────────────────────────────────────
        controller.enqueue(encoder.encode(
          `event: ping\ndata: ${JSON.stringify({ type: "ping" })}\n\n`
        ));

        // ── Emit each content block ──────────────────────────────────────────
        content.forEach((block, index) => {
          const blockType = block.type as string;

          if (blockType === "text") {
            // text block → text_delta
            controller.enqueue(encoder.encode(
              `event: content_block_start\ndata: ${JSON.stringify({
                type: "content_block_start",
                index,
                content_block: { type: "text", text: "" },
              })}\n\n`
            ));

            controller.enqueue(encoder.encode(
              `event: content_block_delta\ndata: ${JSON.stringify({
                type: "content_block_delta",
                index,
                delta: { type: "text_delta", text: block.text ?? "" },
              })}\n\n`
            ));

            controller.enqueue(encoder.encode(
              `event: content_block_stop\ndata: ${JSON.stringify({
                type: "content_block_stop",
                index,
              })}\n\n`
            ));

          } else if (blockType === "tool_use") {
            // tool_use block → input_json_delta
            controller.enqueue(encoder.encode(
              `event: content_block_start\ndata: ${JSON.stringify({
                type: "content_block_start",
                index,
                content_block: {
                  type: "tool_use",
                  id: block.id,
                  name: block.name,
                  input: {},
                },
              })}\n\n`
            ));

            // Send the entire input as a single JSON delta
            controller.enqueue(encoder.encode(
              `event: content_block_delta\ndata: ${JSON.stringify({
                type: "content_block_delta",
                index,
                delta: {
                  type: "input_json_delta",
                  partial_json: JSON.stringify(block.input ?? {}),
                },
              })}\n\n`
            ));

            controller.enqueue(encoder.encode(
              `event: content_block_stop\ndata: ${JSON.stringify({
                type: "content_block_stop",
                index,
              })}\n\n`
            ));
          }
          // Ignore unknown block types
        });

        // ── event: message_delta ─────────────────────────────────────────────
        controller.enqueue(encoder.encode(
          `event: message_delta\ndata: ${JSON.stringify({
            type: "message_delta",
            delta: {
              stop_reason: stopReason,
              stop_sequence: msg.stop_sequence ?? null,
            },
            usage: { output_tokens: (msg.usage as Record<string, unknown>)?.output_tokens ?? 0 },
          })}\n\n`
        ));

        // ── event: message_stop ──────────────────────────────────────────────
        controller.enqueue(encoder.encode(
          `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`
        ));

        // SSE end signal
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      } catch (err) {
        console.error("[toSSE] failed to convert response:", err);
      } finally {
        controller.close();
      }
    },
  });
}
