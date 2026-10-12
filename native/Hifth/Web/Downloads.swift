import Foundation
import WebKit
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Files the page saves: the bookmarks, a cropped picture. Both apps open the
/// system's own save window, so the reader picks the folder, iCloud Drive
/// included. On the Mac that window is also what lets the app write there: a
/// folder the reader chose needs no privacy permission, where writing straight
/// into Downloads raised one.
final class Downloads: NSObject, WKDownloadDelegate {
    private var saving: [ObjectIdentifier: URL] = [:]

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String
    ) async -> URL? {
        #if os(iOS)
        // Written to a scratch folder first; the save window then copies it out.
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("saved", isDirectory: true)
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let destination = Self.freeDestination(in: folder, suggested: suggestedFilename)
        saving[ObjectIdentifier(download)] = destination
        return destination
        #else
        let panel = NSSavePanel()
        panel.nameFieldStringValue = Self.safeName(suggestedFilename)
        panel.canCreateDirectories = true
        let answer: NSApplication.ModalResponse
        if let window = download.webView?.window {
            answer = await panel.beginSheetModal(for: window)
        } else {
            answer = panel.runModal()
        }
        guard answer == .OK, let chosen = panel.url else { return nil }
        // The window already asked before replacing a file; the download refuses
        // to write over one, so the old copy goes first.
        try? FileManager.default.removeItem(at: chosen)
        return chosen
        #endif
    }

    func downloadDidFinish(_ download: WKDownload) {
        #if os(iOS)
        guard let file = saving.removeValue(forKey: ObjectIdentifier(download)),
              let webView = download.webView else { return }
        let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
        webView.window?.rootViewController?.presentedOrSelf.present(picker, animated: true)
        #endif
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        saving.removeValue(forKey: ObjectIdentifier(download))
    }

    /// The page's own name for the file, kept to its last part.
    nonisolated static func safeName(_ suggested: String) -> String {
        let last = (suggested as NSString).lastPathComponent
        return last.isEmpty || last == "." || last == ".." || last == "/" ? "download" : last
    }

    /// `safeName` in `folder`, with " 2", " 3" before the extension when that
    /// name is taken, as Safari does.
    nonisolated static func freeDestination(in folder: URL, suggested: String) -> URL {
        let name = safeName(suggested)
        let stem = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        var candidate = folder.appendingPathComponent(name)
        var n = 2
        while FileManager.default.fileExists(atPath: candidate.path) {
            candidate = folder.appendingPathComponent(ext.isEmpty ? "\(stem) \(n)" : "\(stem) \(n).\(ext)")
            n += 1
        }
        return candidate
    }
}
