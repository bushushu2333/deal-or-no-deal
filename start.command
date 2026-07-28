#!/bin/bash
# 一掷千金 Deal or No Deal — 一键启动（双击运行）
cd "$(dirname "$0")"

# 已在跑就不重复起
if ! lsof -iTCP:8000 -sTCP:LISTEN -n > /dev/null 2>&1; then
  echo "启动后端 :8000 ..."
  cd backend
  nohup ../venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 > ../tools/backend.log 2>&1 &
  cd ..
else
  echo "后端已在运行"
fi

if ! lsof -iTCP:5173 -sTCP:LISTEN -n > /dev/null 2>&1; then
  echo "启动前端 :5173 ..."
  cd frontend
  nohup npm run dev > ../tools/frontend.log 2>&1 &
  cd ..
else
  echo "前端已在运行"
fi

sleep 4
echo "打开游戏页面 http://localhost:5173"
open http://localhost:5173
