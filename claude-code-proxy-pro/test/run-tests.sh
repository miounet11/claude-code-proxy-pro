#!/bin/bash

# Claude Code Proxy Pro 测试运行脚本

echo "🧪 Claude Code Proxy Pro Test Runner"
echo "===================================="
echo ""

# 设置颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

# 检查npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm first.${NC}"
    exit 1
fi

# 安装测试依赖
echo "📦 Installing test dependencies..."
cd "$(dirname "$0")/.."

# 检查是否需要安装puppeteer
if ! npm list puppeteer-core &> /dev/null; then
    npm install --save-dev puppeteer-core
fi

# 运行单元测试
echo ""
echo "🔧 Running Unit Tests..."
echo "------------------------"
node test/test-suite.js
UNIT_TEST_EXIT_CODE=$?

# 等待一下
sleep 2

# 运行E2E测试（可选）
if [ "$1" == "--e2e" ] || [ "$1" == "--all" ]; then
    echo ""
    echo "🌐 Running E2E Tests..."
    echo "----------------------"
    node test/e2e-test.js
    E2E_TEST_EXIT_CODE=$?
else
    E2E_TEST_EXIT_CODE=0
    echo ""
    echo -e "${YELLOW}ℹ️  Skipping E2E tests. Use --e2e or --all to run them.${NC}"
fi

# 生成测试报告
echo ""
echo "📊 Test Summary"
echo "==============="

if [ $UNIT_TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Unit tests passed${NC}"
else
    echo -e "${RED}❌ Unit tests failed${NC}"
fi

if [ "$1" == "--e2e" ] || [ "$1" == "--all" ]; then
    if [ $E2E_TEST_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ E2E tests passed${NC}"
    else
        echo -e "${RED}❌ E2E tests failed${NC}"
    fi
fi

# 计算总体退出码
TOTAL_EXIT_CODE=$((UNIT_TEST_EXIT_CODE + E2E_TEST_EXIT_CODE))

echo ""
if [ $TOTAL_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
else
    echo -e "${RED}💔 Some tests failed. Please check the output above.${NC}"
fi

exit $TOTAL_EXIT_CODE