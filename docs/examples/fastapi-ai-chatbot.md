# FastAPI + AIチャットボット

FastAPIとOllamaを使って、セルフホスティングのAIチャットボットをConoHa VPSにデプロイする手順です。

## 完成イメージ

- FastAPI製のチャットAPI が `http://<サーバーIP>` でアクセス可能
- Ollama でLLMモデルをローカル実行（APIキー不要）

## 前提条件

- ConoHa CLIがインストール・ログイン済み
- **メモリ4GB以上のサーバー**を推奨（LLM実行のため）

## 1. プロジェクト構成

```
fastapi-chatbot/
├── app/
│   └── main.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .dockerignore
```

## 2. FastAPI アプリ

`app/main.py`:

```python
from fastapi import FastAPI
from pydantic import BaseModel
import httpx

app = FastAPI()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://ollama:11434/api/generate",
            json={"model": "gemma3:4b", "prompt": req.message, "stream": False},
        )
        data = resp.json()
    return ChatResponse(reply=data["response"])

@app.get("/health")
async def health():
    return {"status": "ok"}
```

`requirements.txt`:

```
fastapi>=0.115
uvicorn>=0.34
httpx>=0.28
```

## 3. Dockerfile

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 4. docker-compose.yml

```yaml
services:
  web:
    build: .
    ports:
      - "80:8000"
    depends_on:
      - ollama
    restart: unless-stopped

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

volumes:
  ollama_data:
```

## 5. .dockerignore

```
__pycache__
*.pyc
.git
.venv
```

## 6. デプロイ

```bash
conoha app init <サーバー名> --app-name chatbot
conoha app deploy <サーバー名> --app-name chatbot
```

## 7. モデルをダウンロード

初回デプロイ後、Ollamaにモデルをダウンロードさせます:

```bash
conoha server ssh <サーバー名> --key ~/.ssh/conoha_mykey
# サーバー内で:
docker exec -it chatbot-ollama-1 ollama pull gemma3:4b
```

## 8. 動作確認

```bash
curl http://<サーバーIP>/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "こんにちは、自己紹介してください"}'
```

```json
{"reply": "こんにちは！私はAIアシスタントです。..."}
```
