#!/bin/bash

# 防火牆配置腳本 - 開放端口 3000 和 8000

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}配置防火牆規則${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 檢查是否為 root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}此腳本需要 root 權限${NC}"
    echo -e "${YELLOW}請使用: sudo ./firewall-setup.sh${NC}"
    exit 1
fi

# 檢查防火牆類型
if command -v ufw &> /dev/null; then
    echo -e "${BLUE}檢測到 UFW 防火牆${NC}"

    # 開放端口
    ufw allow 3000/tcp comment 'Cheers Frontend'
    ufw allow 8000/tcp comment 'Cheers Backend'

    echo -e "${GREEN}✓ UFW 規則已添加${NC}"
    echo ""
    ufw status

elif command -v firewall-cmd &> /dev/null; then
    echo -e "${BLUE}檢測到 firewalld 防火牆${NC}"

    # 開放端口
    firewall-cmd --permanent --add-port=3000/tcp
    firewall-cmd --permanent --add-port=8000/tcp
    firewall-cmd --reload

    echo -e "${GREEN}✓ firewalld 規則已添加${NC}"
    echo ""
    firewall-cmd --list-ports

elif command -v iptables &> /dev/null; then
    echo -e "${BLUE}檢測到 iptables 防火牆${NC}"

    # 開放端口
    iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
    iptables -A INPUT -p tcp --dport 8000 -j ACCEPT

    # 保存規則
    if command -v netfilter-persistent &> /dev/null; then
        netfilter-persistent save
    elif [ -f /etc/redhat-release ]; then
        service iptables save
    else
        iptables-save > /etc/iptables/rules.v4
    fi

    echo -e "${GREEN}✓ iptables 規則已添加${NC}"
    echo ""
    iptables -L INPUT -n | grep -E "3000|8000"

else
    echo -e "${YELLOW}⚠️  未檢測到防火牆或使用的是其他防火牆${NC}"
    echo -e "${YELLOW}請手動開放端口 3000 和 8000${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}防火牆配置完成${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}開放的端口:${NC}"
echo -e "  3000 - 前端服務器"
echo -e "  8000 - 後端 API"
echo ""
