async function pushLine(env, text) {
  const payload = {
    to: env.LINE_USER_ID,
    messages: [{ type: "text", text }],
  };

  return fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function onRequestPost({ request, env }) {
  // 1) API KEY 驗證（Node proxy 轉送時要帶 X-API-Key）
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response("forbidden", { status: 403 });
  }

  // 2) 解析 JSON
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  // 3) 取出溫濕度/門檻
  const t = Number(data.t);
  const h = Number(data.h);
  const limit = Number(env.TEMP_LIMIT ?? 10);          // 你要 10 度以上
  const cooldownSec = Number(env.COOLDOWN_SEC ?? 10); // 10 秒

  if (!Number.isFinite(t)) {
    return new Response("Bad Request: t must be a number", { status: 400 });
  }

  // 4) 超溫才推播
  if (t >= limit) {
    // ---- 冷卻機制：每個 deviceId 10 分鐘只推一次 ----
    // 需要在 Pages 綁定 KV：ALERT_KV
    const deviceId = data.deviceId || "SIM7028";
    const key = `lastSent:${deviceId}`;
    const now = Math.floor(Date.now() / 1000);

    if (env.ALERT_KV) {
      const last = Number((await env.ALERT_KV.get(key)) || 0);
      if (last && now - last < cooldownSec) {
        return new Response(`OK (cooldown ${cooldownSec}s)`);
      }
    }

    const msg =
`⚠️ 溫度過高
設備：${deviceId}
溫度：${t} °C
濕度：${Number.isFinite(h) ? h : "-"} %
時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`;

    const res = await pushLine(env, msg);
    const text = await res.text();

    // 推播成功才寫入 lastSent（避免 token 壞掉卻鎖住）
    if (res.ok && env.ALERT_KV) {
      await env.ALERT_KV.put(key, String(now), { expirationTtl: 24 * 3600 });
    }

    // 回傳 LINE API 狀態，方便你排錯
    return new Response(`push status=${res.status}\n${text}`, {
      status: res.ok ? 200 : 500,
    });
  }

  return new Response("OK (no alert)");
}
