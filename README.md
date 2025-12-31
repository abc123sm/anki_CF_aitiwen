# Anki 插件：CF worker AI提问

这是一个Anki插件，允许您在卡片复习时一键调用AI（通过Cloudflare Workers或其他API）并将结果自动填入指定字段（需要配合1020366288插件）。

## 调用方式
卡片模板中添加按钮  
例 `<div style='font-size: 40px'><button onclick="pycmd('CF_aiGenerate')" style="padding: 10px 1px; background: #3d8b40;color:#3d4b40; font-size: 14px;float: right">——</button>`

## 功能特性

- **一键调用**：在卡片模板中添加一个按钮，即可快速向AI提问。
- **高度可配置**：支持自定义 API Key、模型、系统提示词、上下文对话等。
- **智能上下文**：支持配置多轮对话作为上下文，让AI的回答更符合你的期望。
- **无缝体验**：优化了与 `Edit Field During Review` 插件的兼容性，更新解析后无需刷新卡片。
- **自动创建配置**：首次使用时会自动生成配置文件，简化初始设置。

## 安装与配置
1.  **安装插件与依赖插件**：
    *   通过 [AnkiWeb](https://ankiweb.net/shared/info/还没发) 页面下载，或使用代码 `[还没发]` 安装。
    *   或通过 [Github releases](https://github.com/abc123sm/anki_CF_aitiwen/releases) 页面下载，并解压至anki插件目录。
    *   通过 [AnkiWeb](https://ankiweb.net/shared/info/1020366288) 页面下载，或使用代码 `[1020366288]` 安装依赖插件Edit Field During Review。

2.  **获取 API Key**：
    *   参考下方的 **CF AI worker部署说明** 部署一个自己的CF AI worker
    *   访问 [qwen-free-api](https://github.com/LLM-Red-Team/qwen-free-api)部署反代API。
    *   PS. 其他反代AI大概也行，不过该项目被投毒了，需要自己删除有毒的代码构建


3.  **配置插件**：
    *   在 Anki 主界面，点击菜单栏的 **工具 > AI提问配置**。
    *   将你获取的 Authorization 填入 `Authorization` ，如  `Bearer abc123sm` 。
    *   根据你的卡片模板，设置 `提问字段` (例如：`Expression`) 和 `回答字段` (例如：`Edit`)。
    *   （可选）根据你的需求修改系统提示词和其他参数。
    *   点击 "保存"。

4.  **在卡片模板中添加按钮**：
    *   这是**必须**的步骤！你需要手动在你的卡片模板中添加一个按钮来触发AI。
    *   打开 Anki 的 **工具 > 管理笔记类型**，选择你使用的笔记类型，然后点击 **卡片...**。
    *   在“正面模板”或“背面模板”的 HTML 代码中，找到一个合适的位置，粘贴以下代码：
	
    ```html
    <button onclick="pycmd('CF_aiGenerate')" style="padding: 10px 1px; background: #3d8b40; font-size: 14px;">AI提问</button>
    ```

## CF AI worker部署说明
0. 有一个CF账号，并且有域名，绑定信用卡等前置操作
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 创建新的Worker，如 `anki-ai-proxy`
3. 将 `CF worker示例.js`的内容粘贴进去
4. 修改第9行的Bearer Token（改成你自己的）
5. 保存并部署
6. 测试可用性（可选）
	网址改成你的，token改成你的
```
curl -X POST "https://anki-ai-proxy.abc123sm.workers.dev" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer abc123sm" \
  -d '{
    "messages": [{"role": "user", "content": "こんにちは"}],
    "model": "@cf/ibm-granite/granite-4.0-h-micro"
  }'
```


## 部署示例.js
```js
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
```

## **示例模板**
### 正面模板
```html
{{Audio}}
<div>{{Snapshot}}</div>
<div>{{am-highlighted}}</div>

<script>
function copyReading(button) {
  // 从按钮的anniu属性获取特定字段的内容
  const readingText = button.getAttribute('data-copy-anniu');
  
  // 创建临时textarea元素
  const textarea = document.createElement('textarea');
  textarea.value = readingText;
  document.body.appendChild(textarea);
  
  // copy
  textarea.select();
  document.execCommand('copy');
  
  // delete
  document.body.removeChild(textarea);
  
  // update
  const originalText = button.textContent;
  button.textContent = '搞掂';
  button.classList.add('copied');
}
</script>
```
### 背面模板
```html
<button class="copy-btn" onclick="copyReading(this)" data-copy-anniu="{{Expression}}">复制</button>
<div>{{am-highlighted}}</div>
<div>{{Snapshot}}</div>
<button onclick="pycmd('aiGenerate')" style="padding: 10px 1px; background: #3d8b40;color:#3d8b40; font-size: 14px;float: right">——</button><div style='font-size: 40px'><button onclick="pycmd('CF_aiGenerate')" style="padding: 10px 1px; background: #3d8b40;color:#3d4b40; font-size: 14px;float: right">——</button>{{edit:Meaning}}</div>

<div style='font-size: 25px; text-align:start'>{{edit:Edit}}</div>

```
### CSS样式
```css
.card {
  font-family: arial;
  font-size: 50px;
  text-align: center;
  color: #CDC8B1;
  background-color: #25390c;##f1e5c9;
}
.card.nightMode {
  font-family: arial;
  font-size: 50px;
  text-align: center;
  color: #8B8878;
  #background-color: #25390c;
}

.expression{
  font-size: 40px;
}
[morph-status=unknown] { color: red; }
[morph-status=learning] { color: #1E90FF; }
[morph-status=known] { color: green; }


.copy-btn {
  padding: 10px 1px;
  background-color: #3d8b40;
  font-size: 18px;     /* 可用 !important增大字体 */
  float: left;
}

.copy-btn.copied {
  background-color: #666;
}

```


## 效果预览
<img alt="效果预览" src="https://github.com/abc123sm/anki_CF_aitiwen/raw/main/pic/1.png" />

因为使用的字段不同，所以可以与[AI提问](https://github.com/abc123sm/anki_aitiwen)共存（一个是 CF_aiGenerate，一个是 aiGenerate）
<img alt="共存" src="https://github.com/abc123sm/anki_CF_aitiwen/raw/main/pic/3.png" />

## 插件设置参考
### CF AI worker
<img alt="CF AI worker" src="https://github.com/abc123sm/anki_CF_aitiwen/raw/main/pic/4.png" />

### 反代API
<img alt="反代API" src="https://github.com/abc123sm/anki_CF_aitiwen/raw/main/pic/2.png" />

## 模型
### CF 模型价格
每天有免费0.11美元额度，反正对我来说是够够的  
1. worker AI model页面
2. [CF的文档](https://developers.cloudflare.com/workers-ai/platform/pricing/)

### 模型个人使用体验
#### 便宜
`@cf/ibm-granite/granite-4.0-h-micro`
最便宜，但有些时候给英文 $0.017

`@cf/meta/llama-3.2-1b-instruct`
也挺便宜，但有些时候给英文，幻觉还多 $0.027

`@cf/meta/llama-3.2-3b-instruct`
我目前感觉很不错的，推荐 $0.051

`@cf/meta/llama-3.1-8b-instruct-fast`
`@cf/meta/llama-3.1-8b-instruct-fp8-fast`
8b还会天天爆英文…… $0.045

`@cf/meta/llama-2-7b-chat-fp16`
不是，怎么meta的这么喜欢爆英文 $0.56 per M input tokens

`@cf/qwen/qwen3-30b-a3b-fp8`
喜欢给一堆文法解释，我是文法无用主义者，而且我prompt明明有**避免使用语法术语**这句话，他却无视了 $0.051

#### 推荐
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`
挺好用 $0.293

`@cf/google/gemma-3-12b-it`
挺好用 $0.345



#### 千万不要用  
速度好慢，结果乱给，不要用推理模型  
`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`  
`@cf/mistral/mistral-7b-instruct-v0.1`


## 问题反馈

如果你遇到任何问题或有功能建议，欢迎到本项目的 [GitHub Issues](https://github.com/abc123sm/anki_CF_aitiwen/issues) 页面提交。  
或者 [这个TG频道](https://t.me/Subs2srs/178)。

## 更新

