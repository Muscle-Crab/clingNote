import Foundation
import Capacitor
import AVFoundation
import Speech
import MediaPlayer

/// Local Capacitor plugin "ClingVoice":
///  - Boss voice: AVSpeechSynthesizer with the best installed MALE English voice (Premium > Enhanced > compact), low pitch, brisk clipped lines.
///  - Voice input: on-device SFSpeechRecognizer with live partial results (WKWebView has no webkitSpeechRecognition).
@objc(ClingVoicePlugin)
public class ClingVoicePlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "ClingVoicePlugin"
    public let jsName = "ClingVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "voiceInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "releaseAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "otherAudioPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMusicPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareForegroundMusic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateNowPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ensureMix", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognitionAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestRecognitionPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopListening", returnType: CAPPluginReturnPromise)
    ]

    // MARK: - Boss voice (TTS)
    private let synth = AVSpeechSynthesizer()
    private var pendingCall: CAPPluginCall?
    private var remaining = 0
    /// Last value the web side reported: in-app focus music is playing (never deactivate the session under it).
    private var musicPlaying = false
    /// Process-wide copy so foreground activation does not depend on which plugin instance JS calls.
    static var userStartedMusic = false
    static let preferred = ["Evan", "Nathan", "Aaron", "Tom", "Reed", "Alex", "Fred"]

    override public func load() {
        synth.delegate = self
        // Music is interrupted only by its own pause button: when an OS interruption (call, Siri, alarm, another app) ends,
        // re-activate our mixable playback session and tell JS (useBackground) to resume, unless the user paused (JS owns that flag).
        NotificationCenter.default.addObserver(self, selector: #selector(onInterruption(_:)), name: AVAudioSession.interruptionNotification, object: AVAudioSession.sharedInstance())
        NotificationCenter.default.addObserver(self, selector: #selector(onRouteChange(_:)), name: AVAudioSession.routeChangeNotification, object: AVAudioSession.sharedInstance())
    }

    private var remoteInstalled = false

    /// Lock-screen play, pause, and next. Targets are installed only after the user starts music.
    private func installRemoteCommands() {
        UIApplication.shared.beginReceivingRemoteControlEvents()
        if remoteInstalled { return }
        remoteInstalled = true
        let rc = MPRemoteCommandCenter.shared()
        rc.playCommand.isEnabled = true
        rc.playCommand.addTarget { [weak self] _ in self?.notifyListeners("remoteCommand", data: ["action": "play"]); return .success }
        rc.pauseCommand.isEnabled = true
        rc.pauseCommand.addTarget { [weak self] _ in self?.notifyListeners("remoteCommand", data: ["action": "pause"]); return .success }
        rc.togglePlayPauseCommand.isEnabled = true
        rc.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["action": "toggle"]); return .success
        }
        rc.nextTrackCommand.isEnabled = true
        rc.nextTrackCommand.addTarget { [weak self] _ in self?.notifyListeners("remoteCommand", data: ["action": "next"]); return .success }
    }

    @objc private func onRouteChange(_ n: Notification) {
        guard let raw = n.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt, let reason = AVAudioSession.RouteChangeReason(rawValue: raw) else { return }
        DispatchQueue.main.async {
            let unplugged = reason == .oldDeviceUnavailable
            self.notifyListeners("routeChange", data: ["reason": unplugged ? "oldDeviceUnavailable" : "other", "headphonesRemoved": unplugged])
            if !unplugged && self.musicPlaying { try? AVAudioSession.sharedInstance().setActive(true) }
        }
    }

    @objc private func onInterruption(_ n: Notification) {
        guard let raw = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        DispatchQueue.main.async {
            if type == .began { self.notifyListeners("audioInterruption", data: ["type": "began"]); return }
            let opts = AVAudioSession.InterruptionOptions(rawValue: (n.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt) ?? 0)
            self.restoreMix()
            if self.musicPlaying { try? AVAudioSession.sharedInstance().setActive(true) }
            self.notifyListeners("audioInterruption", data: ["type": "ended", "shouldResume": opts.contains(.shouldResume), "musicPlaying": self.musicPlaying])
        }
    }

    /// After dictation / speech: put the mixable .playback category back and, if focus music is on, keep the session active
    /// and ask JS to resume it (WKWebView suspends the AudioContext on a category change).
    private func restoreAfterCapture(_ reason: String) {
        restoreMix()
        if musicPlaying { try? AVAudioSession.sharedInstance().setActive(true); notifyListeners("audioRestored", data: ["reason": reason]) }
        else { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    }

    static func bestVoice() -> AVSpeechSynthesisVoice? {
        let en = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("en") }
        func q(_ v: AVSpeechSynthesisVoice) -> Int {
            if #available(iOS 16.0, *), v.quality == .premium { return 3 }
            return v.quality == .enhanced ? 2 : 1
        }
        func nameRank(_ v: AVSpeechSynthesisVoice) -> Int {
            let n = v.name.lowercased()
            if let i = preferred.firstIndex(where: { n.hasPrefix($0.lowercased()) }) { return preferred.count - i }
            return 0
        }
        let us = en.filter { $0.language == "en-US" }
        // 1) a preferred male name, best quality first, then preference order
        let named = en.filter { nameRank($0) > 0 }.sorted { (q($0), nameRank($0), $0.language == "en-US" ? 1 : 0) > (q($1), nameRank($1), $1.language == "en-US" ? 1 : 0) }
        if let v = named.first { return v }
        // 2) any male en-US, then any male English
        let male = en.filter { $0.gender == .male }.sorted { (q($0), $0.language == "en-US" ? 1 : 0) > (q($1), $1.language == "en-US" ? 1 : 0) }
        if let v = male.first { return v }
        // 3) any en-US voice
        return us.sorted { q($0) > q($1) }.first ?? AVSpeechSynthesisVoice(language: "en-US")
    }

    @objc func voiceInfo(_ call: CAPPluginCall) {
        guard let v = Self.bestVoice() else { call.resolve(["name": "", "quality": "none"]); return }
        var quality = v.quality == .enhanced ? "enhanced" : "default"
        if #available(iOS 16.0, *), v.quality == .premium { quality = "premium" }
        let male = v.gender == .male || Self.preferred.contains(where: { v.name.lowercased().hasPrefix($0.lowercased()) })
        call.resolve(["name": v.name, "identifier": v.identifier, "language": v.language, "quality": quality, "male": male])
    }

    @objc func speak(_ call: CAPPluginCall) {
        let lines = (call.getArray("lines", String.self) ?? [call.getString("text") ?? ""]).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        guard !lines.isEmpty else { call.resolve(); return }
        let pitch = Float(call.getDouble("pitch") ?? 0.78)
        let rateMul = Float(call.getDouble("rate") ?? 1.06)
        DispatchQueue.main.async {
            if self.synth.isSpeaking { self.synth.stopSpeaking(at: .immediate) }
            self.finishPending()
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers, .duckOthers])
            try? AVAudioSession.sharedInstance().setActive(true)
            let voice = Self.bestVoice()
            self.pendingCall = call; self.remaining = lines.count
            for line in lines {
                let u = AVSpeechUtterance(string: line)
                u.voice = voice
                u.pitchMultiplier = max(0.5, min(2.0, pitch))
                u.rate = max(AVSpeechUtteranceMinimumSpeechRate, min(AVSpeechUtteranceMaximumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * rateMul))
                u.volume = 1.0
                u.preUtteranceDelay = 0
                u.postUtteranceDelay = 0.14 // short, punchy pause between barked lines
                self.synth.speak(u)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.synth.stopSpeaking(at: .immediate); self.finishPending(); call.resolve() }
    }

    private func finishPending() { remaining = 0; if let c = pendingCall { pendingCall = nil; c.resolve(["done": true]) } }

    /// After speaking: stop ducking, keep mixing with other apps' audio.
    private func restoreMix() { Self.mixWithOthers() }

    /// The one app-wide category: .playback (plays with the silent switch on) + .mixWithOthers (never interrupts Spotify/Apple Music).
    /// WebKit can switch the shared session to a non-mixable category when web audio starts, so JS calls ensureMix before every in-app sound.
    static func mixWithOthers() {
        let s = AVAudioSession.sharedInstance()
        if s.category == .playback && s.mode == .default && s.categoryOptions.contains(.mixWithOthers) { return }
        try? s.setCategory(.playback, mode: .default, options: [.mixWithOthers])
    }

    @objc func ensureMix(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if !self.synth.isSpeaking && !self.audioEngine.isRunning && !self.musicPlaying { Self.mixWithOthers() }
            call.resolve()
        }
    }

    /// Web side (utils/audioSession.js) reports when the in-app focus music starts/stops.
    @objc func setMusicPlaying(_ call: CAPPluginCall) {
        let on = call.getBool("playing") ?? false
        DispatchQueue.main.async {
            self.musicPlaying = on; Self.userStartedMusic = on
            if on {
                Self.mixWithOthers()
                try? AVAudioSession.sharedInstance().setActive(true)
                self.installRemoteCommands()
            } else {
                self.remoteInstalled = false
                Self.releaseNowPlaying(musicPlaying: false)
            }
            call.resolve()
        }
    }

    /// Real track label for the lock screen. Nothing is published unless the user started music.
    @objc func updateNowPlaying(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "Focus music"
        let artist = call.getString("artist") ?? "ClingNote"
        let album = call.getString("album") ?? "ClingNote"
        let playing = call.getBool("playing") ?? false
        DispatchQueue.main.async {
            guard Self.userStartedMusic || playing else { call.resolve(); return }
            MPNowPlayingInfoCenter.default().nowPlayingInfo = [
                MPMediaItemPropertyTitle: title,
                MPMediaItemPropertyArtist: artist,
                MPMediaItemPropertyAlbumTitle: album,
                MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0,
                MPNowPlayingInfoPropertyIsLiveStream: true
            ]
            if #available(iOS 13.0, *) { MPNowPlayingInfoCenter.default().playbackState = playing ? .playing : .paused }
            call.resolve()
        }
    }

    /// App is in the foreground again and the user had started music. Activate the mixable session so Web Audio can resume.
    /// No background mode: this runs only from a foreground resume, and only when music was already started.
    @objc func prepareForegroundMusic(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.musicPlaying || Self.userStartedMusic else { call.resolve(["active": false]); return }
            Self.reactivateIfUserMusic(); call.resolve(["active": true])
        }
    }

    static func reactivateIfUserMusic() {
        guard userStartedMusic else { return }
        mixWithOthers()
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    /// True when another app (music, podcast) is playing. The silent switch is not another app:
    /// treating it as one kept the session ambient, and the silent switch then muted the music on return.
    @objc func otherAudioPlaying(_ call: CAPPluginCall) {
        call.resolve(["playing": AVAudioSession.sharedInstance().isOtherAudioPlaying])
    }

    /// Lock-screen fix: after speech/audio ends or is cancelled, drop the "Now Playing" entry (ClingNote 0:01 / -0:00 player),
    /// stop receiving remote-control events and give the audio session back (other apps resume). Alarms use AlarmKit
    /// (system-owned audio), so deactivating our session does not affect them. Called from JS (useVoiceover.releaseMedia)
    /// only when focus music is NOT playing, so the music's lock-screen entry is never torn down. Category stays .playback for the next clip.
    static func releaseNowPlaying(musicPlaying: Bool = false) {
        let center = MPNowPlayingInfoCenter.default()
        center.nowPlayingInfo = nil
        if #available(iOS 13.0, *) { center.playbackState = .stopped }
        let rc = MPRemoteCommandCenter.shared()
        for cmd in [rc.playCommand, rc.pauseCommand, rc.togglePlayPauseCommand, rc.stopCommand, rc.nextTrackCommand, rc.previousTrackCommand, rc.changePlaybackPositionCommand, rc.skipForwardCommand, rc.skipBackwardCommand] {
            cmd.removeTarget(nil); cmd.isEnabled = false
        }
        UIApplication.shared.endReceivingRemoteControlEvents()
        if !musicPlaying { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    }

    @objc func releaseAudio(_ call: CAPPluginCall) {
        let music = call.getBool("musicPlaying") ?? false
        DispatchQueue.main.async {
            self.musicPlaying = music
            if self.synth.isSpeaking || self.audioEngine.isRunning { call.resolve(["released": false]); return }
            if music { call.resolve(["released": false]); return } // focus music owns the session and Now Playing entry
            Self.releaseNowPlaying(musicPlaying: music); call.resolve(["released": true])
        }
    }
    public func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { remaining -= 1; if remaining <= 0 { restoreMix(); if musicPlaying { notifyListeners("audioRestored", data: ["reason": "speech"]) }; finishPending() } }
    public func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) { restoreMix(); finishPending() }

    // MARK: - Voice input (speech recognition)
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var recognizer: SFSpeechRecognizer?
    // Bumped on every start/teardown. A cancelled task still fires its callback (with an error) after the next session has
    // started; without this check that stale callback tore down the NEW session and sent 'stopped' -> mic died instantly.
    private var listenGen = 0

    @objc func recognitionAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": SFSpeechRecognizer(locale: Locale(identifier: "en-US"))?.isAvailable ?? false])
    }

    @objc func requestRecognitionPermission(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { call.resolve(["granted": false, "reason": "speech"]); return }
            AVAudioSession.sharedInstance().requestRecordPermission { ok in
                call.resolve(["granted": ok, "reason": ok ? "" : "microphone"])
            }
        }
    }

    @objc func startListening(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardown()
            let lang = call.getString("language") ?? "en-US"
            guard let rec = SFSpeechRecognizer(locale: Locale(identifier: lang)), rec.isAvailable else { call.reject("unavailable"); return }
            guard SFSpeechRecognizer.authorizationStatus() == .authorized else { call.reject("not authorized"); return }
            if self.synth.isSpeaking { self.synth.stopSpeaking(at: .immediate) }
            do {
                let session = AVAudioSession.sharedInstance()
                // .mixWithOthers: recording must not take the session from the focus music (non-mixable playAndRecord interrupted it).
                // No .duckOthers / .measurement (measurement mode drops output gain, ducking dims the music while dictating).
                try session.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothA2DP])
                try session.setActive(true, options: .notifyOthersOnDeactivation)
                let req = SFSpeechAudioBufferRecognitionRequest()
                req.shouldReportPartialResults = true
                if rec.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
                let input = self.audioEngine.inputNode
                input.removeTap(onBus: 0)
                // Use the hardware input format (outputFormat can be stale after the category switch -> sampleRate assertion crash).
                let hw = input.inputFormat(forBus: 0)
                guard hw.sampleRate > 0, hw.channelCount > 0 else {
                    self.teardown(); call.reject("microphone unavailable"); return
                }
                let fmt = AVAudioFormat(standardFormatWithSampleRate: hw.sampleRate, channels: hw.channelCount) ?? hw
                input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { buf, _ in req.append(buf) }
                self.audioEngine.prepare(); try self.audioEngine.start()
                self.recognizer = rec; self.request = req
                self.listenGen += 1; let gen = self.listenGen
                self.task = rec.recognitionTask(with: req) { [weak self] result, error in
                    let text = result?.bestTranscription.formattedString; let fin = result?.isFinal ?? false
                    DispatchQueue.main.async {
                        guard let self = self, gen == self.listenGen else { return } // stale task from an earlier session
                        if let t = text { self.notifyListeners("partialResults", data: ["matches": [t], "isFinal": fin]) }
                        if error != nil || fin { self.teardown(); self.notifyListeners("listeningState", data: ["status": "stopped"]) }
                    }
                }
                self.notifyListeners("listeningState", data: ["status": "started"])
                call.resolve()
            } catch {
                self.teardown(); call.reject("could not start audio: \(error.localizedDescription)")
            }
        }
    }

    @objc func stopListening(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.request?.endAudio(); self.teardown(); call.resolve() }
    }

    private func teardown() {
        listenGen += 1
        task?.cancel(); request?.endAudio()
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        audioEngine.reset()
        request = nil; task = nil; recognizer = nil
        restoreAfterCapture("dictation")
    }
}
