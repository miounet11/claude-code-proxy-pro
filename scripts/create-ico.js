const fs = require('fs');
const path = require('path');

/**
 * 创建基本的Windows ICO文件
 * 从PNG图标创建ICO格式
 */

function createBasicICO() {
  console.log('🎨 创建Windows ICO图标...');
  
  const sourcePNG = path.join(__dirname, '..', 'assets', 'icon.png');
  const targetICO = path.join(__dirname, '..', 'build', 'icon.ico');
  
  if (!fs.existsSync(sourcePNG)) {
    console.error('❌ 源PNG图标不存在:', sourcePNG);
    return false;
  }
  
  try {
    // 读取PNG文件
    const pngBuffer = fs.readFileSync(sourcePNG);
    
    // 创建一个基本的ICO头部
    // ICO格式: ICONDIR + ICONDIRENTRY + BITMAP DATA
    
    const iconDir = Buffer.alloc(6);
    iconDir.writeUInt16LE(0, 0);      // Reserved (0)
    iconDir.writeUInt16LE(1, 2);      // Type (1 = ICO)
    iconDir.writeUInt16LE(1, 4);      // Number of images
    
    const iconDirEntry = Buffer.alloc(16);
    iconDirEntry.writeUInt8(0, 0);      // Width (0 = 256)
    iconDirEntry.writeUInt8(0, 1);      // Height (0 = 256)
    iconDirEntry.writeUInt8(0, 2);      // Color count
    iconDirEntry.writeUInt8(0, 3);      // Reserved
    iconDirEntry.writeUInt16LE(1, 4);   // Color planes
    iconDirEntry.writeUInt16LE(32, 6);  // Bits per pixel
    iconDirEntry.writeUInt32LE(pngBuffer.length, 8);  // Image size
    iconDirEntry.writeUInt32LE(22, 12); // Image offset (6 + 16)
    
    // 组合ICO文件
    const icoBuffer = Buffer.concat([
      iconDir,
      iconDirEntry,
      pngBuffer
    ]);
    
    // 写入ICO文件
    fs.writeFileSync(targetICO, icoBuffer);
    console.log('✅ Windows ICO图标已创建:', targetICO);
    return true;
    
  } catch (error) {
    console.error('❌ 创建ICO文件失败:', error.message);
    return false;
  }
}

if (require.main === module) {
  createBasicICO();
}

module.exports = { createBasicICO };