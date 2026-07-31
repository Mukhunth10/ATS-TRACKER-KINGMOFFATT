import { bus } from "@/lib/events";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream for one job's live updates. AUTHENTICATED — only
 * signed-in staff, since it reveals that a pipeline is changing.
 *
 * The stream stays open and pushes a tiny "ping" whenever the in-process bus
 * reports a change to this job. The browser reacts by re-fetching (see
 * useLiveJob). A periodic keep-alive comment stops idle proxies from closing the
 * connection.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const { jobId } = await ctx.params;
  const channel = `job:${jobId}`;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (data: string) => controller.enqueue(enc.encode(data));

      send(`event: ready\ndata: ok\n\n`);

      const onChange = (ts: number) => send(`event: change\ndata: ${ts}\n\n`);
      bus.on(channel, onChange);

      // Keep-alive comment every 25s so intermediaries don't drop an idle stream.
      const keepAlive = setInterval(() => send(`: keep-alive\n\n`), 25_000);

      // Clean up when the client disconnects.
      const close = () => {
        clearInterval(keepAlive);
        bus.off(channel, onChange);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      // The request signal fires on client disconnect.
      _req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
