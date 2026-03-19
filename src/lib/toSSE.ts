// ─── Convert buffered Anthropic response → SSE stream ────────────────────────
// RooCode/Windsurf send "stream: true" and expect SSE chunks back.
// Since upstream doesn't support streaming, we fake it by converting
// the buffered response into proper SSE events.

export function toSSE(data: unknown): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      try {
        const msg = data as Record<string, unknown>;

        // event: message_start
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

        // event: content_block_start
        controller.enqueue(encoder.encode(
          `event: content_block_start\ndata: ${JSON.stringify({
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          })}\n\n`
        ));

        // event: ping
        controller.enqueue(encoder.encode(
          `event: ping\ndata: ${JSON.stringify({ type: "ping" })}\n\n`
        ));

        // Extract text from content array
        const content = msg.content as Array<{ type: string; text?: string }> ?? [];
        const text = content.find((b) => b.type === "text")?.text ?? "";

        // event: content_block_delta (full text in one chunk)
        controller.enqueue(encoder.encode(
          `event: content_block_delta\ndata: ${JSON.stringify({
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text },
          })}\n\n`
        ));

        // event: content_block_stop
        controller.enqueue(encoder.encode(
          `event: content_block_stop\ndata: ${JSON.stringify({
            type: "content_block_stop",
            index: 0,
          })}\n\n`
        ));

        // event: message_delta
        controller.enqueue(encoder.encode(
          `event: message_delta\ndata: ${JSON.stringify({
            type: "message_delta",
            delta: {
              stop_reason: msg.stop_reason ?? "end_turn",
              stop_sequence: msg.stop_sequence ?? null,
            },
            usage: { output_tokens: (msg.usage as Record<string, unknown>)?.output_tokens ?? 0 },
          })}\n\n`
        ));

        // event: message_stop
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
