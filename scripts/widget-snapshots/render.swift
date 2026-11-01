// Renders the widget views (sample data) to PNGs. Compiled together with ClingNoteWidget.swift (with @main stripped) and run in the iOS simulator by ios-widget-test.yml.
import SwiftUI
import UIKit
@main struct RenderMain {
    @MainActor static func main() {
        let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
        let snap = WidgetSnapshot.sample
        func save<V: View>(_ v: V, _ w: CGFloat, _ h: CGFloat, _ name: String) {
            let view = v.padding(16).frame(width: w, height: h).background(CN.background)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous)).padding(20).background(Color(white: 0.85))
            let r = ImageRenderer(content: view); r.scale = 3
            if let img = r.uiImage, let d = img.pngData() { try! d.write(to: URL(fileURLWithPath: "\(out)/widget-\(name).png")); print("wrote \(name)") } else { print("render failed \(name)") }
        }
        save(SmallView(snap: snap), 170, 170, "small")
        save(ListView(snap: snap, maxRows: 4, showBar: false), 364, 170, "medium")
        save(ListView(snap: snap, maxRows: 8, showBar: true), 364, 382, "large")
    }
}
