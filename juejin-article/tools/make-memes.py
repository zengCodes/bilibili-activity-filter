# -*- coding: utf-8 -*-
"""
给 AI 生成的小熊表情包底图叠加大字幕，输出到 assets/。
经典表情包做法：黑体粗字 + 厚白描边，直接压在图上。
"""
import os
import glob
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "raw")
ASSETS = os.path.join(BASE, "assets")
F_B = "C:/Windows/Fonts/msyhbd.ttc"

# 时间戳后缀 -> (输出名, 上字幕, 下字幕)
JOBS = [
    ("07-55-51", "02-pain.png", "173 个活动", "眼睛：我不行了"),
    ("07-55-47", "03-match.png", "输入「影视解说」", "绿框：就是它！"),
    ("07-55-48", "04-deadline.png", "我明天再投", "明天：我不会来的"),
    ("07-55-50", "05-bug.png", "改完代码忘了重载", "我 debug 了一整天"),
]


def find(stamp):
    hits = glob.glob(os.path.join(RAW, f"*{stamp}.png"))
    if not hits:
        raise FileNotFoundError(stamp)
    return hits[0]


for stamp, out, top, bottom in JOBS:
    im = Image.open(find(stamp)).convert("RGB")
    W, H = im.size
    d = ImageDraw.Draw(im)

    # 上字幕：字号稍小
    d.text((W / 2, 82), top, font=ImageFont.truetype(F_B, 56),
           fill="#111111", anchor="mm", stroke_width=11, stroke_fill="#FFFFFF")
    # 下字幕：字号更大，压在画面下部
    d.text((W / 2, H - 78), bottom, font=ImageFont.truetype(F_B, 62),
           fill="#111111", anchor="mm", stroke_width=12, stroke_fill="#FFFFFF")

    q = im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    dst = os.path.join(ASSETS, out)
    q.save(dst, optimize=True)
    print(f"{out:18s} {W}x{H}  {os.path.getsize(dst)/1024:.0f} KB   {top} / {bottom}")
