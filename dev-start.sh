#!/bin/bash

# 醉加損友 - 開發環境啟動腳本

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 專案根目錄
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
PID_DIR="$PROJECT_ROOT/.pids"

# 創建 PID 目錄
mkdir -p "$PID_DIR"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}醉加損友 - 開發環境啟動${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 停止舊進程
echo -e "${YELLOW}[1/5] 檢查並停止舊進程...${NC}"

# 殺死所有相關的 uvicorn 進程
pkill -f "uvicorn app.main:app" 2>/dev/null && echo -e "${GREEN}✓ 已停止舊的 uvicorn 進程${NC}" || echo -e "${YELLOW}! 沒有運行中的 uvicorn 進程${NC}"

# 殺死舊的前端服務器
pkill -f "http.server 3000" 2>/dev/null && echo -e "${GREEN}✓ 已停止舊的前端服務器${NC}" || echo -e "${YELLOW}! 沒有運行中的前端服務器${NC}"

# 清理舊的 PID 檔案
rm -f "$PID_DIR/backend.pid" "$PID_DIR/frontend.pid"
echo ""

# 檢查 uv 是否安裝
echo -e "${YELLOW}[2/5] 檢查依賴...${NC}"
if ! command -v /home/tingyu/.local/bin/uv &> /dev/null; then
    echo -e "${RED}✗ uv 未安裝！${NC}"
    echo -e "${YELLOW}請執行: curl -LsSf https://astral.sh/uv/install.sh | sh${NC}"
    exit 1
fi
echo -e "${GREEN}✓ uv 已安裝${NC}"

# 檢查虛擬環境
if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo -e "${YELLOW}! 虛擬環境不存在，正在創建...${NC}"
    cd "$BACKEND_DIR"
    /home/tingyu/.local/bin/uv sync
    echo -e "${GREEN}✓ 虛擬環境已創建${NC}"
else
    echo -e "${GREEN}✓ 虛擬環境已存在${NC}"
fi
echo ""

# 啟動後端服務器
echo -e "${YELLOW}[3/5] 啟動後端服務器...${NC}"
cd "$BACKEND_DIR"

# 使用 nohup 在背景執行
nohup /home/tingyu/.local/bin/uv run uvicorn app.main:app \
    --reload \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info \
    > "$PROJECT_ROOT/backend.log" 2>&1 &

BACKEND_PID=$!
echo $BACKEND_PID > "$PID_DIR/backend.pid"

# 等待服務器啟動
echo -e "${BLUE}等待服務器啟動...${NC}"
sleep 3

# 檢查進程是否還在運行
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✓ 後端服務器啟動成功 (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}✗ 後端服務器啟動失敗！${NC}"
    echo -e "${YELLOW}請查看日誌: $PROJECT_ROOT/backend.log${NC}"
    exit 1
fi
echo ""

# 啟動前端服務器
echo -e "${YELLOW}[4/5] 啟動前端服務器...${NC}"
cd "$PROJECT_ROOT/frontend"

# 使用 Python http.server 提供靜態文件服務
nohup python3 -m http.server 3000 \
    --bind 0.0.0.0 \
    > "$PROJECT_ROOT/frontend.log" 2>&1 &

FRONTEND_PID=$!
echo $FRONTEND_PID > "$PID_DIR/frontend.pid"

# 等待前端服務器啟動
sleep 2

# 檢查進程是否還在運行
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ 前端服務器啟動成功 (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}✗ 前端服務器啟動失敗！${NC}"
    echo -e "${YELLOW}請查看日誌: $PROJECT_ROOT/frontend.log${NC}"
    # 繼續執行，因為前端失敗不應該阻止後端
fi
echo ""

# 健康檢查
echo -e "${YELLOW}[5/5] 健康檢查...${NC}"
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API 健康檢查通過${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo -e "${YELLOW}! 重試中 ($RETRY_COUNT/$MAX_RETRIES)...${NC}"
            sleep 2
        else
            echo -e "${RED}✗ API 健康檢查失敗！${NC}"
            echo -e "${YELLOW}請查看日誌: $PROJECT_ROOT/backend.log${NC}"
            exit 1
        fi
    fi
done
echo ""

# 獲取本機 IP
LOCAL_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

# 顯示資訊
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}開發環境啟動完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}服務資訊:${NC}"
echo -e "  後端 API: ${GREEN}http://localhost:8000${NC}"
echo -e "  API 文件: ${GREEN}http://localhost:8000/docs${NC}"
echo -e "  前端頁面: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}手機訪問（同網路下）:${NC}"
echo -e "  前端: ${GREEN}http://${LOCAL_IP}:3000${NC}"
echo -e "  後端: ${GREEN}http://${LOCAL_IP}:8000${NC}"
echo ""
echo -e "${YELLOW}⚠️  請確保防火牆允許端口 3000 和 8000${NC}"
echo ""
echo -e "${BLUE}管理指令:${NC}"
echo -e "  查看後端日誌: ${YELLOW}tail -f $PROJECT_ROOT/backend.log${NC}"
echo -e "  查看前端日誌: ${YELLOW}tail -f $PROJECT_ROOT/frontend.log${NC}"
echo -e "  停止服務: ${YELLOW}./dev-stop.sh${NC}"
echo -e "  重啟服務: ${YELLOW}./dev-restart.sh${NC}"
echo -e "  查看狀態: ${YELLOW}./dev-status.sh${NC}"
echo ""
echo -e "${BLUE}PID 檔案:${NC}"
echo -e "  後端: $PID_DIR/backend.pid"
echo -e "  前端: $PID_DIR/frontend.pid"
echo ""
