import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_bayesmarket_icon(size=512):
    # Supersample 2x for ultra-smooth anti-aliasing
    canvas_size = size * 2
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    # Margins and dimensions
    pad = int(canvas_size * 0.05)
    w = canvas_size - 2 * pad
    h = canvas_size - 2 * pad
    radius = int(w * 0.26)

    # 1. Background squircle: Deep Obsidian Violet (#0e0c1e -> #070611)
    # Perfectly matching BayesMarket's --surface-card (#131126) and --canvas (#080711)
    bg = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    bg_draw.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=(14, 12, 30, 255))
    
    # Gradient overlay on background
    bg_grad = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    bgg_draw = ImageDraw.Draw(bg_grad)
    for y in range(pad, pad + h):
        t = (y - pad) / h
        # From #161334 (top-left) to #080711 (bottom-right)
        r = int(22 * (1 - t) + 8 * t)
        g = int(19 * (1 - t) + 7 * t)
        b = int(52 * (1 - t) + 17 * t)
        bgg_draw.line([(pad, y), (pad + w, y)], fill=(r, g, b, 255))
    
    bg_mask = Image.new("L", (canvas_size, canvas_size), 0)
    bm_draw = ImageDraw.Draw(bg_mask)
    bm_draw.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=255)
    img.paste(bg_grad, (0, 0), bg_mask)

    # 2. Glowing Rim Gradient: Royal Violet (#7c4dff) -> Electric Sky (#38bdf8) -> Mint (#00dc82)
    rim_mask = Image.new("L", (canvas_size, canvas_size), 0)
    rim_draw = ImageDraw.Draw(rim_mask)
    rim_width = max(3, int(canvas_size * 0.018))
    rim_draw.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, outline=255, width=rim_width)

    rim_gradient = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    rim_g_draw = ImageDraw.Draw(rim_gradient)
    for y in range(canvas_size):
        t = y / canvas_size
        # Violet (#7c4dff: 124, 77, 255) -> Sky (#38bdf8: 56, 189, 248) -> Mint (#00dc82: 0, 220, 130)
        if t < 0.5:
            k = t * 2
            r = int(124 * (1 - k) + 56 * k)
            g = int(77 * (1 - k) + 189 * k)
            b = int(255 * (1 - k) + 248 * k)
        else:
            k = (t - 0.5) * 2
            r = int(56 * (1 - k) + 0 * k)
            g = int(189 * (1 - k) + 220 * k)
            b = int(248 * (1 - k) + 130 * k)
        rim_g_draw.line([(0, y), (canvas_size, y)], fill=(r, g, b, 240))
    
    img.paste(rim_gradient, (0, 0), rim_mask)

    # 3. Ambient Central Violet Glow (matching --primary-glow: rgba(124, 77, 255, 0.35))
    glow = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    cx, cy = canvas_size // 2, canvas_size // 2
    glow_radius = int(w * 0.42)
    glow_draw.ellipse([cx - glow_radius, cy - glow_radius, cx + glow_radius, cy + glow_radius], fill=(124, 77, 255, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(int(canvas_size * 0.09)))
    img.paste(glow, (0, 0), glow)

    # 4. Bayesian Normal Distribution Curve (Subtle Lavender/Sky #c4b5fd / #7dd3fc)
    curve_layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    curve_draw = ImageDraw.Draw(curve_layer)
    pts = []
    x_start = pad + int(w * 0.12)
    x_end = pad + int(w * 0.88)
    base_y = pad + int(h * 0.72)
    peak_y = pad + int(h * 0.28)
    center_x = cx
    sigma = (x_end - x_start) / 5.5

    for x in range(x_start, x_end, 2):
        gauss = math.exp(-0.5 * ((x - center_x) / sigma) ** 2)
        y = base_y - (base_y - peak_y) * gauss
        pts.append((x, y))

    for i in range(len(pts) - 1):
        if i % 6 < 4:  # dotted effect
            curve_draw.line([pts[i], pts[i+1]], fill=(125, 211, 252, 110), width=max(2, int(canvas_size * 0.008)))
    img.paste(curve_layer, (0, 0), curve_layer)

    # 5. The Core Glyph: Futuristic Bayesian "B" in Royal Violet -> Lavender (#7c4dff -> #c4b5fd)
    bx = pad + int(w * 0.28)
    by_top = pad + int(h * 0.22)
    by_bot = pad + int(h * 0.78)
    spine_w = max(4, int(w * 0.10))

    # Vertical spine (Probability Axis)
    spine_x1 = bx
    spine_x2 = bx + spine_w

    spine_grad = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    sg_draw = ImageDraw.Draw(spine_grad)
    for y in range(by_top, by_bot):
        t = (y - by_top) / (by_bot - by_top)
        # From #a855f7 (168, 85, 247) to #7c4dff (124, 77, 255)
        r = int(196 * (1 - t) + 124 * t)
        g = int(181 * (1 - t) + 77 * t)
        b = int(253 * (1 - t) + 255 * t)
        sg_draw.line([(spine_x1, y), (spine_x2, y)], fill=(r, g, b, 255))
    
    spine_mask = Image.new("L", (canvas_size, canvas_size), 0)
    sm_draw = ImageDraw.Draw(spine_mask)
    sm_draw.rounded_rectangle([spine_x1, by_top, spine_x2, by_bot], radius=spine_w//2, fill=255)
    img.paste(spine_grad, (0, 0), spine_mask)

    # Loops of the "B"
    loop_thick = max(4, int(w * 0.095))
    mid_y = (by_top + by_bot) // 2
    
    # Top loop (Prior probability)
    top_w = int(w * 0.36)
    top_box = [bx + spine_w // 2, by_top, bx + spine_w // 2 + top_w, mid_y + loop_thick // 2]
    # Bottom loop (Posterior probability - wider)
    bot_w = int(w * 0.44)
    bot_box = [bx + spine_w // 2, mid_y - loop_thick // 2, bx + spine_w // 2 + bot_w, by_bot]

    loops_layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    ll_draw = ImageDraw.Draw(loops_layer)
    
    radius_top = (top_box[3] - top_box[1]) // 2
    radius_bot = (bot_box[3] - bot_box[1]) // 2

    # Top arc in #a855f7 (Purple-500)
    ll_draw.rounded_rectangle(top_box, radius=radius_top, outline=(168, 85, 247, 255), width=loop_thick)
    # Bottom arc in #7c4dff (Royal Violet)
    ll_draw.rounded_rectangle(bot_box, radius=radius_bot, outline=(124, 77, 255, 255), width=loop_thick)
    
    img.paste(loops_layer, (0, 0), loops_layer)

    # 6. Dynamic Ascending Market Prediction Vector (#7dd3fc Sky -> #00dc82 Mint)
    vec_layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vec_layer)
    
    v_pts = [
        (pad + int(w * 0.18), pad + int(h * 0.68)),
        (bx + spine_w // 2 + int(w * 0.14), pad + int(h * 0.50)),
        (bx + spine_w // 2 + int(w * 0.28), pad + int(h * 0.55)),
        (pad + int(w * 0.82), pad + int(h * 0.26))
    ]
    vec_width = max(3, int(canvas_size * 0.022))
    v_draw.line(v_pts, fill=(125, 211, 252, 255), width=vec_width, joint="round")
    
    # Intermediate node (Sky Blue #38bdf8)
    mid_x, mid_y_node = v_pts[1]
    mid_r = max(3, int(canvas_size * 0.022))
    v_draw.ellipse([mid_x - mid_r, mid_y_node - mid_r, mid_x + mid_r, mid_y_node + mid_r], fill=(56, 189, 248, 255))
    
    # Apex winning prediction node (Mint #00dc82 with white center)
    apex_x, apex_y = v_pts[-1]
    node_r = max(4, int(canvas_size * 0.038))
    v_draw.ellipse([apex_x - node_r, apex_y - node_r, apex_x + node_r, apex_y + node_r], fill=(0, 220, 130, 255), outline=(255, 255, 255, 255), width=max(2, int(canvas_size*0.008)))
    
    img.paste(vec_layer, (0, 0), vec_layer)

    # Downsample using Lanczos
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

if __name__ == "__main__":
    public_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")
    os.makedirs(public_dir, exist_ok=True)

    print("Generating BayesMarket brand icons with exact webapp palette...")
    img512 = create_bayesmarket_icon(512)
    img192 = create_bayesmarket_icon(192)
    img180 = create_bayesmarket_icon(180)
    img64 = create_bayesmarket_icon(64)
    img32 = create_bayesmarket_icon(32)
    img16 = create_bayesmarket_icon(16)

    # Save PNG assets
    img512.save(os.path.join(public_dir, "icon-512.png"), "PNG")
    img192.save(os.path.join(public_dir, "icon-192.png"), "PNG")
    img180.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
    
    # Save multi-resolution .ico
    ico_path = os.path.join(public_dir, "favicon.ico")
    img256 = create_bayesmarket_icon(256)
    img48 = create_bayesmarket_icon(48)
    
    img256.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        append_images=[create_bayesmarket_icon(128), img64, img48, img32, img16]
    )
    print(f"Generated {ico_path} successfully matching webapp theme.")
