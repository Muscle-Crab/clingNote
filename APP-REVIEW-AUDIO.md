# App Review notes — Guideline 2.5.4 (background audio)

ClingNote includes focus music the user starts themselves. It is generated in the app (no streamed catalog, no silent file). `UIBackgroundModes` includes `audio` only so that music continues after the user leaves ClingNote. The audio session is activated when the user taps Play and is deactivated when they tap Pause. If they never tap Play, ClingNote plays no background audio.

## Where to tap

1. Open the app and sign in. On Home, under the date and the large day title, tap **▶ Play focus music**. You should hear music immediately. The button changes to **⏸ Pause focus music**.
2. The same control is on a focus session: tap the play button on any task (it opens Focus Mode), then tap **▶ Play focus music** under the countdown. The line under the button names the track (for example “Lo-fi chill”).
3. Optional track choice: on Home tap **🎧 Background**, scroll to Music, pick a track, then tap **▶ Play music**. That is the same player.

## What happens on the Home Screen and the lock screen

Leave ClingNote with the iPhone Home gesture or the app switcher. The music keeps playing. Lock the phone. The Lock Screen and Control Center Now Playing card shows the track name, artist **ClingNote**, and album **Focus music**, with play, pause, and next. Pause, play, and next from that card are audible and match the in-app button.

Return to ClingNote. The button still says **⏸ Pause focus music** and the music is still going. Tap **⏸ Pause focus music**. The music stops and stays stopped, including on the Lock Screen. Nothing continues in silence.

Unplugging headphones stops the music instead of switching to the loudspeaker. A phone call or Siri pauses it and, after the interruption, it resumes only if the user had not pressed Pause.

## Recording to attach

One screen recording with system audio, on a physical iPhone:

1. Home → tap **▶ Play focus music** → music is audible and the button reads Pause.
2. Lock Screen Now Playing card with the track name, then pause, play, and next from that card.
3. Go to the iPhone Home Screen and wait several seconds → music still audible.
4. Open ClingNote again → still playing, button still says Pause.
5. Tap Pause → silence, and the Lock Screen player clears.
