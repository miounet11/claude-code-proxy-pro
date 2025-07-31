#!/bin/bash

# 创建一个高质量的SVG图标
cat > assets/icon.svg << 'EOF'
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="200" fill="url(#bgGradient)"/>
  <text x="512" y="512" font-family="Arial, sans-serif" font-size="500" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">C</text>
</svg>
EOF

# 使用系统工具转换SVG到PNG（如果可用）
if command -v convert &> /dev/null; then
    echo "使用 ImageMagick 转换图标..."
    convert -background none -resize 1024x1024 assets/icon.svg assets/icon.png
    echo "✅ 图标已创建"
elif command -v rsvg-convert &> /dev/null; then
    echo "使用 rsvg-convert 转换图标..."
    rsvg-convert -w 1024 -h 1024 assets/icon.svg > assets/icon.png
    echo "✅ 图标已创建"
elif command -v inkscape &> /dev/null; then
    echo "使用 Inkscape 转换图标..."
    inkscape assets/icon.svg --export-png=assets/icon.png --export-width=1024 --export-height=1024
    echo "✅ 图标已创建"
else
    echo "⚠️  未找到图像转换工具，请手动将 assets/icon.svg 转换为 PNG 格式"
fi

chmod +x scripts/create-icon-from-svg.sh