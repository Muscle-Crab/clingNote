importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");


self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    // Read out the notification content using Speech Synthesis API
    const message = event.notification.body || "You have a new notification";

    if (self.speechSynthesis) {
        const speech = new SpeechSynthesisUtterance(message);
        speech.lang = 'en-US';
        speech.rate = 1.0; // Adjust speed
        speech.pitch = 1.0; // Adjust pitch
        speech.volume = 1.0; // Adjust volume
        self.speechSynthesis.speak(speech);
    } else {
        console.warn("Speech Synthesis not supported in this browser.");
    }

    // Open the app or specified URL when clicked
    event.waitUntil(
        clients.openWindow(event.notification.data ? event.notification.data.url : '/')
    );
});