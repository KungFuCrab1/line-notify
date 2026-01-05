export async function onRequestPost({ request, env }) {
  // ====== 1) API Key 驗證 ======
  const apiKey = (request.headers.get("X-API-Key") || "").trim();
  const expectedKey = String(env.API_KEY || "").trim();
  if (expectedKey && apiKey !== expectedKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ====== 2) 讀取 JSON ======
  let data;
  try {
    data = await request.json();
  } catch (e) {
    return new Response("Bad JSON", { status: 400 });
  }

  // ====== 3) 解析欄位 ======
  const deviceId = String(data.deviceId || "SIM7028");
  const t = Number(data.t);
  const h = Number(data.h);
  const pm25 = data.pm25 == null ? null : Number(data.pm25);

  // UTC 秒（資料庫用，正確設計）
  const ts = Math.floor(Date.now() / 1000);

  // ====== 4) 寫入 D1（每筆都存，圖表用） ======
  try {
    if (env.DB) {
      await env.DB.prepare(
        "INSERT INTO readings (deviceId, t, h, pm25, ts) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          deviceId,
          Number.isFinite(t) ? t : null,
          Number.isFinite(h) ? h : null,
          Number.isFinite(pm25) ? pm25 : null,
          ts
        )
        .run();
    }
  } catch (e) {
    console.log("D1 insert error:", e?.message || String(e));
  }

  // ====== 5) 溫度門檻與冷卻設定 ======
  const limit = Number(env.TEMP_LIMIT ?? 18);        // 預設 18°C
  const cooldown = Number(env.COOLDOWN_SEC ?? 600); // 預設 10 分鐘

  // 未超標 → 不推播
  if (!Number.isFinite(t) || t < limit) {
    return new Response("OK (no alert)", { status: 200 });
  }

  // ====== 6) 冷卻控制（KV） ======
  const kv = env.ALERT_KV;
  const key = `lastSent:${deviceId}`;

  if (kv) {
    const last = Number(await kv.get(key));
    if (Number.isFinite(last) && ts - last < cooldown) {
      return new Response(`OK (cooldown ${cooldown}s)`, { status: 200 });
    }
    await kv.put(key, String(ts));
  }

  // ====== 7) LINE 推播 ======
  const token = String(env.LINE_CHANNEL_TOKEN || "").trim();
  const to = String(env.LINE_USER_ID || "").trim();

  if (!token || !to) {
    return new Response("OK (alert skipped: missing LINE env)", { status: 200 });
  }

  // ⭐ 台灣時間（UTC+8，關鍵修正在這）
  const timeTW = new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });

  const msg =
`⚠️ 溫度警報
Device: ${deviceId}
T: ${t}°C
H: ${Number.isFinite(h) ? h : "-"}%
PM2.5: ${Number.isFinite(pm25) ? pm25 : "-"}
Time: ${timeTW}`;

  const resp = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text: msg }],
    }),
  });

  const text = await resp.text();
  console.log("push status=", resp.status);

  if (!resp.ok) {
    return new Response(`Push failed: ${resp.status}\n${text}`, { status: 502 });
  }

  return new Response(`push status=${resp.status}\n${text}`, { status: 200 });
}

// （可選）如果你想支援 GET /api/ingest
// export async function onRequestGet() {
//   return new Response("OK", { status: 200 });
// }
