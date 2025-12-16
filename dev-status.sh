#!/bin/bash

# 醉加損友 - 開發環境狀態檢查腳本

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 專案根目錄
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}醉加損友 - 開發環境狀態${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 檢查後端 PID 檔案
echo -e "${BLUE}[後端服務器]${NC}"
if [ -f "$PID_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$PID_DIR/backend.pid")
    echo -e "  PID: $BACKEND_PID"

    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "  狀態: ${GREEN}運行中 ✓${NC}"
        ps -p $BACKEND_PID -o pid,%cpu,%mem,etime,cmd --no-headers | sed 's/^/  /'
    else
        echo -e "  狀態: ${RED}已停止 ✗${NC}"
    fi
else
    echo -e "  ${YELLOW}沒有找到 PID 檔案${NC}"
fi
echo ""

# 檢查前端 PID 檔案
echo -e "${BLUE}[前端服務器]${NC}"
if [ -f "$PID_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
    echo -e "  PID: $FRONTEND_PID"

    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "  狀態: ${GREEN}運行中 ✓${NC}"
        ps -p $FRONTEND_PID -o pid,%cpu,%mem,etime,cmd --no-headers | sed 's/^/  /'
    else
        echo -e "  狀態: ${RED}已停止 ✗${NC}"
    fi
else
    echo -e "  ${YELLOW}沒有找到 PID 檔案${NC}"
fi
echo ""

# 檢查端口
echo -e "${BLUE}[端口檢查]${NC}"
if lsof -i:8000 > /dev/null 2>&1; then
    echo -e "  端口 8000 (後端): ${GREEN}已佔用 ✓${NC}"
    lsof -i:8000 | tail -n +2 | head -n 2 | sed 's/^/    /'
else
    echo -e "  端口 8000 (後端): ${RED}未佔用 ✗${NC}"
fi

if lsof -i:3000 > /dev/null 2>&1; then
    echo -e "  端口 3000 (前端): ${GREEN}已佔用 ✓${NC}"
    lsof -i:3000 | tail -n +2 | head -n 2 | sed 's/^/    /'
else
    echo -e "  端口 3000 (前端): ${RED}未佔用 ✗${NC}"
fi
echo ""

# 檢查 API 健康
echo -e "${BLUE}[API 健康檢查]${NC}"
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)
    echo -e "  API: ${GREEN}正常 ✓${NC}"
    echo -e "  回應: $HEALTH_RESPONSE"
else
    echo -e "  API: ${RED}無法連接 ✗${NC}"
fi
echo ""

# 獲取本機 IP
LOCAL_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

# 顯示訪問 URL
echo -e "${BLUE}[訪問地址]${NC}"
echo -e "  本機訪問:"
echo -e "    前端: ${GREEN}http://localhost:3000${NC}"
echo -e "    後端: ${GREEN}http://localhost:8000${NC}"
echo -e "  手機訪問 (同網路):"
echo -e "    前端: ${GREEN}http://${LOCAL_IP}:3000${NC}"
echo -e "    後端: ${GREEN}http://${LOCAL_IP}:8000${NC}"
echo ""

# 檢查日誌
if [ -f "$PROJECT_ROOT/backend.log" ]; then
    echo -e "${BLUE}[後端日誌 (最後 5 行)]${NC}"
    tail -n 5 "$PROJECT_ROOT/backend.log" | sed 's/^/  /'
    echo ""
fi

if [ -f "$PROJECT_ROOT/frontend.log" ]; then
    echo -e "${BLUE}[前端日誌 (最後 5 行)]${NC}"
    tail -n 5 "$PROJECT_ROOT/frontend.log" | sed 's/^/  /'
    echo ""
fi

# 檢查所有相關進程
echo -e "${BLUE}[相關進程]${NC}"
UVICORN_PIDS=$(pgrep -f "uvicorn main:app" 2>/dev/null || true)
if [ ! -z "$UVICORN_PIDS" ]; then
    echo -e "  uvicorn 進程:"
    ps aux | grep "[u]vicorn main:app" | head -n 3 | sed 's/^/    /'
else
    echo -e "  ${YELLOW}沒有 uvicorn 進程${NC}"
fi

FRONTEND_PIDS=$(pgrep -f "http.server 3000" 2>/dev/null || true)
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo -e "  前端服務器進程:"
    ps aux | grep "[h]ttp.server 3000" | head -n 3 | sed 's/^/    /'
else
    echo -e "  ${YELLOW}沒有前端服務器進程${NC}"
fi
echo ""

echo -e "${BLUE}================================${NC}"
