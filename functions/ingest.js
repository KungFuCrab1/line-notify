async function pushLine(env, text) {
  const body = {
    to: env.LINE_USER_ID,
    messages: [
      { type: "text", text }
    ]
  };

  return fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.LINE_CHANNEL_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function onRequestPost({ request, env }) {
  // 用 Header 驗證（ESP32 比較安全）
  const apiKey = request.headers.get("X-API-Key");
  if (apiKey !== env.API_KEY) {
    return new Response("Forbidden", { status: 403 });
  }

  // ESP32 傳 JSON
  // { deviceId, t, h, ts }
  const data = await request.json();
  const t = Number(data.t);
  const h = Number(data.h);
  const limit = Number(env.TEMP_LIMIT || 35);

  if (Number.isNaN(t)) {
    return new Response("Bad Request", { status: 400 });
  }

  // 超溫才通知
  if (t >= limit) {
    const msg =
`⚠️ 溫度過高
設備：${data.deviceId || "ESP32"}
溫度：${t} °C
濕度：${h ?? "-"} %
時間：${data.ts || ""}`;

    await pushLine(env, msg);
  }

  return new Response("OK");
}
