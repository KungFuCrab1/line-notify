export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 200), 1000);
  const deviceId = url.searchParams.get("deviceId");

  let stmt;
  if (deviceId) {
    stmt = env.DB.prepare(
      "SELECT deviceId, t, h, pm25, ts FROM readings WHERE deviceId=? ORDER BY ts DESC LIMIT ?"
    ).bind(deviceId, limit);
  } else {
    stmt = env.DB.prepare(
      "SELECT deviceId, t, h, pm25, ts FROM readings ORDER BY ts DESC LIMIT ?"
    ).bind(limit);
  }

  const { results } = await stmt.all();
  results.reverse(); // 時間正序，前端畫圖更直覺

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
