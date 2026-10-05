import { NextRequest } from "next/server";
import { FASTAPI_URL, TOKEN_COOKIE } from "@/lib/server/config";

// Live updates: the backend pushes events over a WebSocket that needs the access token as a subprotocol, and the token
// lives in an httpOnly cookie that page JavaScript cannot read. So the browser asks THIS route (same origin, cookie
// attached) for a Server-Sent Events stream, and the route holds the WebSocket to the backend on its behalf. The token
// never reaches the page, and no custom server is needed.
//
// Only what a client needs is relayed: the event's type and which row it is about. EVENTS.md calls the payload a hint
// ("treat an event as: this changed, refetch it"), so it is dropped, which also keeps it from carrying data the page
// did not ask for.
export const dynamic = "force-dynamic";

const WS_URL = `${FASTAPI_URL.replace(/^http/, "ws")}/api/v1/ws`;
const encoder = new TextEncoder();

/** Is the token still accepted? A refused WebSocket handshake looks the same whether the backend is down or the token is dead. */
async function tokenIsDead(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    return res.status === 401;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  // A body, so the response has a length: a bodiless one on a kept-alive connection never ends for the client.
  if (!token) return Response.json({ detail: "Not authenticated" }, { status: 401 });

  let socket: WebSocket | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let finished = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (finished) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          finished = true;
        }
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(heartbeat);
        try {
          socket?.close();
        } catch {
          /* already closed */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      let opened = false;
      socket = new WebSocket(WS_URL, ["bearer", token]);
      socket.onopen = () => {
        opened = true;
        // `ready` means the socket to the backend is up: the client refetches what it shows (there is no replay).
        send("retry: 3000\nevent: ready\ndata: {}\n\n");
      };
      socket.onmessage = (message) => {
        try {
          const { type, aggregate_type, aggregate_id } = JSON.parse(String(message.data)) as Record<string, unknown>;
          send(`data: ${JSON.stringify({ type, aggregate_type, aggregate_id })}\n\n`);
        } catch {
          /* not an event we understand: ignore it */
        }
      };
      socket.onerror = () => {};
      socket.onclose = async () => {
        if (!opened && (await tokenIsDead(token))) send("event: unauthorized\ndata: {}\n\n");
        finish();
      };

      // Keeps proxies from closing an idle stream.
      heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
      request.signal.addEventListener("abort", finish);
    },
    cancel() {
      finished = true;
      clearInterval(heartbeat);
      try {
        socket?.close();
      } catch {
        /* already closed */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
