import Testing
@testable import Hifth

/// A reader who turns the silent switch on to stop the phone ringing still
/// means to hear the verse they pressed play on. On the iPad and iPhone that
/// depends on what the app tells the system its sound is: media plays with the
/// switch on, background sound does not (docs/design/app-store-launch.md,
/// item 12). The Mac has no such setting, so the choice is checked by name.
@Suite("Recitation plays with the silent switch on")
struct SoundTests {
    @Test("the app says its sound is media, which the silent switch does not mute")
    func playsAsMedia() {
        #expect(Sound.category == "AVAudioSessionCategoryPlayback")
    }

    @Test("and that it is spoken words, so the system pauses it rather than talking over it")
    func spokenWords() {
        #expect(Sound.mode == "AVAudioSessionModeSpokenAudio")
    }
}
