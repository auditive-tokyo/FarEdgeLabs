"""Fetch a Noto Sans JP subset covering the characters the OG card needs.

Kana and Japanese punctuation are included wholesale, not just the glyphs in use:
they are cheap, and they are what changes when copy is reworded. New *kanji* will
still need this re-run — the coverage guard in the brand script is what catches
that.
"""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path("src/app/fonts")
WEIGHTS = {300: "NotoSansJP-Light.subset.ttf", 400: "NotoSansJP-Regular.subset.ttf"}


def wanted_chars() -> str:
    with open("src/locales/ja.json", encoding="utf-8") as f:
        ja = json.load(f)
    hero, brand = ja["hero"], ja["brand"]
    drawn = "".join(
        [
            brand["name"],
            brand["nameAccent"],
            hero["headline"],
            hero["headlineAccent"],
            hero["lead"],
        ]
    )

    chars = {c for c in drawn if ord(c) > 0x024F}
    # Hiragana, katakana, the prolonged sound mark, and CJK punctuation.
    chars |= {chr(cp) for cp in range(0x3041, 0x3097)}
    chars |= {chr(cp) for cp in range(0x30A1, 0x30FB)}
    chars |= set("ー、。「」『』・〜（）：／")
    return "".join(sorted(chars))


def fetch(weight: int, text: str) -> bytes:
    css_url = (
        "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@"
        f"{weight}&text={urllib.parse.quote(text)}"
    )
    # No User-Agent: Google Fonts serves woff2 to modern browsers and TrueType to
    # everything else, and satori cannot read woff2.
    css = urllib.request.urlopen(css_url).read().decode("utf-8")
    match = re.search(r"src: url\(([^)]+)\) format\('truetype'\)", css)
    if not match:
        raise SystemExit(f"No TrueType source in the CSS for weight {weight}:\n{css}")
    return urllib.request.urlopen(match.group(1)).read()


text = wanted_chars()
print(f"要求する文字数: {len(text)}")

OUT.mkdir(parents=True, exist_ok=True)
for weight, name in WEIGHTS.items():
    data = fetch(weight, text)
    (OUT / name).write_bytes(data)
    print(f"  {name}: {len(data) / 1024:.1f} kB")
