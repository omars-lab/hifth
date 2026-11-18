import Foundation

/// Whether this launch keeps its page data in a throwaway store.
///
/// A run asked for a picture (HIFTH_SNAPSHOT_PATH, used by `make app-shot` and
/// `make app-store-shots`) must show the app as a new reader sees it. The web
/// view normally keeps its data where the laptop or device keeps it, so on
/// 2026-11-17 the Mac store pictures showed the laptop's own "Left off" ribbon,
/// and the run could have moved that reading place too. A throwaway store starts
/// empty and is gone when the app quits: the reader's data is neither shown nor
/// written. Readers never set this, so their launches keep their data.
enum ScreenshotData {
    /// Whether this launch uses a throwaway store. The store build reads no
    /// launch setting (launch item 36), so it always keeps the reader's data.
    static var atLaunch: Bool {
        #if !STORE
        return throwaway(ProcessInfo.processInfo.environment)
        #else
        return false
        #endif
    }

    #if !STORE
    static func throwaway(_ environment: [String: String]) -> Bool {
        !(environment["HIFTH_SNAPSHOT_PATH"] ?? "").isEmpty
    }
    #endif
}
