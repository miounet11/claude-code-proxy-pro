#!/usr/bin/env python3
import struct
import zlib

# 创建一个简单的1024x1024 PNG图标
def create_png_icon():
    width = 1024
    height = 1024
    
    # 创建图像数据（紫色背景，白色文字）
    pixels = []
    for y in range(height):
        row = []
        for x in range(width):
            # 创建渐变背景
            r = int(99 + (139 - 99) * (x + y) / (width + height))
            g = int(102 + (92 - 102) * (x + y) / (width + height))
            b = int(241 + (246 - 241) * (x + y) / (width + height))
            
            # 在中心绘制一个简单的C形状
            cx, cy = width // 2, height // 2
            radius = 300
            inner_radius = 200
            
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            
            # 绘制C形状
            if inner_radius < dist < radius:
                angle = ((dx / dist) if dist > 0 else 0)
                if dx > -100:  # C的开口
                    r, g, b = 255, 255, 255
            
            row.extend([r, g, b, 255])  # RGBA
        pixels.extend(row)
    
    # 转换为字节
    pixels_bytes = bytes(pixels)
    
    # 创建PNG文件
    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xffffffff
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)
    
    # PNG签名
    png_data = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png_data += png_chunk(b'IHDR', ihdr_data)
    
    # IDAT chunk (压缩的图像数据)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # 过滤器类型
        raw_data += pixels_bytes[y * width * 4:(y + 1) * width * 4]
    
    compressed_data = zlib.compress(raw_data, 9)
    png_data += png_chunk(b'IDAT', compressed_data)
    
    # IEND chunk
    png_data += png_chunk(b'IEND', b'')
    
    # 写入文件
    with open('assets/icon.png', 'wb') as f:
        f.write(png_data)
    
    print("✅ PNG图标已创建")

if __name__ == '__main__':
    create_png_icon()