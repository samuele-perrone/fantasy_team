// Renders the app icon (the verdict bars) at 1024×1024 for each iOS appearance.
//   swift scripts/make-app-icon.swift
// Same geometry as public/brand/app-icon-*.svg on the website.
import AppKit

struct Variant { let file: String; let background: NSColor?; let bars: [NSColor] }

func hex(_ v: UInt32, _ a: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255,
            blue: CGFloat(v & 0xFF) / 255, alpha: a)
}

let variants = [
    // The default icon: navy, as on the website's dark theme.
    Variant(file: "AppIcon-light.png", background: hex(0x101426), bars: [hex(0x05C988), hex(0xF5B83D), hex(0xF0566E)]),
    // iOS dark mode draws its own dark backdrop behind a transparent icon.
    Variant(file: "AppIcon-dark.png", background: nil, bars: [hex(0x05C988), hex(0xF5B83D), hex(0xF0566E)]),
    // Tinted: greyscale, which iOS recolours with the wallpaper's tint.
    Variant(file: "AppIcon-tinted.png", background: nil, bars: [hex(0xFFFFFF), hex(0xFFFFFF, 0.75), hex(0xFFFFFF, 0.5)]),
]
let bars: [(x: CGFloat, y: CGFloat, w: CGFloat)] = [(225, 256, 573), (225, 451, 410), (225, 645, 246)]

let dir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1]
    : "FantasyTeamHub/Resources/Assets.xcassets/AppIcon.appiconset"
for v in variants {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let ctx = NSGraphicsContext.current!.cgContext
    if let bg = v.background {
        ctx.setFillColor(bg.cgColor)
        ctx.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
    }
    for (bar, color) in zip(bars, v.bars) {
        ctx.setFillColor(color.cgColor)
        // Core Graphics counts y from the bottom; the SVG counts from the top.
        let rect = CGRect(x: bar.x, y: 1024 - bar.y - 133, width: bar.w, height: 133)
        ctx.addPath(CGPath(roundedRect: rect, cornerWidth: 66.5, cornerHeight: 66.5, transform: nil))
        ctx.fillPath()
    }
    NSGraphicsContext.current = nil
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(dir)/\(v.file)"))
    print("wrote \(v.file)")
}
