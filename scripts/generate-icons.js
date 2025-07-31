const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 图标生成脚本
 * 从单个源图标生成各平台所需的图标格式
 * 需要安装 ImageMagick: brew install imagemagick (macOS) 或 apt-get install imagemagick (Linux)
 */

const ICON_SIZES = {
  // macOS 图标尺寸
  mac: [16, 32, 64, 128, 256, 512, 1024],
  // Windows 图标尺寸
  win: [16, 24, 32, 48, 64, 128, 256],
  // Linux 图标尺寸
  linux: [16, 24, 32, 48, 64, 128, 256, 512]
};

async function generateIcons() {
  console.log('🎨 开始生成应用图标...\n');
  
  const sourceIcon = path.join(__dirname, '..', 'assets', 'icon.png');
  const buildDir = path.join(__dirname, '..', 'build');
  const iconsDir = path.join(buildDir, 'icons');
  
  // 检查源图标
  if (!fs.existsSync(sourceIcon)) {
    console.error('❌ 源图标不存在:', sourceIcon);
    console.log('\n请确保在 assets/icon.png 放置一个至少 1024x1024 的源图标');
    process.exit(1);
  }
  
  // 检查 ImageMagick
  try {
    execSync('convert -version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ 未安装 ImageMagick');
    console.log('\n请安装 ImageMagick:');
    console.log('  macOS: brew install imagemagick');
    console.log('  Ubuntu: sudo apt-get install imagemagick');
    console.log('  Windows: 下载并安装 https://imagemagick.org/script/download.php');
    process.exit(1);
  }
  
  // 创建目录
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
  }
  
  // 生成 PNG 图标
  console.log('📦 生成 PNG 图标...');
  const allSizes = [...new Set([...ICON_SIZES.mac, ...ICON_SIZES.win, ...ICON_SIZES.linux])];
  
  allSizes.forEach(size => {
    const outputFile = path.join(iconsDir, `${size}x${size}.png`);
    try {
      execSync(`convert "${sourceIcon}" -resize ${size}x${size} "${outputFile}"`);
      console.log(`  ✓ ${size}x${size}.png`);
    } catch (error) {
      console.error(`  ✗ ${size}x${size}.png - ${error.message}`);
    }
  });
  
  // 生成 macOS .icns
  console.log('\n🍎 生成 macOS 图标 (.icns)...');
  try {
    // 创建临时 iconset 目录
    const iconsetPath = path.join(buildDir, 'icon.iconset');
    if (!fs.existsSync(iconsetPath)) {
      fs.mkdirSync(iconsetPath);
    }
    
    // macOS 需要的特定文件名
    const macIconFiles = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' }
    ];
    
    macIconFiles.forEach(({ size, name }) => {
      const outputFile = path.join(iconsetPath, name);
      execSync(`convert "${sourceIcon}" -resize ${size}x${size} "${outputFile}"`);
    });
    
    // 生成 .icns 文件
    const icnsFile = path.join(buildDir, 'icon.icns');
    execSync(`iconutil -c icns "${iconsetPath}" -o "${icnsFile}"`);
    console.log('  ✓ icon.icns');
    
    // 清理临时文件
    execSync(`rm -rf "${iconsetPath}"`);
  } catch (error) {
    console.error('  ✗ 生成 .icns 失败:', error.message);
    console.log('  提示: macOS 上需要使用 iconutil 命令');
  }
  
  // 生成 Windows .ico
  console.log('\n🪟 生成 Windows 图标 (.ico)...');
  try {
    const icoSizes = ICON_SIZES.win.map(size => path.join(iconsDir, `${size}x${size}.png`));
    const icoFile = path.join(buildDir, 'icon.ico');
    
    // 使用 ImageMagick 生成多尺寸 ico
    const command = `convert ${icoSizes.join(' ')} "${icoFile}"`;
    execSync(command);
    console.log('  ✓ icon.ico');
  } catch (error) {
    console.error('  ✗ 生成 .ico 失败:', error.message);
  }
  
  // 复制源图标
  console.log('\n📄 复制源图标...');
  fs.copyFileSync(sourceIcon, path.join(buildDir, 'icon.png'));
  console.log('  ✓ icon.png');
  
  // 生成应用图标预览
  console.log('\n🖼️  生成图标预览...');
  try {
    const previewFile = path.join(buildDir, 'icon-preview.png');
    const previewSizes = [16, 32, 64, 128, 256];
    const montageFiles = previewSizes.map(size => path.join(iconsDir, `${size}x${size}.png`));
    
    execSync(`montage ${montageFiles.join(' ')} -geometry +5+5 -background transparent "${previewFile}"`);
    console.log('  ✓ icon-preview.png');
  } catch (error) {
    console.error('  ✗ 生成预览失败:', error.message);
  }
  
  console.log('\n✅ 图标生成完成！');
  console.log('\n📁 生成的文件:');
  console.log(`  - ${buildDir}/icon.icns (macOS)`);
  console.log(`  - ${buildDir}/icon.ico (Windows)`);
  console.log(`  - ${buildDir}/icon.png (Linux)`);
  console.log(`  - ${iconsDir}/*.png (各种尺寸)`);
}

// 运行生成器
generateIcons().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});