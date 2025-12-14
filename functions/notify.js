export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  // 簡單 API Key 保護
  if (url.searchParams.get("key") !== env.API_KEY) {
    return new Response("forbidden", { status: 403 });
  }

  const msg = url.searchParams.get("msg") || "ESP32 message";

  const body = {
    to: env.LINE_USER_ID,
    messages: [
      {
        type: "text",
        text: msg
      }
    ]
  };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.LINE_CHANNEL_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return new Response("ok");
}
