export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const msg = url.searchParams.get("msg") || "hello";

  if (key !== env.API_KEY) {
    return new Response("forbidden", { status: 403 });
  }

  const body = {
    to: env.LINE_USER_ID,
    messages: [{ type: "text", text: msg }]
  };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  // 回傳 LINE API 的狀態，方便你除錯
  const text = await res.text();
  if (!res.ok) {
    return new Response(`LINE push failed: ${res.status}\n${text}`, { status: 500 });
  }

  return new Response("OK");
}
