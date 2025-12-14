export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    
    // 验证 API Key
    if (url.searchParams.get("key") !== env.API_KEY) {
      return new Response("Forbidden", { 
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // 获取消息参数（有默认值）
    const msg = url.searchParams.get("msg") || "ESP32 message";

    // 验证必要环境变量
    if (!env.LINE_CHANNEL_TOKEN || !env.LINE_USER_ID) {
      return new Response("Server configuration error", { 
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // LINE Messaging API 请求体
    const body = {
      to: env.LINE_USER_ID,
      messages: [
        {
          type: "text",
          text: msg.substring(0, 5000) // LINE 消息限制
        }
      ]
    };

    // 发送到 LINE Messaging API
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.LINE_CHANNEL_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    // 检查 LINE API 响应
    if (!res.ok) {
      const errorData = await res.json();
      console.error('LINE API error:', errorData);
      
      return new Response(`Failed to send message: ${res.status}`, { 
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    return new Response("Message sent successfully", { 
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error) {
    console.error('Worker error:', error);
    return new Response("Internal server error", { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
