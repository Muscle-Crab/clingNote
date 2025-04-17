<template>
  <!-- Hero Section -->
  <section class="bg-gray-900 bg-cover bg-center bg-no-repeat bg-blend-multiply" style="background-image: url('https://flowbite.s3.amazonaws.com/docs/jumbotron/conference.jpg')">
    <div class="max-w-screen-xl px-4 py-20 mx-auto text-center">
      <h1 class="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
        One App for Tasks, Assignments, Workouts & Groceries
      </h1>
      <p class="text-base md:text-lg text-gray-300 max-w-2xl mx-auto mb-6">
        Whether you’re knocking out homework 📚, hitting the gym 💪, planning meals 🛒, or tackling your to-dos ✅ — this all-in-one productivity app helps you stay consistent every day.
      </p>
      <div class="mt-8">
        <router-link
            to="/home"
            class="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold px-6 py-3 rounded-full shadow-md transition duration-300"
        >
          Get Started
        </router-link>
      </div>
      <!-- Video -->
      <div class="max-w-3xl mx-auto aspect-video rounded-xl overflow-hidden shadow-xl">
        <video
            src="@/assets/video.mp4"
            autoplay
            muted
            playsinline
            controls
            class="w-full h-full object-cover"
        />
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="bg-white py-10 px-4">
    <div class="max-w-6xl mx-auto text-center">
      <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
        Powerful Features
      </h2>
      <p class="text-gray-600 text-base mb-6">
        Designed to support your routine, every single day.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
        <div
            v-for="(feature, index) in features"
            :key="index"
            class="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md border border-gray-100 transition"
        >
          <h3 class="text-base font-semibold text-blue-600 mb-1">{{ feature.title }}</h3>
          <p class="text-sm text-gray-700">{{ feature.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>



<script setup>
const features = [
  {
    title: "🎙️ Voice-Controlled Task Creation",
    description: "Add tasks hands-free using voice input, live transcription, and waveform animation."
  },
  {
    title: "📅 Daily Routine Calendar",
    description: "Organize your week with day-specific tabs and a scrollable task planner."
  },
  {
    title: "🧠 Advanced Productivity System",
    description: "Includes smart reminders, visual progress bars, idle time unlocks, and motivational feedback."
  },
  {
    title: "🔥 Streak Tracking + Milestone Badges",
    description: "Build streaks by completing daily tasks and earn milestone badges for consistency."
  },
  {
    title: "📎 Attachments & Voice Notes",
    description: "Upload images, files, or record voice notes to enhance task context and details."
  },
  {
    title: "🔄 One-Time & Recurring Tasks",
    description: "Decide if a task repeats weekly or disappears after completion."
  },
  {
    title: "🧩 Add Tasks to Multiple Days",
    description: "Select multiple days when creating a task — perfect for habits and recurring routines."
  },
  {
    title: "📤 Task Transfer Between Days",
    description: "Easily move any task to another day using the transfer modal."
  },
  {
    title: "🪙 Points, Idle Time & Social Media Unlock",
    description: "Earn points from tasks to unlock idle time and gain access to social media rewards."
  },
  {
    title: "🚫 Won’t Do Tracking",
    description: "Mark tasks as 'Won’t Do' with reasons, and restore them later if needed."
  },
  {
    title: "🔔 Smart Reminders with OneSignal",
    description: "Get push notifications for task reminders and timers using OneSignal integration."
  },
  {
    title: "⏱️ Timers with Notifications",
    description: "Start task-specific timers and receive notifications upon completion, even in the background."
  },
  {
    title: "📈 Daily Performance Report",
    description: "Get a spoken report each day about yesterday’s progress, today’s tasks, and your streak."
  },
  {
    title: "👀 Toggle Completed Task Visibility",
    description: "Show or hide completed tasks to keep your routine clean and focused."
  },
  {
    title: "🎯 Mark as Important + Custom Labels",
    description: "Highlight high-priority tasks and organize with custom tags and notes."
  },
  {
    title: "📦 Attach Files, Images, or Docs",
    description: "Easily upload and preview any relevant task attachments with delete support."
  },
  {
    title: "📊 Earn Points for Each Task",
    description: "Every completed task earns points that unlock new features and rewards."
  },
  {
    title: "🔀 Task Reordering by Drag-and-Drop",
    description: "Change the order of your tasks any time with smooth drag-and-drop functionality."
  },
  {
    title: "🌚 Sleek UI with Dark Mode",
    description: "Beautiful and responsive interface with full light/dark mode support."
  }
];

</script>

<style scoped>
section {
  background-image: linear-gradient(to bottom, #ffffff, #f3f4f6);
}
.iframe-container {
  max-width: 100%;
  overflow: hidden;
}
iframe {
  border: none;
}
</style>
