# -*- coding: utf-8 -*-
"""
就地给已有的表情包换字幕：先按行采样左右边缘的背景色并线性插值抹掉旧字幕，再写新字幕。
（原始未加字幕的底图已删除，所以只能原地重刷。）
"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(BASE, "assets", "05-bug.png")
F_B = "C:/Windows/Fonts/msyhbd.ttc"

TOP_BAND = (20, 148)        # 要抹掉的纵向区间
BOTTOM_BAND = (886, 1024)
NEW_TOP = "工具栏没出来"
NEW_BOTTOM = "报错也没有"

im = Image.open(PATH).convert("RGB")
W, H = im.size
px = im.load()


def make_patch(y0, y1):
    """逐行生成背景补丁：左右边缘取均值，中间线性插值，保住原有的横向渐变"""
    for y in range(y0, y1):
        left = [px[x, y] for x in range(2, 32)]
        right = [px[x, y] for x in range(W - 32, W - 2)]
        lr = tuple(sum(c[i] for c in left) / len(left) for i in range(3))
        rr = tuple(sum(c[i] for c in right) / len(right) for i in range(3))
        for x in range(W):
            t = x / (W - 1)
            px[x, y] = tuple(int(lr[i] + (rr[i] - lr[i]) * t) for i in range(3))


make_patch(*TOP_BAND)
make_patch(*BOTTOM_BAND)

d = ImageDraw.Draw(im)
d.text((W / 2, 84), NEW_TOP, font=ImageFont.truetype(F_B, 56),
       fill="#111111", anchor="mm", stroke_width=11, stroke_fill="#FFFFFF")
d.text((W / 2, 955), NEW_BOTTOM, font=ImageFont.truetype(F_B, 62),
       fill="#111111", anchor="mm", stroke_width=12, stroke_fill="#FFFFFF")

q = im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
q.save(PATH, optimize=True)
print(f"重刷完成 {os.path.basename(PATH)}  {W}x{H}  {os.path.getsize(PATH)/1024:.0f} KB")
print(f"新字幕：{NEW_TOP} / {NEW_BOTTOM}")
