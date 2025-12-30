export async function onRequestPost({ request }) {
  const body = await request.text();
  return new Response(`ingest ok: ${body}`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
