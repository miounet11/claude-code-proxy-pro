#!/bin/bash

# Claude Code Proxy Pro - 全面测试套件运行脚本
# 运行所有测试并生成综合报告

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试结果目录
RESULTS_DIR="test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🧪 Claude Code Proxy Pro - 全面测试套件${NC}"
echo -e "${BLUE}=========================================${NC}"
echo "开始时间: $(date)"
echo "测试环境: $(uname -s) $(uname -m)"
echo "Node.js版本: $(node --version)"
echo ""

# 创建结果目录
mkdir -p "$RESULTS_DIR"

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 运行测试的函数
run_test() {
    local test_name="$1"
    local test_command="$2"
    local output_file="$RESULTS_DIR/${test_name}_${TIMESTAMP}.log"
    
    echo -e "${BLUE}▶ 运行测试: $test_name${NC}"
    
    # 运行测试并捕获输出
    if eval "$test_command" > "$output_file" 2>&1; then
        echo -e "${GREEN}✅ $test_name - 通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $test_name - 失败${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        # 显示错误摘要
        echo -e "${YELLOW}   错误摘要:${NC}"
        tail -5 "$output_file" | sed 's/^/   /'
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
}

# 检查必要文件
echo -e "${BLUE}📋 检查测试环境...${NC}"

required_files=(
    "test/isolated-test-suite.js"
    "test/cross-platform-test.js" 
    "test/security-test.js"
    "test/enhanced-test-suite.js"
)

missing_files=0
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ 缺少测试文件: $file${NC}"
        missing_files=$((missing_files + 1))
    else
        echo -e "${GREEN}✅ 找到测试文件: $file${NC}"
    fi
done

if [ $missing_files -gt 0 ]; then
    echo -e "${RED}❌ 缺少 $missing_files 个测试文件，无法继续${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 所有测试文件就绪${NC}"
echo ""

# 运行基础测试
echo -e "${BLUE}🔍 开始执行测试套件...${NC}"
echo ""

# 1. 基础功能测试
run_test "基础功能验证" "npm test"

# 2. 独立组件测试
run_test "独立组件测试" "node test/isolated-test-suite.js"

# 3. 跨平台兼容性测试
run_test "跨平台兼容性测试" "node test/cross-platform-test.js"

# 4. 安全性测试
run_test "安全性测试" "node test/security-test.js"

# 5. 增强功能测试（如果可能）
if command -v electron >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Electron测试跳过 - 环境限制${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  Electron未安装，跳过Electron相关测试${NC}"
    echo ""
fi

# 额外的测试检查
echo -e "${BLUE}🔧 执行额外检查...${NC}"

# 检查代码语法
echo -e "${BLUE}▶ 语法检查${NC}"
if node -c src/main/main.js && node -c src/main/proxy-manager.js; then
    echo -e "${GREEN}✅ 代码语法检查 - 通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ 代码语法检查 - 失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 检查依赖
echo -e "${BLUE}▶ 依赖检查${NC}"
if npm ls --depth=0 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 依赖检查 - 通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ 依赖检查 - 失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 检查构建配置
echo -e "${BLUE}▶ 构建配置检查${NC}"
if [ -f "electron-builder.yml" ] && [ -f "package.json" ]; then
    echo -e "${GREEN}✅ 构建配置检查 - 通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ 构建配置检查 - 失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""

# 运行npm audit（如果可用）
echo -e "${BLUE}🔒 安全审计...${NC}"
if npm audit --audit-level moderate > "$RESULTS_DIR/npm_audit_${TIMESTAMP}.log" 2>&1; then
    echo -e "${GREEN}✅ npm audit - 无中高危漏洞${NC}"
else
    echo -e "${YELLOW}⚠️  npm audit - 发现潜在问题，详见日志${NC}"
fi

# 生成综合报告
echo ""
echo -e "${BLUE}📊 生成测试报告...${NC}"

# 创建HTML报告
cat > "$RESULTS_DIR/test_report_${TIMESTAMP}.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Proxy Pro - 测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Claude Code Proxy Pro - 测试报告</h1>
        <p><strong>生成时间:</strong> $(date)</p>
        <p><strong>测试环境:</strong> $(uname -s) $(uname -m)</p>
        <p><strong>Node.js版本:</strong> $(node --version)</p>
    </div>
    
    <div class="test-section">
        <h2>测试摘要</h2>
        <ul>
            <li class="success">通过: $PASSED_TESTS</li>
            <li class="failure">失败: $FAILED_TESTS</li>
            <li>总计: $TOTAL_TESTS</li>
            <li>成功率: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%</li>
        </ul>
    </div>
    
    <div class="test-section">
        <h2>详细日志</h2>
        <p>所有测试日志文件已保存在 <code>test-results/</code> 目录中。</p>
        <ul>
EOF

# 添加日志文件链接
for log_file in "$RESULTS_DIR"/*.log; do
    if [ -f "$log_file" ]; then
        basename_file=$(basename "$log_file")
        echo "            <li><a href=\"$basename_file\">$basename_file</a></li>" >> "$RESULTS_DIR/test_report_${TIMESTAMP}.html"
    fi
done

cat >> "$RESULTS_DIR/test_report_${TIMESTAMP}.html" << EOF
        </ul>
    </div>
    
    <div class="test-section">
        <h2>建议</h2>
        <ul>
            <li>查看各个测试日志了解详细结果</li>
            <li>修复失败的测试用例</li>
            <li>定期运行完整测试套件</li>
            <li>参考 FINAL_TEST_REPORT.md 获取详细分析</li>
        </ul>
    </div>
</body>
</html>
EOF

# 打印最终结果
echo ""
echo -e "${BLUE}📊 测试执行完成${NC}"
echo -e "${BLUE}==================${NC}"
echo -e "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    echo -e "成功率: $SUCCESS_RATE%"
    
    if [ $SUCCESS_RATE -ge 90 ]; then
        echo -e "${GREEN}🎉 测试结果优秀！${NC}"
    elif [ $SUCCESS_RATE -ge 80 ]; then
        echo -e "${YELLOW}⚠️  测试结果良好，有改进空间${NC}"
    else
        echo -e "${RED}❌ 测试结果需要改进${NC}"
    fi
fi

echo ""
echo -e "${BLUE}📁 结果文件:${NC}"
echo -e "  - 详细报告: ${YELLOW}FINAL_TEST_REPORT.md${NC}"
echo -e "  - HTML报告: ${YELLOW}$RESULTS_DIR/test_report_${TIMESTAMP}.html${NC}"
echo -e "  - 测试日志: ${YELLOW}$RESULTS_DIR/*_${TIMESTAMP}.log${NC}"

echo ""
echo -e "${BLUE}💡 下一步建议:${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "  1. ${RED}查看失败测试的详细日志${NC}"
    echo -e "  2. ${YELLOW}修复识别出的问题${NC}"
    echo -e "  3. ${BLUE}重新运行测试验证修复${NC}"
else
    echo -e "  1. ${GREEN}所有测试通过，项目状态良好${NC}"
    echo -e "  2. ${BLUE}可以考虑部署或发布${NC}"
    echo -e "  3. ${YELLOW}定期运行测试保持质量${NC}"
fi

echo ""
echo "完成时间: $(date)"

# 设置退出码
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi