export default {
  async fetch(request, env) {
    // 只允许 POST
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Bearer Token 验证
    const EXPECTED_TOKEN = "Bearer abc123sm";

    const auth = request.headers.get("Authorization");
    if (!auth || auth !== EXPECTED_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const messages = body.messages;
    if (!Array.isArray(messages)) {
      return new Response("Missing messages", { status: 400 });
    }

    const model = body.model || "@cf/ibm-granite/granite-4.0-h-micro";

    try {
      // 调用AI模型
      const result = await env.AI.run(model, { messages });
      
      // 调试：打印返回结果
      console.log("使用模型:", model);
      console.log("AI返回结果:", JSON.stringify(result));
      
      // 根据不同的模型返回格式，提取回复内容
      let replyContent;
      
      // ========== 模型1: @cf/ibm-granite/granite-4.0-h-micro ==========
      if (model === "@cf/ibm-granite/granite-4.0-h-micro") {
        // 处理IBM Granite模型的复杂嵌套格式
        if (result.choices && result.choices.length > 0) {
          if (result.choices[0].message && result.choices[0].message.content) {
            const content = result.choices[0].message.content;
            // 如果content是字符串，直接使用
            if (typeof content === 'string') {
              replyContent = content;
            } 
            // 如果content是对象，尝试进一步提取
            else if (typeof content === 'object' && content.choices) {
              replyContent = content.choices[0]?.message?.content || JSON.stringify(content);
            }
          }
        }
        // 方法2: 如果返回的是简单response字段
        else if (result.response) {
          replyContent = result.response;
        }
        // 方法3: 其他格式，直接转换为字符串
        else {
          replyContent = typeof result === 'string' ? result : JSON.stringify(result);
        }
      }
      // ========== 模型2: @cf/meta/llama-3.2-1b-instruct ==========
      else if (model === "@cf/meta/llama-3.2-1b-instruct") {
        // 处理Llama模型的简单格式
        if (result.response) {
          replyContent = result.response;
        } 
        // 如果返回的是标准OpenAI格式
        else if (result.choices && result.choices.length > 0) {
          const message = result.choices[0].message;
          if (message && message.content) {
            replyContent = message.content;
          }
        }
        // 其他情况
        else {
          replyContent = typeof result === 'string' ? result : JSON.stringify(result);
        }
      }
      // ========== 其他模型（通用处理） ==========
      else {
        // 通用处理逻辑
        if (result.response) {
          replyContent = result.response;
        } else if (result.choices && result.choices.length > 0) {
          const message = result.choices[0].message;
          if (message && message.content) {
            replyContent = message.content;
          }
        } else {
          replyContent = typeof result === 'string' ? result : JSON.stringify(result);
        }
      }
      
      // 返回标准的OpenAI格式
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: replyContent || "AI未返回有效回复"
          }
        }]
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    } catch (error) {
      console.error("AI调用失败:", error);
      return new Response(JSON.stringify({
        error: "AI模型调用失败",
        details: error.message
      }), { status: 500 });
    }
  },
};