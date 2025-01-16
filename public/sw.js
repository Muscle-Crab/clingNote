// Import PushAlert script
importScripts("https://cdn.pushalert.co/sw-68811_6.js");

// Listen for the 'sync' event
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-tasks') {
        event.waitUntil(syncTasks());
    }
});

// Function to handle task synchronization
async function syncTasks() {
    // Fetch unsynced tasks from IndexedDB or localStorage
    const unsyncedTasks = await getUnsyncedTasks();

    if (unsyncedTasks.length > 0) {
        try {
            // Send unsynced tasks to the server
            const response = await fetch('/api/sync-tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(unsyncedTasks),
            });

            if (response.ok) {
                console.log('Tasks synced successfully');
                // Mark tasks as synced locally
                await markTasksAsSynced();
            } else {
                console.error('Task sync failed:', response.statusText);
            }
        } catch (error) {
            console.error('Error syncing tasks:', error);
        }
    } else {
        console.log('No unsynced tasks found');
    }
}

// Function to fetch unsynced tasks
async function getUnsyncedTasks() {
    // Use IndexedDB or localStorage to fetch tasks
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    return tasks.filter((task) => !task.synced); // Filter tasks that are not synced
}

// Function to mark tasks as synced locally
async function markTasksAsSynced() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const updatedTasks = tasks.map((task) => ({ ...task, synced: true })); // Mark each task as synced
    localStorage.setItem('tasks', JSON.stringify(updatedTasks)); // Save updated tasks back to localStorage
    console.log('Tasks marked as synced locally');
}
