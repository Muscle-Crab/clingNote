self.addEventListener('push', function(event) {
    const notificationData = event.data.json();

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: '/icon.png'
        })
    );

    // Send the notification data to Vue via BroadcastChannel
    const bc = new BroadcastChannel('notification-channel');
    bc.postMessage(notificationData);
});
