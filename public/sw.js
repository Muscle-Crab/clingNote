importScripts("https://cdn.pushalert.co/sw-68811_6.js");


self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-tasks') {
        event.waitUntil(syncTasks());
    }
});

async function syncTasks() {
    // Fetch unsynced tasks from IndexedDB or localStorage
    const unsyncedTasks = await getUnsyncedTasks();

    if (unsyncedTasks.length > 0) {
        try {
            const response = await fetch('/api/sync-tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(unsyncedTasks),
            });

            if (response.ok) {
                console.log('Tasks synced successfully');
                await markTasksAsSynced();
            } else {
                console.error('Task sync failed:', response.statusText);
            }
        } catch (error) {
            console.error('Error syncing tasks:', error);
        }
    }
}

async function getUnsyncedTasks() {
    // Replace with your actual implementation (e.g., IndexedDB or localStorage)
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    return tasks.filter((task) => !task.synced);
}

async function markTasksAsSynced() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const updatedTasks = tasks.map((task) => ({ ...task, synced: true }));
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
}
