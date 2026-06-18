"""Server-side watermark burning for review proof media.
Pixels-baked watermark — cannot be removed by inspecting the network tab.
"""
import io
import math
from PIL import Image, ImageDraw, ImageFont

WATERMARK_TEXT = "ERRORHACKER · ERRORHACKER.SITE · VERIFIED"


def _font(size: int) -> ImageFont.FreeTypeFont:
    """Try a few common fonts; gracefully fall back to PIL's default bitmap font."""
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def watermark_image(data: bytes, content_type: str) -> tuple[bytes, str]:
    """Burn a diagonal repeating watermark into the image pixels.
    Returns (new_bytes, new_content_type). Falls back to original on failure.
    """
    try:
        im = Image.open(io.BytesIO(data))
        # Keep transparency where possible; convert other modes
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.mode else "RGB")
        w, h = im.size

        # Cap font size to look consistent across phone screenshots and giant images
        font_size = max(14, min(48, int(min(w, h) * 0.025)))
        font = _font(font_size)

        # Build a transparent watermark layer the same size as the image
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        # Measure one line's width so we can repeat it across the diagonal
        text = f"{WATERMARK_TEXT}   "
        bbox = draw.textbbox((0, 0), text, font=font)
        line_w = bbox[2] - bbox[0]
        line_h = bbox[3] - bbox[1]
        # Vertical spacing between repeated rows
        spacing = int(line_h * 4.5)

        diag = int(math.hypot(w, h))
        # Tile the watermark across enough rows to cover the diagonal canvas
        for y in range(-h, h + diag, spacing):
            # Two color tones — alternating green-tint and white-tint — matches our brand
            color = (0, 255, 157, 95) if (y // spacing) % 2 == 0 else (255, 255, 255, 70)
            x = -line_w
            while x < w + line_w:
                draw.text((x, y), text, font=font, fill=color)
                x += line_w

        # Rotate the layer -22deg for that diagonal banner look
        layer = layer.rotate(-22, resample=Image.BICUBIC, expand=False)

        # Composite watermark layer over original
        if im.mode == "RGBA":
            out = Image.alpha_composite(im, layer)
        else:
            out = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")

        # Re-encode (JPEG preferred — smaller + universally supported)
        buf = io.BytesIO()
        if content_type == "image/png" and out.mode == "RGBA":
            out.save(buf, format="PNG", optimize=True)
            return buf.getvalue(), "image/png"
        out_rgb = out.convert("RGB")
        out_rgb.save(buf, format="JPEG", quality=86, optimize=True, progressive=True)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        # On any failure, return original bytes unchanged — never break the upload flow
        return data, content_type
