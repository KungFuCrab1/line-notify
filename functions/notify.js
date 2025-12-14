export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const msg = url.searchParams.get("msg");

  if (!msg) {
    return new Response("missing msg", { status: 400 });
  }

  await fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.LINE_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `message=${encodeURIComponent(msg)}`
  });

  return new Response("ok");
}
