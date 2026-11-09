# App Review notes: background audio

ClingNote plays generative focus music that the user starts from the Background control (play button). The music is synthesized in the app. It is not a silent file and it does not start by itself.

`UIBackgroundModes` includes `audio` so that music keeps playing after the user locks the phone or switches apps. The audio session uses the playback category and is activated only when that music starts. Pausing or stopping the music deactivates the session and clears the lock-screen player. Lock-screen play, pause, and next control the same music and show the current track name. Unplugging headphones stops it. A phone call or Siri interruption resumes it only if the user had not paused.

There is no silent loop and no hidden audio clip used to keep the app awake.

## What to record on a physical iPhone

Record one continuous screen-and-audio capture. The reviewer needs to hear the music, not only see the UI.

1. Open ClingNote, open Background, and press Play music. The music must be clearly audible.
2. Lock the iPhone. On the lock screen, show the Now Playing card with the track name (for example “Lo-fi chill”) and ClingNote as the artist.
3. From the lock screen, pause, play, and skip to the next track. Each action must be audible.
4. Unlock, leave ClingNote for the Home screen or another app, and wait several seconds. The music must still be audible.
5. Return to ClingNote. The music must still be playing, and the in-app control must still say Pause.
6. Press Pause. The music must stop and stay stopped, including on the lock screen. No sound may continue after pause.
7. If headphones are available: play again, then unplug them. Playback must stop instead of jumping to the loudspeaker.

Do not submit this build without that recording. A background-audio mode with no audible demonstration is the same Guideline 2.5.4 rejection as the earlier build that declared the mode without real playback.
