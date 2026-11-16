import Foundation
#if os(iOS)
import AVFoundation
#endif

/// What the app tells the system its sound is. Recitation is the only sound
/// Hifth makes, and a reader who turned the silent switch on to stop the phone
/// ringing still means to hear the verse they pressed play on. Media plays with
/// the switch on; the default, background sound, does not. Spoken words means
/// the system pauses it for a call or directions instead of talking over it.
///
/// Setting the kind starts nothing: the system only turns sound on when the
/// page plays a verse, so other apps' music is left alone until then. It does
/// not keep playing once the app is closed; that would need Apple's background
/// sound permission, which the app does not ask for.
enum Sound {
    /// The system's own names for the two settings, kept as text so the Mac
    /// tests can check them; the Mac has no such setting.
    static let category = "AVAudioSessionCategoryPlayback"
    static let mode = "AVAudioSessionModeSpokenAudio"

    /// Once, at launch. A failure is printed and the app carries on: the worst
    /// case is the old behaviour, silent with the switch on.
    static func setUp() {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(AVAudioSession.Category(rawValue: category), mode: AVAudioSession.Mode(rawValue: mode))
        } catch {
            print("ev=sound_setup_failed msg=\"\(error.localizedDescription)\"")
            return
        }
        print("ev=sound category=\(session.category.rawValue) mode=\(session.mode.rawValue)")
        #endif
    }
}
