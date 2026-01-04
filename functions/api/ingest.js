// functions/api/ingest.js
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
  const ts = Math.floor(Date.now() / 1000);

  // ====== 4) 寫入 D1（每筆都存，圖表用） ======
  // 需要 Pages 綁定 D1：binding name = DB
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
    // 資料庫失敗也不要影響主流程（先回應 OK + 仍可推播）
    // 但你要除錯可到 CF logs 看
    console.log("D1 insert error:", e?.message || String(e));
  }

  // ====== 5) 溫度門檻與冷卻設定 ======
  const limit = Number(env.TEMP_LIMIT ?? 18);        // 你要 18 就設 TEMP_LIMIT=18
  const cooldown = Number(env.COOLDOWN_SEC ?? 600);  // 預設 10 分鐘

  // 未超標 → 不推播
  if (!Number.isFinite(t) || t < limit) {
    return new Response("OK (no alert)", { status: 200 });
  }

  // ====== 6) 冷卻（用 KV 記錄每個 deviceId 的 lastSent） ======
  // 需要 Pages 綁定 KV：binding name = ALERT_KV
  const kv = env.ALERT_KV;
  const key = `lastSent:${deviceId}`;

  if (kv) {
    const last = Number(await kv.get(key));
    if (Number.isFinite(last) && ts - last < cooldown) {
      return new Response(`OK (cooldown ${cooldown}s)`, { status: 200 });
    }
    await kv.put(key, String(ts));
  }

  // ====== 7) 推播 LINE ======
  const token = String(env.LINE_CHANNEL_TOKEN || "").trim();
  const to = String(env.LINE_USER_ID || "").trim();

  if (!token || !to) {
    // 沒設定推播必要參數，就只存資料
    return new Response("OK (alert skipped: missing LINE env)", { status: 200 });
  }

  const msg = `⚠️ 溫度警報\nDevice: ${deviceId}\nT: ${t}°C\nH: ${Number.isFinite(h) ? h : "-"}%\nPM2.5: ${Number.isFinite(pm25) ? pm25 : "-"}\nTime: ${new Date().toLocaleString("zh-TW")}`;

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

// 如果你也想支援 GET /api/ingest（可選）：
// export async function onRequestGet() {
//   return new Response("OK", { status: 200 });
// }
