#!/bin/bash

# 醉加損友 - 開發環境重啟腳本

set -e

# 顏色定義
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}醉加損友 - 開發環境重啟${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 獲取腳本目錄
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 停止服務
bash "$PROJECT_ROOT/dev-stop.sh" --quiet

# 等待一秒
sleep 1

# 啟動服務
bash "$PROJECT_ROOT/dev-start.sh"
