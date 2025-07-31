const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// 创建一个临时图标
function createTempIcon() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 背景
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 文字
  ctx.fillStyle = 'white';
  ctx.font = 'bold 400px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', size / 2, size / 2);

  // 保存为PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, '../assets/icon.png'), buffer);
  console.log('✅ 临时图标已创建');
}

// 如果没有canvas模块，创建一个简单的SVG并提示用户
try {
  createTempIcon();
} catch (error) {
  console.log('⚠️  无法自动创建PNG图标，将创建占位符');
  
  // 创建一个简单的占位符
  const placeholderPath = path.join(__dirname, '../assets/icon.png');
  
  // 创建一个1x1的透明PNG作为占位符
  const buffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
    0x54, 0x08, 0x5B, 0x63, 0x60, 0x00, 0x00, 0x00,
    0x02, 0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82
  ]);
  
  fs.writeFileSync(placeholderPath, buffer);
  console.log('⚠️  已创建占位符PNG，请手动替换为实际图标');
}