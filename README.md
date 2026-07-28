# Deal or No Deal

一个基于美国综艺《Deal or No Deal》的网页游戏，GLM-5.2 扮演"资本家"（Banker）实时报价，系统记录每局盈亏。

## 技术栈

- 前端：React + Vite + Tailwind CSS
- 后端：Python FastAPI
- 数据库：SQLite + SQLAlchemy
- AI Banker：GLM-5.2 via 天翼云 `https://aigw.telecomjs.com/v1/chat/completions`

## 快速启动

### 1. 后端

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，填入你的 GLM_API_KEY
uvicorn main:app --reload --port 8000
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

然后打开 http://localhost:5173 即可游玩。

## 游戏玩法

1. 点击"开始新游戏"，系统随机分配你一个箱子
2. 按轮次打开其他箱子
3. 每轮开完后，GLM-5.2 资本家会给出报价
4. 选择 Deal（成交）拿走报价，或 No Deal（继续）博到底
5. 系统记录每局的最终金额和盈亏

## API 文档

后端启动后访问 http://localhost:8000/docs 查看 Swagger 文档。

## 环境变量

| 变量 | 说明 |
|------|------|
| `GLM_API_KEY` | 天翼云 API Key（**必需**，见 `backend/.env.example`） |
| `GLM_BASE_URL` | 默认 `https://aigw.telecomjs.com/v1` |
| `GLM_MODEL` | 默认 `glm-5.2` |
> 🔑 **安全**：真实密钥只放在本地 `backend/.env`（已被 `.gitignore` 忽略），仓库只提交脱敏的 `.env.example`。请勿把任何 API Key 写进源码或提交。

## 素材

舞台背景与主持人立绘已预生成于 `frontend/public/assets/`，无需额外下载即可游玩。

## 项目结构

```
deal-or-no-deal/
├── backend/
│   ├── main.py           # FastAPI 入口
│   ├── models.py         # SQLAlchemy 数据模型
│   ├── database.py       # 数据库连接
│   ├── game_logic.py     # 游戏核心逻辑
│   ├── glm_banker.py     # GLM-5.2 Banker 报价
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── CaseGrid.jsx
│   │   │   ├── BankerOffer.jsx
│   │   │   └── GameHistory.jsx
│   │   └── main.jsx
│   └── package.json
└── README.md
```
