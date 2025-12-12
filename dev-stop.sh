#!/bin/bash

# 醉加損友 - 開發環境停止腳本

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 專案根目錄
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}醉加損友 - 開發環境停止${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

STOPPED_COUNT=0

# 方法1: 通過 PID 檔案停止後端
if [ -f "$PID_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$PID_DIR/backend.pid")
    echo -e "${YELLOW}[1/4] 停止後端服務器 (PID: $BACKEND_PID)...${NC}"

    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID 2>/dev/null && echo -e "${GREEN}✓ 已發送停止信號${NC}" || true

        # 等待進程結束
        WAIT_COUNT=0
        while ps -p $BACKEND_PID > /dev/null 2>&1 && [ $WAIT_COUNT -lt 10 ]; do
            sleep 1
            WAIT_COUNT=$((WAIT_COUNT + 1))
        done

        # 如果還在運行，強制殺死
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            echo -e "${YELLOW}! 進程未響應，強制停止...${NC}"
            kill -9 $BACKEND_PID 2>/dev/null || true
        fi

        echo -e "${GREEN}✓ 後端服務器已停止${NC}"
        STOPPED_COUNT=$((STOPPED_COUNT + 1))
    else
        echo -e "${YELLOW}! PID $BACKEND_PID 不存在（進程可能已停止）${NC}"
    fi

    rm -f "$PID_DIR/backend.pid"
else
    echo -e "${YELLOW}[1/4] 沒有找到後端 PID 檔案${NC}"
fi
echo ""

# 停止前端服務器
if [ -f "$PID_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
    echo -e "${YELLOW}[2/4] 停止前端服務器 (PID: $FRONTEND_PID)...${NC}"

    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID 2>/dev/null && echo -e "${GREEN}✓ 已發送停止信號${NC}" || true

        # 等待進程結束
        WAIT_COUNT=0
        while ps -p $FRONTEND_PID > /dev/null 2>&1 && [ $WAIT_COUNT -lt 5 ]; do
            sleep 1
            WAIT_COUNT=$((WAIT_COUNT + 1))
        done

        # 如果還在運行，強制殺死
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            kill -9 $FRONTEND_PID 2>/dev/null || true
        fi

        echo -e "${GREEN}✓ 前端服務器已停止${NC}"
        STOPPED_COUNT=$((STOPPED_COUNT + 1))
    else
        echo -e "${YELLOW}! PID $FRONTEND_PID 不存在（進程可能已停止）${NC}"
    fi

    rm -f "$PID_DIR/frontend.pid"
else
    echo -e "${YELLOW}[2/4] 沒有找到前端 PID 檔案${NC}"
fi
echo ""

# 方法2: 通過進程名稱停止（清理遺留進程）
echo -e "${YELLOW}[3/4] 清理遺留進程...${NC}"

# 殺死所有 uvicorn main:app 進程
UVICORN_PIDS=$(pgrep -f "uvicorn main:app" 2>/dev/null || true)
if [ ! -z "$UVICORN_PIDS" ]; then
    echo -e "${YELLOW}發現 uvicorn 進程: $UVICORN_PIDS${NC}"
    pkill -9 -f "uvicorn main:app" 2>/dev/null || true
    echo -e "${GREEN}✓ 已清理 uvicorn 進程${NC}"
    STOPPED_COUNT=$((STOPPED_COUNT + 1))
else
    echo -e "${GREEN}✓ 沒有遺留的 uvicorn 進程${NC}"
fi

# 殺死所有前端服務器進程
FRONTEND_PIDS=$(pgrep -f "http.server 3000" 2>/dev/null || true)
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo -e "${YELLOW}發現前端服務器進程: $FRONTEND_PIDS${NC}"
    pkill -9 -f "http.server 3000" 2>/dev/null || true
    echo -e "${GREEN}✓ 已清理前端服務器進程${NC}"
    STOPPED_COUNT=$((STOPPED_COUNT + 1))
else
    echo -e "${GREEN}✓ 沒有遺留的前端服務器進程${NC}"
fi
echo ""

# 方法3: 檢查端口佔用
echo -e "${YELLOW}[4/4] 檢查端口佔用...${NC}"

PORT_8000_PID=$(lsof -ti:8000 2>/dev/null || true)
if [ ! -z "$PORT_8000_PID" ]; then
    echo -e "${YELLOW}端口 8000 被進程 $PORT_8000_PID 佔用，正在釋放...${NC}"
    kill -9 $PORT_8000_PID 2>/dev/null || true
    echo -e "${GREEN}✓ 端口 8000 已釋放${NC}"
    STOPPED_COUNT=$((STOPPED_COUNT + 1))
else
    echo -e "${GREEN}✓ 端口 8000 未被佔用${NC}"
fi

PORT_3000_PID=$(lsof -ti:3000 2>/dev/null || true)
if [ ! -z "$PORT_3000_PID" ]; then
    echo -e "${YELLOW}端口 3000 被進程 $PORT_3000_PID 佔用，正在釋放...${NC}"
    kill -9 $PORT_3000_PID 2>/dev/null || true
    echo -e "${GREEN}✓ 端口 3000 已釋放${NC}"
    STOPPED_COUNT=$((STOPPED_COUNT + 1))
else
    echo -e "${GREEN}✓ 端口 3000 未被佔用${NC}"
fi
echo ""

# 清理日誌（可選）
if [ "$1" == "--clean-logs" ]; then
    echo -e "${YELLOW}清理日誌檔案...${NC}"
    rm -f "$PROJECT_ROOT/backend.log" "$PROJECT_ROOT/frontend.log"
    echo -e "${GREEN}✓ 日誌已清理${NC}"
    echo ""
fi

# 總結
echo -e "${GREEN}================================${NC}"
if [ $STOPPED_COUNT -gt 0 ]; then
    echo -e "${GREEN}開發環境已停止（停止了 $STOPPED_COUNT 個進程）${NC}"
else
    echo -e "${YELLOW}沒有運行中的服務${NC}"
fi
echo -e "${GREEN}================================${NC}"
echo ""

# 顯示提示
if [ "$1" != "--quiet" ]; then
    echo -e "${BLUE}提示:${NC}"
    echo -e "  重新啟動: ${YELLOW}./dev-start.sh${NC}"
    echo -e "  清理日誌: ${YELLOW}./dev-stop.sh --clean-logs${NC}"
    echo ""
fi
