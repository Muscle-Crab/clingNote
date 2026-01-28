<template>
  <div ref="scrollContainer" class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950">

    <!-- Loading Screen -->
    <div v-if="isLoading" class="fixed inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center z-50">
      <div class="text-center space-y-6">
        <div class="relative">
          <div class="w-24 h-24 border-8 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-4xl">✨</span>
          </div>
        </div>
        <h1 class="text-4xl font-bold text-white tracking-tight">Welcome Back</h1>
        <p class="text-lg text-white/80">Preparing your workspace...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="relative">

      <!-- Header with Glassmorphism -->
      <header class="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-gray-200/50 dark:border-slate-700/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">

            <!-- Logo & Title -->
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span class="text-xl">✓</span>
              </div>
              <div>
                <h1 class="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">TaskFlow</h1>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ currentDate }}</p>
              </div>
            </div>

            <!-- Stats & Actions -->
            <div class="flex items-center space-x-4">

              <!-- Rank Display -->
              <div class="hidden sm:flex items-center space-x-2 px-4 py-2 rounded-full shadow-lg" :class="`bg-gradient-to-r ${userRank.color}`">
                <span class="text-2xl">{{ userRank.icon }}</span>
                <div class="flex flex-col">
                  <span class="text-xs text-white/80">Rank</span>
                  <span class="text-sm font-bold text-white">{{ userRank.name }}</span>
                </div>
              </div>

              <!-- Points Display -->
              <div class="hidden sm:flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
                <span class="text-xl">⚡</span>
                <div class="flex flex-col">
                  <span class="text-xs text-gray-600 dark:text-gray-400">Points</span>
                  <span class="text-sm font-bold text-indigo-600 dark:text-indigo-400">{{ userRank.points }}</span>
                </div>
              </div>

              <!-- Year Countdown -->
              <div class="hidden md:flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30">
                <span class="text-xl">⏰</span>
                <div class="flex flex-col">
                  <span class="text-xs text-gray-600 dark:text-gray-400">Year Left</span>
                  <span class="text-sm font-bold text-red-600 dark:text-red-400">{{ timeLeftInYear }}</span>
                </div>
              </div>

              <!-- Focus Mode Toggle -->
              <!-- Removed - Focus mode is now per-task -->

              <!-- Settings -->
              <button class="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-600 dark:text-gray-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Payment Modal -->
      <div v-if="!hasPaid && showPaymentModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
          <div class="relative">
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span class="text-3xl">💎</span>
              </div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Out of Credits</h2>
              <p class="text-gray-600 dark:text-gray-300">Refill to continue using AI features</p>
            </div>

            <div class="space-y-3 mb-6">
              <div class="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
                <span class="text-xl">✨</span>
                <span>30 credits = 30 AI generations</span>
              </div>
              <div class="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
                <span class="text-xl">⚡</span>
                <span>Works with prompts, voice & images</span>
              </div>
              <div class="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
                <span class="text-xl">🚀</span>
                <span>Instant access after payment</span>
              </div>
            </div>

            <button
                @click="redirectToCheckout"
                class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-4 rounded-xl transition-all transform hover:scale-105 shadow-lg mb-3"
            >
              Buy 30 Credits – $5 💎
            </button>

            <button
                @click="showPaymentModal = false"
                class="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>

      <!-- Smart Input Bar -->
      <div class="max-w-4xl mx-auto px-4 py-6" v-if="!focusMode">
        <div class="relative group">
          <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-10 blur transition-opacity"></div>
          <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-4 flex items-end gap-3">
            <textarea
                v-model="smartPrompt"
                @keyup.enter.prevent="submitSmartPrompt"
                placeholder="What would you like to accomplish today?"
                rows="1"
                @input="autoResizeTextarea"
                class="flex-1 resize-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-base outline-none"
            ></textarea>

            <div class="flex items-center space-x-2">
              <button
                  @click="submitSmartPrompt"
                  class="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition-all transform hover:scale-105 shadow-lg"
                  title="Generate Tasks"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </button>

              <button
                  @click="triggerHandwritingUpload"
                  class="p-3 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 transition-colors"
                  title="Upload Image"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <input ref="handwritingInput" type="file" accept="image/*" @change="handleHandwritingUpload" class="hidden"/>
      </div>

      <!-- Calendar & Progress Section -->
      <div class="max-w-7xl mx-auto px-4 py-6" v-if="!focusMode">
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">

          <!-- Days Left Counter -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatDateLong(currentDate) }}</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Your weekly overview</p>
            </div>
            <div class="flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30">
              <span class="text-xl animate-pulse">⏳</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ daysLeftInYear }} days left</span>
            </div>
          </div>

          <!-- Week Calendar -->
          <div class="grid grid-cols-7 gap-3 mb-6">
            <div
                v-for="(day, index) in days"
                :key="index"
                @click="handleDayTabClick(index)"
                class="relative group cursor-pointer"
            >
              <div
                  class="p-4 rounded-2xl transition-all duration-300 transform hover:scale-105"
                  :class="{
                  'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg scale-105': isToday(index),
                  'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400': isSelected(index) && !isToday(index),
                  'bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700': !isSelected(index) && !isToday(index)
                }"
              >
                <div class="text-center">
                  <div class="text-xs font-medium mb-1 opacity-80">{{ day.day }}</div>
                  <div class="text-lg font-bold">{{ new Date(day.date).getDate() }}</div>
                  <div v-if="getTasksForDay(index) > 0" class="mt-2">
                    <div class="w-2 h-2 rounded-full bg-current mx-auto opacity-60"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="relative">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Daily Progress</span>
              <span class="text-sm font-bold text-indigo-600 dark:text-indigo-400">{{ calculateCompletionPercentage() }}%</span>
            </div>

            <div class="relative h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                  class="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-700 ease-out"
                  :style="{ width: calculateCompletionPercentage() + '%' }"
              >
                <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>

            <!-- Milestone Indicators -->
            <div class="relative mt-4 flex justify-between">
              <div
                  v-for="(milestone, index) in milestones"
                  :key="index"
                  class="flex flex-col items-center"
              >
                <div
                    class="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg"
                    :class="{
                    'bg-gradient-to-br from-indigo-500 to-purple-600 scale-110': calculateCompletionPercentage() >= milestone.percent,
                    'bg-gray-200 dark:bg-slate-700': calculateCompletionPercentage() < milestone.percent
                  }"
                >
                  <span
                      class="text-2xl transition-transform duration-500"
                      :class="{ 'animate-bounce': calculateCompletionPercentage() >= milestone.percent }"
                  >
                    {{ milestone.icon }}
                  </span>
                </div>
                <span class="text-xs text-gray-500 dark:text-gray-400 mt-2">{{ milestone.percent }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tasks Section -->
      <div class="max-w-7xl mx-auto px-4 pb-32">
        <!-- Daily Status Banner -->
        <div v-if="selectedDayRoutine?.length > 0 && isToday(selectedDayIndex)" class="mb-6">
          <div
              class="rounded-2xl p-6 border-2 transition-all"
              :class="completedTaskCount >= 5
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-500'
              : completedTaskCount >= 3
              ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-500'
              : 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-500'"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <div class="text-5xl">
                  {{ completedTaskCount >= 5 ? '💼' : completedTaskCount >= 3 ? '⚡' : '⚠️' }}
                </div>
                <div>
                  <h3 class="text-xl font-bold mb-1" :class="completedTaskCount >= 5 ? 'text-green-700 dark:text-green-400' : completedTaskCount >= 3 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'">
                    {{ completedTaskCount >= 5 ? 'Productive Day!' : completedTaskCount >= 3 ? 'Almost There!' : 'At Risk!' }}
                  </h3>
                  <p class="text-sm" :class="completedTaskCount >= 5 ? 'text-green-600 dark:text-green-300' : completedTaskCount >= 3 ? 'text-yellow-600 dark:text-yellow-300' : 'text-red-600 dark:text-red-300'">
                    {{ completedTaskCount >= 5
                      ? `🎉 ${completedTaskCount}/5+ tasks done! Keep it up!`
                      : `${completedTaskCount}/5 tasks - Complete ${5 - completedTaskCount} more to unlock treasure & avoid losing streak!`
                    }}
                  </p>
                </div>
              </div>

              <div class="text-right">
                <div class="text-3xl font-bold mb-1" :class="completedTaskCount >= 5 ? 'text-green-600' : 'text-gray-600'">
                  {{ completedTaskCount }}/{{ selectedDayRoutine?.length }}
                </div>
                <div class="text-xs text-gray-600 dark:text-gray-400">Tasks Done</div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="mt-4 relative h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                  class="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  :class="completedTaskCount >= 5
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                  : completedTaskCount >= 3
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-600'
                  : 'bg-gradient-to-r from-red-500 to-pink-600'"
                  :style="{ width: Math.min(100, (completedTaskCount / 5) * 100) + '%' }"
              >
                <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        <div>

          <!-- Task Stats -->
          <div v-if="selectedDayRoutine?.length > 0" class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Today's Tasks
              </h3>
              <div class="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {{ completedTaskCount }}/{{ selectedDayRoutine?.length }}
                </span>
              </div>
            </div>

            <div class="flex items-center space-x-2">
              <button
                  @click="clearTasksForToday"
                  class="p-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors"
                  title="Clear All Tasks"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>

              <button
                  @click="showCompleted = !showCompleted"
                  class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 transition-colors"
                  :title="showCompleted ? 'Hide Completed' : 'Show Completed'"
              >
                <svg v-if="showCompleted" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="selectedDayRoutine?.length === 0" class="text-center py-16">
            <div class="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
              <span class="text-6xl">✨</span>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No tasks yet</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">Start your day fresh with a new task</p>
            <button
                @click="openModal('task')"
                class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Create Your First Task
            </button>
          </div>

          <!-- Task List -->
          <div v-else class="space-y-3">
            <draggable
                v-model="selectedDayRoutine"
                handle=".drag-handle"
                :animation="200"
                ghost-class="opacity-50"
                @end="handleDragEnd"
                class="space-y-3"
            >
              <template #item="{ element: task, index }">
                <div
                    v-if="(!task.completed || (isToday(selectedDayIndex) && showCompleted))"
                    class="group relative"
                >
                  <!-- Task Card with Modern Design -->
                  <div
                      class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
                      :class="{
                      'opacity-60': task.completed && isToday(selectedDayIndex),
                      'ring-2 ring-red-500 ring-offset-2': task.important,
                      'scale-105': focusMode
                    }"
                  >
                    <!-- Drag Handle -->
                    <div class="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity drag-handle cursor-move">
                      <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-16h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                      </svg>
                    </div>

                    <div class="flex items-start justify-between">
                      <div class="flex-1 ml-8">
                        <!-- Task Title -->
                        <div class="flex items-center space-x-3 mb-3">
                          <button
                              v-if="isToday(selectedDayIndex)"
                              @click="toggleTaskCompletion(getOriginalIndex(task))"
                              class="flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-300"
                              :class="task.completed
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-green-500'
                              : 'border-gray-300 dark:border-slate-600 hover:border-indigo-500'"
                          >
                            <svg v-if="task.completed" class="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                            </svg>
                          </button>

                          <h4
                              @click="openTaskDetailModal(task)"
                              class="text-lg font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-1"
                              :class="{ 'line-through opacity-60': task.completed && isToday(selectedDayIndex) }"
                          >
                            {{ task.title }}
                          </h4>

                          <div class="flex items-center space-x-1">
                            <span v-if="task.youtubeURL" class="text-xl" title="Video attached">🎥</span>
                            <span v-if="task.fileURL" class="text-xl" title="File attached">📄</span>
                            <span v-if="task.imageURL" class="text-xl" title="Image attached">🖼️</span>
                          </div>
                        </div>

                        <!-- Task Meta -->
                        <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                          <div v-if="task.reminder?.date && task.reminder?.time" class="flex items-center space-x-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <span>{{ formatShortDate(task.reminder.date) }} • {{ formatTime(task.reminder.time) }}</span>
                          </div>

                          <button
                              @click="toggleTaskImportance(index)"
                              class="flex items-center space-x-1 px-2 py-1 rounded-lg transition-all"
                              :class="task.important
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                              : 'hover:bg-gray-100 dark:hover:bg-slate-700'"
                          >
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                            </svg>
                          </button>
                        </div>

                        <!-- Labels -->
                        <div v-if="task.labels?.length" class="flex flex-wrap gap-2 mt-3">
                          <span
                              v-for="(label, labelIndex) in task.labels"
                              :key="labelIndex"
                              @click="toggleLabelHighlight(label)"
                              class="px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-all"
                              :class="activeLabels.includes(label)
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'"
                          >
                            {{ label }}
                          </span>
                        </div>

                        <!-- Task Image Preview -->
                        <div v-if="task.imageURL" @click="openTaskDetailModal(task)" class="mt-3 cursor-pointer">
                          <img
                              :src="task.imageURL"
                              class="w-24 h-24 object-cover rounded-xl border-2 border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform"
                              alt="Task preview"
                          />
                        </div>

                        <!-- Focus Mode Button -->
                        <button
                            v-if="!task.completed"
                            @click="openTaskFocusMode(index)"
                            class="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold transition-all flex items-center space-x-2 text-sm shadow-lg"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                          <span>Focus on This Task</span>
                        </button>
                      </div>

                      <!-- Action Menu -->
                      <div class="relative">
                        <button
                            @click="toggleIcons(index)"
                            class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 transition-colors"
                        >
                          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 16 3">
                            <path d="M2 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6.041 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM14 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/>
                          </svg>
                        </button>

                        <!-- Dropdown Menu -->
                        <div
                            v-if="iconVisibility[index]"
                            class="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 py-2 z-10"
                        >
                          <button @click="openModal('calendar', index, task.title)" class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-2 text-sm">
                            <span>📅</span>
                            <span>Add Reminder</span>
                          </button>
                          <button @click="openTransferModal(index)" class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-2 text-sm">
                            <span>🔄</span>
                            <span>Transfer</span>
                          </button>
                          <button @click="triggerImageUpload(index)" class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-2 text-sm">
                            <span>📎</span>
                            <span>Attach File</span>
                          </button>
                          <button @click="openYouTubeModal(index)" class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-2 text-sm">
                            <span>🎥</span>
                            <span>Add Video</span>
                          </button>
                          <button @click="showTimerModal = true" class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-2 text-sm">
                            <span>⏱️</span>
                            <span>Set Timer</span>
                          </button>
                          <button @click="openWontDoModal(index)" class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-2 text-sm text-orange-600">
                            <span>🚫</span>
                            <span>Won't Do</span>
                          </button>
                          <button @click="deleteTask(index)" class="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 text-sm text-red-600">
                            <span>🗑️</span>
                            <span>Delete</span>
                          </button>
                        </div>

                        <input
                            type="file"
                            :ref="'fileInput_' + index"
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            @change="handleUpload($event, index)"
                            class="hidden"
                        />
                      </div>
                    </div>

                    <!-- Task Number Badge -->
                    <div class="absolute bottom-3 left-3 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                      <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">{{ index + 1 }}</span>
                    </div>
                  </div>

                  <div v-if="focusMode" class="mt-6 space-y-4">
                    <!-- Music Player -->
                    <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-200 dark:border-slate-700">
                      <div class="flex items-center justify-between mb-3">
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">🎵 Focus Music</span>
                        <button
                            @click="musicPlaying ? pauseMusic() : playMusic(currentMusic || availableMusic[0])"
                            class="p-2 rounded-lg transition-colors"
                            :class="musicPlaying ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'"
                        >
                          <svg v-if="!musicPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                          </svg>
                          <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                          </svg>
                        </button>
                      </div>

                      <div class="space-y-2">
                        <button
                            v-for="music in availableMusic"
                            :key="music.id"
                            @click="playMusic(music)"
                            class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                            :class="currentMusic?.id === music.id
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium'
                            : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'"
                        >
                          {{ currentMusic?.id === music.id && musicPlaying ? '🔊' : '🎵' }} {{ music.name }}
                        </button>
                      </div>
                    </div>

                    <!-- Focus Timer -->
                    <div class="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6">
                      <div class="text-center mb-4">
                        <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Focus Time</div>
                        <div class="text-5xl font-bold text-gray-900 dark:text-white mb-2">
                          {{ formatFocusTime(focusTimeRemaining) }}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                          Recommended: {{ task.focusTime || 25 }} minutes
                        </div>
                      </div>

                      <!-- Timer Progress Bar -->
                      <div class="relative h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                        <div
                            class="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-1000"
                            :style="{ width: getFocusProgress(task) + '%' }"
                        ></div>
                      </div>

                      <!-- Timer Controls -->
                      <div class="flex items-center justify-center space-x-3">
                        <button
                            v-if="!focusTimerRunning"
                            @click="startFocusTimer(task)"
                            class="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold transition-all flex items-center space-x-2"
                        >
                          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                          </svg>
                          <span>Start Focus</span>
                        </button>

                        <button
                            v-else
                            @click="pauseFocusTimer"
                            class="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold transition-all flex items-center space-x-2"
                        >
                          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                          </svg>
                          <span>Pause</span>
                        </button>

                        <button
                            @click="resetFocusTimer(task)"
                            class="px-4 py-3 rounded-xl bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 transition-all"
                            title="Reset Timer"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <!-- Navigation Buttons -->
                    <div class="flex items-center justify-between">
                      <button
                          @click="previousFocusTask"
                          :disabled="currentFocusTaskIndex === 0"
                          class="px-6 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        <span>Previous</span>
                      </button>

                      <span class="text-sm text-gray-600 dark:text-gray-400">
                        {{ currentFocusTaskIndex + 1 }} / {{ selectedDayRoutine.length }}
                      </span>

                      <button
                          @click="nextFocusTask"
                          :disabled="currentFocusTaskIndex === selectedDayRoutine.length - 1"
                          class="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                      >
                        <span>Next</span>
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </template>
            </draggable>
          </div>

          <!-- Won't Do Tasks -->
          <div v-if="wontDoTasks.length > 0 && !focusMode" class="mt-6 bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-800">
            <h3 class="text-lg font-semibold text-orange-900 dark:text-orange-300 mb-4 flex items-center space-x-2">
              <span>🚫</span>
              <span>Won't Do</span>
            </h3>
            <div class="space-y-2">
              <div
                  v-for="(task, index) in wontDoTasks"
                  :key="index"
                  class="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl p-4"
              >
                <div class="flex-1">
                  <p class="font-medium text-gray-900 dark:text-white">{{ task.title }}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ task.wontDoReason }}</p>
                </div>
                <button
                    @click="undoWontDo(index)"
                    class="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors"
                    title="Undo"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Completion State -->
          <div
              v-if="selectedDayRoutine?.length > 0 && selectedDayRoutine?.every(task => task.completed) && !showCompleted"
              class="text-center py-16"
          >
            <div class="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
              <span class="text-6xl">🎉</span>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">All Done!</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">Time to relax and recharge</p>
          </div>
        </div>
      </div>

      <!-- Floating Action Buttons -->
      <div class="fixed bottom-8 right-8 flex flex-col space-y-4 z-30" v-if="!focusMode">
        <!-- Voice Input -->
        <button
            @click="startVoiceInput"
            class="w-14 h-14 rounded-full bg-white dark:bg-slate-800 shadow-2xl border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:scale-110 transition-transform"
            :class="listening ? 'animate-pulse bg-green-500' : ''"
        >
          <svg class="w-6 h-6" :class="listening ? 'text-white' : 'text-gray-700 dark:text-gray-300'" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/>
          </svg>
        </button>

        <!-- Add Task -->
        <button
            @click="openModal('task')"
            class="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform text-white"
        >
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/>
          </svg>
        </button>
      </div>

      <!-- All Modals (keeping your existing modal code with updated styling) -->
      <!-- I'll include key modals here with modern styling -->

      <!-- Add Task Modal -->
      <!-- Add Task Modal -->
      <div v-if="modalOpen" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full my-8 flex flex-col max-h-[calc(100vh-4rem)]">
          <!-- Modal Header - Fixed at top -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-3xl sticky top-0 z-10">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">Add New Task</h3>
            <button
                @click="closeModal"
                class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Modal Body - Scrollable -->
          <div class="flex-1 overflow-y-auto px-6 py-6">
            <div class="space-y-5">
              <!-- Task Name -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Task Name
                </label>
                <input
                    v-model="newTask.title"
                    type="text"
                    class="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="What needs to be done?"
                    required
                />
              </div>

              <!-- Reminder DateTime -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Set Reminder
                </label>
                <input
                    v-model="newTask.reminder.datetime"
                    type="datetime-local"
                    class="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <!-- Recurring Toggle -->
              <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-xl">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ newTask.type === 'recurring' ? 'Recurring Task' : 'One-Time Task' }}
          </span>
                <button
                    type="button"
                    @click="toggleRecurring"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    :class="newTask.type === 'recurring' ? 'bg-indigo-600' : 'bg-gray-300'"
                >
            <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="newTask.type === 'recurring' ? 'translate-x-6' : 'translate-x-1'"
            ></span>
                </button>
              </div>

              <!-- Advanced Options Toggle -->
              <button
                  type="button"
                  @click="showAdvanced = !showAdvanced"
                  class="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">Advanced Options</span>
                <svg
                    class="w-5 h-5 transition-transform"
                    :class="showAdvanced ? 'rotate-180' : ''"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              <!-- Advanced Options -->
              <div v-if="showAdvanced" class="space-y-5 pt-4 border-t border-gray-200 dark:border-slate-700">
                <!-- Select Days -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Select Days
                  </label>
                  <div class="grid grid-cols-7 gap-2">
                    <label
                        v-for="(day, index) in days"
                        :key="index"
                        class="flex flex-col items-center cursor-pointer"
                    >
                      <input
                          type="checkbox"
                          :value="day"
                          v-model="newTask.selectedDays"
                          class="hidden"
                      />
                      <div
                          class="w-full aspect-square rounded-xl flex items-center justify-center text-xs font-medium transition-all"
                          :class="newTask.selectedDays.includes(day)
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'"
                      >
                        {{ day.day }}
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Focus Time Duration -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Focus Time (minutes)
                  </label>
                  <div class="flex items-center space-x-4">
                    <input
                        v-model.number="newTask.focusTime"
                        type="number"
                        min="5"
                        max="120"
                        step="5"
                        class="w-32 px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                    <div class="flex items-center space-x-2">
                      <button
                          type="button"
                          @click="newTask.focusTime = 15"
                          class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        15m
                      </button>
                      <button
                          type="button"
                          @click="newTask.focusTime = 25"
                          class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        25m
                      </button>
                      <button
                          type="button"
                          @click="newTask.focusTime = 45"
                          class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        45m
                      </button>
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Set the recommended focus duration for this task (useful in Focus Mode)
                  </p>
                </div>

                <!-- Labels -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Labels
                  </label>
                  <input
                      v-model="newTask.labels"
                      type="text"
                      class="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Work, Personal, Urgent..."
                  />
                </div>

                <!-- Notes -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                      v-model="newTask.notes"
                      rows="4"
                      class="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      placeholder="Add additional details..."
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Submit Buttons - Fixed at bottom -->
          <div class="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-b-3xl sticky bottom-0">
            <button
                type="button"
                @click="closeModal"
                class="px-6 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
                @click="addNewTask"
                type="button"
                class="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold transition-all transform hover:scale-105 shadow-lg"
            >
              Add Task
            </button>
          </div>
        </div>
      </div>
      <!-- Task-Specific Focus Mode Modal -->
      <div v-if="taskFocusModeOpen" class="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full my-8 flex flex-col max-h-[calc(100vh-4rem)]">
          <!-- Close Button - Fixed at top -->
          <div class="flex items-center justify-end px-6 py-4 flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-3xl sticky top-0 z-10">
            <button
                @click="closeTaskFocusMode"
                class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Focus Mode Content - Scrollable -->
          <div class="flex-1 overflow-y-auto px-6 pb-6">
            <!-- Task Title -->
            <div class="text-center mb-6">
              <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">Focusing on</div>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
                {{ currentFocusTask?.title }}
              </h2>
            </div>

            <!-- Music Player Section -->
            <div class="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-6 mb-6">
              <div class="flex items-center justify-between mb-4">
          <span class="text-lg font-semibold text-gray-800 dark:text-white flex items-center space-x-2">
            <span>🎵</span>
            <span>Focus Music</span>
          </span>
                <button
                    @click="musicPlaying ? pauseMusic() : playMusic(currentMusic || availableMusic[0])"
                    class="p-3 rounded-xl transition-all shadow-lg"
                    :class="musicPlaying
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'"
                >
                  <svg v-if="!musicPlaying" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                  </svg>
                  <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <button
                    v-for="music in availableMusic"
                    :key="music.id"
                    @click="playMusic(music)"
                    class="text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
                    :class="currentMusic?.id === music.id
              ? 'bg-indigo-600 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 shadow'"
                >
                  <div class="flex items-center space-x-2">
                    <span class="text-lg">{{ currentMusic?.id === music.id && musicPlaying ? '🔊' : '🎵' }}</span>
                    <span>{{ music.name }}</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Timer Section -->
            <div class="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-8 mb-6">
              <div class="text-center mb-6">
                <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Focus Time</div>
                <div class="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-3">
                  {{ formatFocusTime(focusTimeRemaining) }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  Goal: {{ currentFocusTask?.focusTime || 25 }} minutes
                </div>
              </div>

              <!-- Timer Progress Bar -->
              <div class="relative h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
                <div
                    class="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-1000"
                    :style="{ width: getFocusProgress(currentFocusTask) + '%' }"
                >
                  <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>

              <!-- Timer Controls -->
              <div class="flex items-center justify-center space-x-4">
                <button
                    v-if="!focusTimerRunning"
                    @click="startFocusTimer(currentFocusTask)"
                    class="px-8 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold transition-all flex items-center space-x-3 shadow-xl transform hover:scale-105"
                >
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                  </svg>
                  <span>Start Focus Session</span>
                </button>

                <button
                    v-else
                    @click="pauseFocusTimer"
                    class="px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold transition-all flex items-center space-x-3 shadow-xl transform hover:scale-105"
                >
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  <span>Pause</span>
                </button>

                <button
                    @click="resetFocusTimer(currentFocusTask)"
                    class="px-6 py-4 rounded-2xl bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 transition-all shadow-lg"
                    title="Reset Timer"
                >
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Focus Tips -->
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800 mb-6">
              <div class="flex items-start space-x-3">
                <span class="text-2xl">💡</span>
                <div class="flex-1">
                  <h4 class="font-semibold text-blue-900 dark:text-blue-300 mb-2">Focus Tips</h4>
                  <ul class="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                    <li>• Put your phone on silent mode</li>
                    <li>• Close unnecessary browser tabs</li>
                    <li>• Take short breaks every 25 minutes</li>
                    <li>• Stay hydrated during focus sessions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Complete Task Button - Fixed at bottom -->
          <div class="px-6 py-4 flex-shrink-0 bg-white dark:bg-slate-800 rounded-b-3xl sticky bottom-0">
            <button
                @click="completeTaskFromFocus"
                class="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold transition-all shadow-xl transform hover:scale-105"
            >
              Mark as Complete & Exit Focus
            </button>
          </div>
        </div>
      </div>
      <!-- Treasure Unlock Modal -->
      <div v-if="showTreasureModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-full opacity-20">
            <div class="absolute top-10 left-10 w-20 h-20 bg-white rounded-full animate-ping"></div>
            <div class="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full animate-ping delay-1000"></div>
          </div>

          <div class="relative z-10">
            <div class="text-8xl mb-6 animate-bounce">🎁</div>
            <h2 class="text-4xl font-bold text-white mb-4">Treasure Unlocked!</h2>
            <p class="text-xl text-white/90 mb-8">You completed 5+ tasks today! 🎉</p>

            <div class="bg-white/20 rounded-2xl p-6 mb-6 backdrop-blur-sm">
              <p class="text-white font-semibold mb-4">Choose Your Reward:</p>
              <div class="grid grid-cols-2 gap-4">
                <button
                    @click="playMiniGame"
                    class="p-4 bg-white rounded-xl hover:scale-105 transition-transform shadow-lg"
                >
                  <div class="text-4xl mb-2">🎮</div>
                  <div class="text-sm font-bold text-gray-800">Play Game</div>
                  <div class="text-xs text-gray-600">Quick break game</div>
                </button>

                <button
                    @click="takeBreak"
                    class="p-4 bg-white rounded-xl hover:scale-105 transition-transform shadow-lg"
                >
                  <div class="text-4xl mb-2">☕</div>
                  <div class="text-sm font-bold text-gray-800">Take Break</div>
                  <div class="text-xs text-gray-600">Relax & recharge</div>
                </button>

                <button
                    @click="viewStats"
                    class="p-4 bg-white rounded-xl hover:scale-105 transition-transform shadow-lg"
                >
                  <div class="text-4xl mb-2">📊</div>
                  <div class="text-sm font-bold text-gray-800">View Stats</div>
                  <div class="text-xs text-gray-600">See your progress</div>
                </button>

                <button
                    @click="continueWorking"
                    class="p-4 bg-white rounded-xl hover:scale-105 transition-transform shadow-lg"
                >
                  <div class="text-4xl mb-2">💪</div>
                  <div class="text-sm font-bold text-gray-800">Keep Going</div>
                  <div class="text-xs text-gray-600">More tasks!</div>
                </button>
              </div>
            </div>

            <button
                @click="showTreasureModal = false"
                class="px-8 py-3 bg-white text-orange-600 font-bold rounded-xl hover:scale-105 transition-transform shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <!-- Rank Up Modal -->
      <div v-if="showRankUpModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-full" :class="`bg-gradient-to-br ${newRankAchieved?.color} opacity-10`"></div>

          <div class="relative z-10">
            <div class="text-8xl mb-6 animate-bounce">{{ newRankAchieved?.icon }}</div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Rank Up!</h2>
            <p class="text-xl text-gray-600 dark:text-gray-300 mb-6">
              You've reached <span class="font-bold text-transparent bg-clip-text" :class="`bg-gradient-to-r ${newRankAchieved?.color}`">{{ newRankAchieved?.name }}</span>
            </p>

            <div class="bg-gray-100 dark:bg-slate-700 rounded-2xl p-6 mb-6">
              <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Points</div>
              <div class="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{{ userRank.points }}</div>
            </div>

            <button
                @click="showRankUpModal = false"
                class="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Continue
            </button>
          </div>
        </div>
      </div>

      <!-- Day Wasted Warning Modal -->
      <div v-if="isDayWasted && !isDayProductive" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-gradient-to-br from-red-600 to-orange-600 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div class="text-8xl mb-6">⚠️</div>
          <h2 class="text-3xl font-bold text-white mb-4">Day Wasted!</h2>
          <p class="text-lg text-white/90 mb-2">You didn't complete 5 tasks today.</p>
          <p class="text-xl font-bold text-white mb-6">Streak Lost: -{{ streak }} 🔥</p>

          <div class="bg-white/20 rounded-2xl p-6 mb-6 backdrop-blur-sm">
            <p class="text-white text-sm mb-3">💡 Remember: Just like a job...</p>
            <ul class="text-left text-white/90 text-sm space-y-2">
              <li>✅ Complete tasks = Get paid (points)</li>
              <li>❌ Skip work = Lose your position (rank drop)</li>
              <li>🎯 Consistency = Promotions (rank up)</li>
            </ul>
          </div>

          <button
              @click="isDayWasted = false; resetDayStatus()"
              class="px-8 py-3 bg-white text-red-600 font-bold rounded-xl hover:scale-105 transition-transform shadow-lg"
          >
            I'll Do Better Tomorrow
          </button>
        </div>
      </div>

      <!-- Voice Input Modal -->
      <div v-if="listening" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative">
          <button
              @click="cancelVoiceInput"
              class="absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>

          <div class="mb-6">
            <div class="w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center animate-pulse">
              <svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/>
              </svg>
            </div>
          </div>

          <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Listening...</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">Speak your task clearly</p>

          <div class="bg-gray-50 dark:bg-slate-700 rounded-2xl p-4 min-h-[80px] flex items-center justify-center">
            <p class="text-lg font-medium text-indigo-600 dark:text-indigo-400">
              {{ liveTranscript || 'Waiting for input...' }}
            </p>
          </div>

          <!-- Visual Waveform -->
          <div class="flex justify-center space-x-1 mt-6">
            <div class="w-1 h-8 bg-green-400 rounded-full animate-pulse"></div>
            <div class="w-1 h-12 bg-green-400 rounded-full animate-pulse delay-75"></div>
            <div class="w-1 h-6 bg-green-400 rounded-full animate-pulse delay-150"></div>
            <div class="w-1 h-10 bg-green-400 rounded-full animate-pulse delay-225"></div>
            <div class="w-1 h-8 bg-green-400 rounded-full animate-pulse delay-300"></div>
          </div>
        </div>
      </div>

      <!-- Success Animation -->
      <div v-if="showFullScreenAnimation" class="fixed inset-0 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 z-50 flex items-center justify-center">
        <div class="text-center space-y-8">
          <div class="relative">
            <div class="w-32 h-32 mx-auto bg-white rounded-full flex items-center justify-center animate-bounce">
              <span class="text-6xl">🎉</span>
            </div>
            <div class="absolute inset-0 w-32 h-32 mx-auto bg-white rounded-full animate-ping opacity-20"></div>
          </div>

          <div>
            <h1 class="text-5xl font-bold text-white mb-4">All Done!</h1>
            <p class="text-2xl text-white/90 mb-2">{{ streak }} Day Streak 🔥</p>
            <p class="text-lg text-white/80">You're on fire! Keep it going!</p>
          </div>

          <button
              @click="closeFullScreenAnimation"
              class="px-8 py-4 bg-white text-green-600 font-bold rounded-2xl shadow-2xl hover:scale-105 transition-transform"
          >
            Continue
          </button>
        </div>
      </div>

      <!-- Keep your existing modals (timer, transfer, won't do, task detail, YouTube) -->
      <!-- I've kept the structure but you can apply the modern styling pattern -->

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { auth } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import draggable from "vuedraggable";
import { db } from '@/firebaseConfig';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import axios from 'axios';
import data from '@/data.json';

// Reactive State
const isLoading = ref(true);
const focusMode = ref(false);

const modalOpen = ref(false);
const showAdvanced = ref(false);
const selectedDayIndex = ref(-1);
const selectedDayRoutine = ref([]);
const days = ref(data.days);
const userId = ref(null);
const userCredits = ref(0);
const hasPaid = ref(false);
const showPaymentModal = ref(false);
const streak = ref(0);
const listening = ref(false);
const liveTranscript = ref('');
const smartPrompt = ref('');
const showCompleted = ref(false);
const completedTaskCount = computed(() => {
  return selectedDayRoutine.value?.filter(task => task.completed).length || 0;
});

const newTask = ref({
  title: '',
  time: '',
  priority: 'low',
  labels: [],
  notes: '',
  selectedDays: [],
  position: 0,
  type: 'recurring',
  reminder: { datetime: '', repeat: '' },
  focusTime: 25
});

const currentDate = ref('');
const activeLabels = ref([]);
const wontDoTasks = ref([]);
const iconVisibility = ref({});
const showFullScreenAnimation = ref(false);
const handwritingInput = ref(null);

// Focus Timer State
const focusTimerRunning = ref(false);
const focusTimeRemaining = ref(0);
const focusTimerInterval = ref(null);
const focusStartTime = ref(null);

// Task-Specific Focus Mode
const taskFocusModeOpen = ref(false);
const currentFocusTask = ref(null);
const currentFocusTaskIndex = ref(null);

// Gamification State
const userRank = ref({
  name: 'Bronze I',
  level: 1,
  points: 0,
  pointsToNextRank: 100
});

const completedTasksToday = ref(0);
const isDayProductive = ref(false);
const isDayWasted = ref(false);
const treasureUnlocked = ref(false);
const showTreasureModal = ref(false);
const showRankUpModal = ref(false);
const newRankAchieved = ref(null);

// Music Player State
const musicPlaying = ref(false);
const currentMusic = ref(null);
const availableMusic = ref([
  { id: 1, name: 'Forest Ambience', url: 'https://cdn.pixabay.com/audio/2022/05/13/audio_2b60d6a0f5.mp3', duration: 180 },
  { id: 2, name: 'Ocean Waves', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_4f838dd4f6.mp3', duration: 180 },
  { id: 3, name: 'Rain Sounds', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_bb630cc098.mp3', duration: 180 },
  { id: 4, name: 'Meditation Bell', url: 'https://cdn.pixabay.com/audio/2021/08/04/audio_bb630cc098.mp3', duration: 180 },
  { id: 5, name: 'White Noise', url: 'https://cdn.pixabay.com/audio/2022/10/07/audio_ca11c5c8d0.mp3', duration: 180 }
]);
const audioPlayer = ref(null);
// Add this watcher after your other watchers (around line 2800)
watch([userId, selectedDayIndex], async ([newUserId, newDayIndex]) => {
  if (newUserId && newDayIndex !== -1) {
    console.log('Fetching tasks for user:', newUserId, 'day:', newDayIndex);
    await fetchSelectedDayRoutine();
    await fetchWontDoTasks();
  }
}, { immediate: true });
// Rank System (similar to PUBG Mobile)
const ranks = [
  { name: 'Bronze I', level: 1, minPoints: 0, maxPoints: 99, icon: '🥉', color: 'from-orange-700 to-orange-900' },
  { name: 'Bronze II', level: 2, minPoints: 100, maxPoints: 199, icon: '🥉', color: 'from-orange-600 to-orange-800' },
  { name: 'Bronze III', level: 3, minPoints: 200, maxPoints: 299, icon: '🥉', color: 'from-orange-500 to-orange-700' },
  { name: 'Silver I', level: 4, minPoints: 300, maxPoints: 399, icon: '🥈', color: 'from-gray-400 to-gray-600' },
  { name: 'Silver II', level: 5, minPoints: 400, maxPoints: 499, icon: '🥈', color: 'from-gray-300 to-gray-500' },
  { name: 'Silver III', level: 6, minPoints: 500, maxPoints: 599, icon: '🥈', color: 'from-gray-200 to-gray-400' },
  { name: 'Gold I', level: 7, minPoints: 600, maxPoints: 699, icon: '🥇', color: 'from-yellow-600 to-yellow-800' },
  { name: 'Gold II', level: 8, minPoints: 700, maxPoints: 799, icon: '🥇', color: 'from-yellow-500 to-yellow-700' },
  { name: 'Gold III', level: 9, minPoints: 800, maxPoints: 999, icon: '🥇', color: 'from-yellow-400 to-yellow-600' },
  { name: 'Platinum I', level: 10, minPoints: 1000, maxPoints: 1199, icon: '💎', color: 'from-cyan-600 to-cyan-800' },
  { name: 'Platinum II', level: 11, minPoints: 1200, maxPoints: 1399, icon: '💎', color: 'from-cyan-500 to-cyan-700' },
  { name: 'Platinum III', level: 12, minPoints: 1400, maxPoints: 1699, icon: '💎', color: 'from-cyan-400 to-cyan-600' },
  { name: 'Diamond I', level: 13, minPoints: 1700, maxPoints: 1999, icon: '💠', color: 'from-blue-600 to-purple-600' },
  { name: 'Diamond II', level: 14, minPoints: 2000, maxPoints: 2299, icon: '💠', color: 'from-blue-500 to-purple-500' },
  { name: 'Diamond III', level: 15, minPoints: 2300, maxPoints: 2699, icon: '💠', color: 'from-blue-400 to-purple-400' },
  { name: 'Crown', level: 16, minPoints: 2700, maxPoints: 3199, icon: '👑', color: 'from-purple-600 to-pink-600' },
  { name: 'Ace', level: 17, minPoints: 3200, maxPoints: 3999, icon: '⭐', color: 'from-pink-500 to-red-500' },
  { name: 'Conqueror', level: 18, minPoints: 4000, maxPoints: 999999, icon: '🏆', color: 'from-red-600 to-orange-600' }
];

// Milestone data
const milestones = ref([
  { percent: 0, icon: '🌱' },
  { percent: 25, icon: '🌿' },
  { percent: 50, icon: '🌳' },
  { percent: 75, icon: '🌲' },
  { percent: 100, icon: '🏔️' }
]);

// Days left in year
const daysLeftInYear = computed(() => {
  const today = new Date();
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  const diffTime = endOfYear - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Year countdown in detailed format
const timeLeftInYear = computed(() => {
  const now = new Date();
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  const diff = endOfYear - now;

  const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${weeks}w ${days}d ${hours}h ${minutes}m`;
});

// Gamification Functions
const awardPoints = async (points, reason = 'task completion') => {
  userRank.value.points += points;

  // Check for rank up
  const currentRankIndex = ranks.findIndex(r => r.name === userRank.value.name);
  const nextRank = ranks[currentRankIndex + 1];

  if (nextRank && userRank.value.points >= nextRank.minPoints) {
    userRank.value = {
      name: nextRank.name,
      level: nextRank.level,
      points: userRank.value.points,
      pointsToNextRank: nextRank.maxPoints - userRank.value.points,
      icon: nextRank.icon,
      color: nextRank.color
    };

    newRankAchieved.value = nextRank;
    showRankUpModal.value = true;
    speak(`Congratulations! You've reached ${nextRank.name}!`);
  }

  // Save to Firestore
  await saveUserRank();

  console.log(`+${points} points for ${reason}. Total: ${userRank.value.points}`);
};

const deductPoints = async (points, reason = 'task failure') => {
  userRank.value.points = Math.max(0, userRank.value.points - points);

  // Check for rank down
  const currentRankIndex = ranks.findIndex(r => r.name === userRank.value.name);
  const previousRank = ranks[currentRankIndex - 1];

  if (previousRank && userRank.value.points < ranks[currentRankIndex].minPoints) {
    userRank.value = {
      name: previousRank.name,
      level: previousRank.level,
      points: userRank.value.points,
      pointsToNextRank: previousRank.maxPoints - userRank.value.points,
      icon: previousRank.icon,
      color: previousRank.color
    };

    speak(`Rank decreased to ${previousRank.name}. Stay focused!`);
  }

  // Save to Firestore
  await saveUserRank();

  console.log(`-${points} points for ${reason}. Total: ${userRank.value.points}`);
};

const saveUserRank = async () => {
  if (!userId.value) return;

  try {
    const rankDocRef = doc(db, 'userRanks', userId.value);
    await setDoc(rankDocRef, {
      ...userRank.value,
      updatedAt: serverTimestamp()
    });
    console.log('User rank saved successfully');
  } catch (error) {
    console.warn('Could not save user rank (check Firestore permissions):', error);
    // Continue without crashing - rank will still work in local state
  }
};

const loadUserRank = async () => {
  if (!userId.value) return;

  try {
    const rankDocRef = doc(db, 'userRanks', userId.value);
    const rankSnapshot = await getDoc(rankDocRef);

    if (rankSnapshot.exists()) {
      const data = rankSnapshot.data();
      userRank.value = {
        name: data.name,
        level: data.level,
        points: data.points,
        pointsToNextRank: data.pointsToNextRank,
        icon: data.icon,
        color: data.color
      };
    } else {
      // Initialize new user with Bronze I
      userRank.value = {
        name: 'Bronze I',
        level: 1,
        points: 0,
        pointsToNextRank: 100,
        icon: '🥉',
        color: 'from-orange-700 to-orange-900'
      };
      await saveUserRank();
    }
  } catch (error) {
    console.warn('Could not load user rank, using default:', error);
    // Set default rank without saving
    userRank.value = {
      name: 'Bronze I',
      level: 1,
      points: 0,
      pointsToNextRank: 100,
      icon: '🥉',
      color: 'from-orange-700 to-orange-900'
    };
  }
};

const checkDailyProductivity = async () => {
  const todayIndex = new Date().getDay();
  if (selectedDayIndex.value !== todayIndex) return;

  const completed = completedTaskCount.value;

  if (completed >= 5) {
    isDayProductive.value = true;
    isDayWasted.value = false;

    if (!treasureUnlocked.value) {
      treasureUnlocked.value = true;
      showTreasureModal.value = true;
      await awardPoints(50, 'productive day (5+ tasks)');
      speak("Congratulations! You've unlocked the treasure for completing 5 tasks!");
    }
  } else {
    isDayProductive.value = false;
  }
};

const checkEndOfDay = async () => {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59);

  if (now >= endOfDay && selectedDayIndex.value === now.getDay()) {
    if (completedTaskCount.value < 5) {
      isDayWasted.value = true;
      await deductPoints(30, 'unproductive day (<5 tasks)');

      // Lose streak
      streak.value = Math.max(0, streak.value - 1);
      const streakDocRef = doc(db, 'streaks', userId.value);
      await updateDoc(streakDocRef, {
        streak: streak.value,
        updatedAt: serverTimestamp()
      });

      speak("Day wasted. You lost your streak for not completing 5 tasks.");
    }
  }
};

const resetDayStatus = () => {
  isDayWasted.value = false;
  isDayProductive.value = false;
  treasureUnlocked.value = false;
};

// Treasure Reward Actions
const playMiniGame = () => {
  showTreasureModal.value = false;
  alert('🎮 Mini-game coming soon! For now, enjoy your achievement!');
  // TODO: Implement mini-game (could be a simple memory game, etc.)
};

const takeBreak = () => {
  showTreasureModal.value = false;
  speak("Take a well-deserved break. You've earned it!");
  alert('☕ Enjoy your break! Come back refreshed for more tasks.');
};

const viewStats = () => {
  showTreasureModal.value = false;
  alert(`📊 Your Stats:\n\n🏆 Rank: ${userRank.value.name}\n⚡ Points: ${userRank.value.points}\n🔥 Streak: ${streak.value} days\n✅ Tasks Today: ${completedTaskCount.value}`);
};

const continueWorking = () => {
  showTreasureModal.value = false;
  speak("Great attitude! Let's keep the momentum going!");
};

// Music Player Functions
const playMusic = (music) => {
  if (!audioPlayer.value) {
    audioPlayer.value = new Audio();
  }

  if (currentMusic.value?.id === music.id && musicPlaying.value) {
    pauseMusic();
    return;
  }

  currentMusic.value = music;
  audioPlayer.value.src = music.url;
  audioPlayer.value.loop = true;
  audioPlayer.value.volume = 0.3;
  audioPlayer.value.play();
  musicPlaying.value = true;

  console.log(`Playing: ${music.name}`);
};

const pauseMusic = () => {
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    musicPlaying.value = false;
  }
};

const stopMusic = () => {
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value.currentTime = 0;
    musicPlaying.value = false;
    currentMusic.value = null;
  }
};

// Task Focus Mode Functions
const openTaskFocusMode = (index) => {
  currentFocusTaskIndex.value = index;
  currentFocusTask.value = { ...selectedDayRoutine.value[index] };
  taskFocusModeOpen.value = true;

  // Initialize timer with task's focus time
  const focusMinutes = currentFocusTask.value.focusTime || 25;
  focusTimeRemaining.value = focusMinutes * 60;

  // Close any dropdown menus
  iconVisibility.value = {};
};

const closeTaskFocusMode = () => {
  // Stop timer and music
  pauseFocusTimer();
  stopMusic();

  // Reset state
  taskFocusModeOpen.value = false;
  currentFocusTask.value = null;
  currentFocusTaskIndex.value = null;
  focusTimeRemaining.value = 0;
};

const completeTaskFromFocus = async () => {
  if (currentFocusTaskIndex.value !== null) {
    await toggleTaskCompletion(currentFocusTaskIndex.value);
  }
  closeTaskFocusMode();
};

// Focus Mode Functions
const toggleFocusMode = () => {
  focusMode.value = !focusMode.value;
  if (focusMode.value) {
    currentFocusTaskIndex.value = 0;
  }
};

const nextFocusTask = () => {
  if (currentFocusTaskIndex.value < selectedDayRoutine.value.length - 1) {
    currentFocusTaskIndex.value++;
  }
};

const previousFocusTask = () => {
  if (currentFocusTaskIndex.value > 0) {
    currentFocusTaskIndex.value--;
  }
};

// Helper Functions
const formatDateLong = (date) => {
  const d = new Date();
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return "";
  const options = { month: "short", day: "numeric" };
  return new Date(dateStr).toLocaleDateString("en-US", options);
};

const formatTime = (time) => {
  if (!time) return "";
  const [hours, minutes] = time.split(':');
  const amPm = parseInt(hours) >= 12 ? 'PM' : 'AM';
  const formattedHours = parseInt(hours) % 12 || 12;
  return `${formattedHours}:${minutes} ${amPm}`;
};

const isToday = (index) => {
  return index === new Date().getDay();
};

const isSelected = (index) => {
  return index === selectedDayIndex.value;
};

const getTasksForDay = (index) => {
  // This would need to be implemented based on your data structure
  return 0;
};

const calculateCompletionPercentage = () => {
  const todayIndex = new Date().getDay();
  if (selectedDayIndex.value !== todayIndex) {
    return 0;
  }

  if (!selectedDayRoutine.value || selectedDayRoutine.value.length === 0) return 0;

  const totalTasks = selectedDayRoutine.value.length + wontDoTasks.value.length;
  const completedTasks = selectedDayRoutine.value.filter(task => task.completed).length;

  return totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
};

const toggleRecurring = () => {
  newTask.value.type = newTask.value.type === 'recurring' ? 'one-time' : 'recurring';
};

const autoResizeTextarea = (event) => {
  event.target.style.height = 'auto';
  event.target.style.height = event.target.scrollHeight + 'px';
};

// Modal Functions
const openModal = (type = 'task') => {
  modalOpen.value = true;
};

const closeModal = () => {
  modalOpen.value = false;
  newTask.value = {
    title: '',
    time: '',
    priority: 'low',
    labels: [],
    notes: '',
    selectedDays: [],
    position: 0,
    type: 'recurring',
    reminder: { datetime: '', repeat: '' },
    focusTime: 25
  };
};

// Task Detail Modal State
const taskDetailModalOpen = ref(false);
const taskDetail = ref({});

const openTaskDetailModal = (task) => {
  taskDetail.value = task;
  taskDetailModalOpen.value = true;
};

const closeTaskDetailModal = () => {
  taskDetailModalOpen.value = false;
  taskDetail.value = {};
};

// Transfer Modal State
const transferModalOpen = ref(false);
const selectedTransferTaskIndex = ref(null);
const selectedTransferDay = ref(null);

const openTransferModal = (index) => {
  selectedTransferTaskIndex.value = index;
  transferModalOpen.value = true;
};

const closeTransferModal = () => {
  transferModalOpen.value = false;
  selectedTransferTaskIndex.value = null;
  selectedTransferDay.value = null;
};

const transferTask = async () => {
  if (!userId.value || selectedTransferTaskIndex.value === null || selectedTransferDay.value === null) {
    console.warn("Invalid task or day selection");
    return;
  }

  const currentDayIndex = selectedDayIndex.value;
  const targetDayIndex = selectedTransferDay.value;

  if (currentDayIndex === targetDayIndex) {
    console.warn("Cannot transfer task to the same day");
    return;
  }

  const currentDay = days.value[currentDayIndex].day;
  const targetDay = days.value[targetDayIndex].day;

  const currentDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${currentDay}`);
  const targetDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${targetDay}`);

  try {
    const currentDayDocSnapshot = await getDoc(currentDayDocRef);
    const targetDayDocSnapshot = await getDoc(targetDayDocRef);

    let currentTasks = currentDayDocSnapshot.exists() ? currentDayDocSnapshot.data().tasks : [];
    let targetTasks = targetDayDocSnapshot.exists() ? targetDayDocSnapshot.data().tasks : [];

    const [task] = currentTasks.splice(selectedTransferTaskIndex.value, 1);
    if (!task) return;

    targetTasks.push(task);

    await updateDoc(currentDayDocRef, {
      tasks: currentTasks,
      updatedAt: serverTimestamp()
    });

    await setDoc(targetDayDocRef, {
      tasks: targetTasks,
      updatedAt: serverTimestamp()
    });

    selectedDayRoutine.value = currentTasks;

    console.log(`Task "${task.title}" moved to ${targetDay}`);
    alert(`Task transferred to ${targetDay}`);

    closeTransferModal();
  } catch (error) {
    console.error('Error transferring task:', error);
  }
};

// Won't Do Modal State
const wontDoModalOpen = ref(false);
const wontDoReason = ref("");
const selectedWontDoTaskIndex = ref(null);

const openWontDoModal = (index) => {
  selectedWontDoTaskIndex.value = index;
  wontDoReason.value = "";
  wontDoModalOpen.value = true;
};

const closeWontDoModal = () => {
  wontDoModalOpen.value = false;
  wontDoReason.value = "";
  selectedWontDoTaskIndex.value = null;
};

const markTaskAsWontDo = async () => {
  if (selectedWontDoTaskIndex.value === null) return;

  const task = {
    ...selectedDayRoutine.value[selectedWontDoTaskIndex.value],
    wontDoReason: wontDoReason.value
  };

  selectedDayRoutine.value.splice(selectedWontDoTaskIndex.value, 1);
  wontDoTasks.value.push(task);

  try {
    const wontDoDocRef = doc(db, "wontDoTasks", `${userId.value}_${days.value[selectedDayIndex.value].day}`);
    await setDoc(wontDoDocRef, {
      tasks: wontDoTasks.value,
      updatedAt: serverTimestamp()
    });

    const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days.value[selectedDayIndex.value].day}`);
    await updateDoc(selectedDayDocRef, {
      tasks: selectedDayRoutine.value,
      updatedAt: serverTimestamp()
    });

    console.log("Task marked as 'Won't Do' and saved to Firestore.");
  } catch (error) {
    console.error("Error saving 'Won't Do' task:", error);
  }

  closeWontDoModal();
};

// YouTube Modal State
const youtubeModalOpen = ref(false);
const selectedYouTubeTaskIndex = ref(null);
const youtubeInput = ref('');

const openYouTubeModal = (index) => {
  selectedYouTubeTaskIndex.value = index;
  youtubeInput.value = selectedDayRoutine.value[index].youtubeURL || '';
  youtubeModalOpen.value = true;
};

const closeYouTubeModal = () => {
  youtubeModalOpen.value = false;
  youtubeInput.value = '';
};

const saveYouTubeLink = async () => {
  const index = selectedYouTubeTaskIndex.value;
  const task = selectedDayRoutine.value[index];
  task.youtubeURL = youtubeInput.value;

  const day = days.value[selectedDayIndex.value].day;
  const docRef = doc(db, 'weeklyRoutines', `${userId.value}_${day}`);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return;

  const tasks = docSnap.data().tasks;
  tasks[index] = task;

  await updateDoc(docRef, { tasks });
  selectedDayRoutine.value[index] = task;

  closeYouTubeModal();
};

const extractYouTubeID = (url) => {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
};

// Timer Modal State
const showTimerModal = ref(false);
const selectedTimerDuration = ref(5);

const startTimer = async () => {
  showTimerModal.value = false;
  const now = new Date();
  const endTime = new Date(now.getTime() + selectedTimerDuration.value * 60000);

  const formattedEndTime = endTime.toISOString();
  const formattedText = `${selectedTimerDuration.value} minute timer completed!`;

  const playerId = window.OneSignal?.User?.PushSubscription?.id;

  if (!playerId) {
    alert("OneSignal not initialized");
    return;
  }

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy',
    'Content-Type': 'application/json'
  };

  const notificationData = {
    app_id: "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    include_player_ids: [playerId],
    contents: { en: formattedText },
    headings: { en: "⏰ Timer Finished" },
    send_after: formattedEndTime
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', notificationData, { headers });
    alert(`Timer set for ${selectedTimerDuration.value} minutes! Notification will appear when done.`);
  } catch (error) {
    console.error('Failed to schedule timer:', error);
    alert("Timer scheduling failed.");
  }
};

const closeFullScreenAnimation = () => {
  showFullScreenAnimation.value = false;
  fetchSelectedDayRoutine();
};

// Day Selection Functions
const handleDayTabClick = async (index) => {
  const todayIndex = new Date().getDay();

  if (index !== todayIndex && selectedDayIndex.value !== index) {
    selectedDayIndex.value = index;
    await resetTasksToIncomplete();
  }

  selectedDayIndex.value = index;
  await fetchSelectedDayRoutine();
  await fetchWontDoTasks();
};

const resetTasksToIncomplete = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;

  const selectedDay = days.value[selectedDayIndex.value];
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${selectedDay.day}`);

  try {
    const docSnap = await getDoc(selectedDayDocRef);
    if (!docSnap.exists()) {
      console.warn("No tasks to reset for this day.");
      return;
    }

    const existingTasks = docSnap.data().tasks || [];
    const hasCompletedTasks = existingTasks.some(task => task.completed);

    if (!hasCompletedTasks) {
      console.log(`No completed tasks to reset for ${selectedDay.day}.`);
      return;
    }

    const resetTasks = existingTasks.map(task => ({
      ...task,
      completed: false
    }));

    const todayIndex = new Date().getDay();
    const isPastDay = selectedDayIndex.value < todayIndex;

    await updateDoc(selectedDayDocRef, {
      tasks: resetTasks,
      updatedAt: serverTimestamp(),
      ...(isPastDay && { skipStreakUpdate: true })
    });

    if (days.value[selectedDayIndex.value].day === selectedDay.day) {
      selectedDayRoutine.value = resetTasks;
    }

    console.log(`✅ Tasks for ${selectedDay.day} were reset to incomplete.`);
  } catch (error) {
    console.error("❌ Error resetting tasks:", error);
  }
};

const toggleTaskCompletion = async (index) => {
  const task = { ...selectedDayRoutine.value[index] };
  task.completed = !task.completed;

  if (task.completed) {
    // Award points for completing task
    await awardPoints(10, `completing "${task.title}"`);

    announceNextTask(index);
    const userName = await fetchUserName(userId.value);
    if (userName) {
      await sendNotificationToPlayer(userName, "completed");
    }

    // Check if 5 tasks milestone reached
    await checkDailyProductivity();
  } else {
    // Deduct points for uncompleting task
    await deductPoints(5, `uncompleting "${task.title}"`);
  }

  if (task.type === "one-time") {
    selectedDayRoutine.value.splice(index, 1);
  } else {
    selectedDayRoutine.value.splice(index, 1, task);
  }

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days.value[selectedDayIndex.value].day}`);

  try {
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      let tasks = selectedDayDocSnapshot.data().tasks || [];

      if (task.type === "one-time") {
        tasks = tasks.filter((_, i) => i !== index);
      } else {
        tasks[index] = task;
      }

      if (tasks.length > 0) {
        await updateDoc(selectedDayDocRef, {
          tasks: tasks,
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(selectedDayDocRef);
      }

      console.log("Task completion updated successfully");
    }
  } catch (error) {
    console.error("Error updating task completion:", error);
  }

  checkStreakOnCompletion();
  checkAllTasksCompleted();
  await saveDailyPerformance();
};

const announceNextTask = (completedIndex) => {
  const nextTask = selectedDayRoutine.value.find((task, index) => !task.completed && index !== completedIndex);
  if (nextTask) {
    speak(`Your next task is: ${nextTask.title}.`);
  } else {
    speak("Congratulations! All tasks are complete.");
  }
};

const speak = (text) => {
  if ('speechSynthesis' in window) {
    const message = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(message);
  }
};

const checkAllTasksCompleted = async () => {
  const allCompleted = selectedDayRoutine.value.every(task => task.completed);

  if (allCompleted && selectedDayRoutine.value.length > 0) {
    showFullScreenAnimation.value = true;
    speak("Congratulations! You are free to do whatever you want");
    updateStreakOnCompletion();
    await saveDailyPerformance();

    selectedDayRoutine.value = selectedDayRoutine.value.map(task => {
      if (task.type === "recurring") {
        return { ...task, completed: true };
      }
      return null;
    }).filter(task => task !== null);

    try {
      const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days.value[selectedDayIndex.value].day}`);

      if (selectedDayRoutine.value.length > 0) {
        await updateDoc(selectedDayDocRef, {
          tasks: selectedDayRoutine.value,
          updatedAt: serverTimestamp()
        });
        console.log("✅ One-time tasks removed, recurring tasks reset.");
      } else {
        await deleteDoc(selectedDayDocRef);
        console.log("🗑 All tasks removed. Firestore document deleted.");
      }
    } catch (error) {
      console.error("❌ Error updating Firestore:", error);
    }
  }
};

const updateStreakOnCompletion = async () => {
  if (!userId.value) {
    console.log("No userId, skipping streak update");
    return;
  }

  const today = new Date().toLocaleDateString('en-CA');
  const streakDocRef = doc(db, 'streaks', userId.value);

  try {
    const streakDocSnapshot = await getDoc(streakDocRef);

    if (streakDocSnapshot.exists()) {
      const data = streakDocSnapshot.data();
      const lastCompletionDate = data.lastCompletionDate || null;
      let currentStreak = data.streak || 0;

      if (lastCompletionDate === today) {
        console.log("🛑 Streak already updated today. Skipping...");
        return;
      }

      currentStreak += 1;

      await updateDoc(streakDocRef, {
        streak: currentStreak,
        lastCompletionDate: today,
        updatedAt: serverTimestamp(),
      });

      streak.value = currentStreak;
      console.log(`✅ Streak updated to ${currentStreak}`);
    } else {
      await setDoc(streakDocRef, {
        streak: 1,
        lastCompletionDate: today,
        updatedAt: serverTimestamp()
      });

      streak.value = 1;
      console.log("🔥 New streak started at 1");
    }

    checkForBadges();
  } catch (error) {
    console.error("❌ Error in updateStreakOnCompletion:", error);
  }
};

const checkStreakOnCompletion = () => {
  // Placeholder for streak checking logic
  console.log('Check streak on completion');
};

const checkForBadges = () => {
  const badges = [
    { name: "Seed Starter", days: 1, icon: "🌱" },
    { name: "Sprouting Leaves", days: 3, icon: "🌿" },
    { name: "Small Tree", days: 7, icon: "🌳" },
    { name: "Mature Tree", days: 15, icon: "🌲" },
    { name: "Peak Performer", days: 30, icon: "🏔️" }
  ];

  badges.forEach((badge) => {
    if (streak.value === badge.days) {
      console.log(`Badge unlocked: ${badge.name}`);
    }
  });
};

const saveDailyPerformance = async () => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const docRef = doc(db, 'dailyReports', `${userId.value}_${dateStr}`);

  const completedCount = selectedDayRoutine.value.filter(task => task.completed).length;
  const totalCount = selectedDayRoutine.value.length + wontDoTasks.value.length;

  const streakGained = totalCount > 0 && completedCount === totalCount;

  await setDoc(docRef, {
    userId: userId.value,
    date: dateStr,
    totalTasks: totalCount,
    completedTasks: completedCount,
    streakGained,
    updatedAt: serverTimestamp()
  });

  console.log("✅ Daily performance saved.");
};

const toggleTaskImportance = async (index) => {
  const task = { ...selectedDayRoutine.value[index] };
  task.important = !task.important;

  const voiceMessage = task.important ? 'Marked as important' : 'No longer marked as important';
  speak(voiceMessage);

  selectedDayRoutine.value.splice(index, 1, task);

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days.value[selectedDayIndex.value].day}`);
  const docSnap = await getDoc(selectedDayDocRef);
  if (!docSnap.exists()) return;

  const tasks = docSnap.data().tasks;
  tasks[index] = task;
  await updateDoc(selectedDayDocRef, { tasks });
};

const triggerImageUpload = (index) => {
  const inputElement = document.querySelector(`[data-file-input="${index}"]`);
  if (inputElement) {
    inputElement.click();
  }
};

const handleUpload = async (event, taskIndex) => {
  const file = event.target.files[0];
  if (!file) return;

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    alert('File size must be under 5MB.');
    return;
  }

  const isImage = file.type.startsWith('image/');
  const isDoc = file.type.includes('pdf') || file.type.includes('msword') || file.type.includes('text');

  if (!isImage && !isDoc) {
    alert('Only images or common documents allowed.');
    return;
  }

  const storage = getStorage();
  const path = isImage ? 'task_images' : 'task_files';
  const fileRef = storageRef(storage, `${path}/${userId.value}_${Date.now()}_${file.name}`);

  try {
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);

    const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days.value[selectedDayIndex.value].day}`);
    const docSnap = await getDoc(selectedDayDocRef);
    if (!docSnap.exists()) return;

    const tasks = docSnap.data().tasks;
    if (isImage) {
      tasks[taskIndex].imageURL = downloadURL;
    } else {
      tasks[taskIndex].fileURL = downloadURL;
      tasks[taskIndex].fileName = file.name;
    }

    await updateDoc(selectedDayDocRef, { tasks });
    selectedDayRoutine.value[taskIndex] = tasks[taskIndex];

    alert('File uploaded successfully!');
  } catch (error) {
    console.error('Error uploading file:', error);
    alert('Failed to upload file. Please try again.');
  }
};

const removeTaskAttachment = async (field) => {
  if (!taskDetail.value?.[field]) return;

  const confirmed = confirm(`Are you sure you want to remove this ${field.includes("image") ? "image" : "file"}?`);
  if (!confirmed) return;

  try {
    const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days.value[selectedDayIndex.value].day}`);
    const docSnap = await getDoc(selectedDayDocRef);

    if (docSnap.exists()) {
      const tasks = docSnap.data().tasks;
      const taskIndex = tasks.findIndex(t =>
          t.title === taskDetail.value.title &&
          t.createdAt === taskDetail.value.createdAt
      );

      if (taskIndex !== -1) {
        const url = taskDetail.value[field];

        if (url?.includes('firebase')) {
          const fileRef = storageRef(getStorage(), url);
          await deleteObject(fileRef);
        }

        tasks[taskIndex][field] = null;

        if (field === 'fileURL') {
          tasks[taskIndex].fileName = null;
          tasks[taskIndex].fileType = null;
        }

        await updateDoc(selectedDayDocRef, { tasks });

        selectedDayRoutine.value[taskIndex][field] = null;
        taskDetail.value[field] = null;
        if (field === 'fileURL') {
          taskDetail.value.fileName = null;
          taskDetail.value.fileType = null;
        }

        console.log(`${field} removed.`);
      }
    }
  } catch (error) {
    console.error(`Error removing ${field}:`, error);
  }
};

const undoWontDo = async (index) => {
  const task = wontDoTasks.value.splice(index, 1)[0];
  selectedDayRoutine.value.push(task);

  const wontDoDocRef = doc(db, "wontDoTasks", `${userId.value}_${days.value[selectedDayIndex.value].day}`);
  await setDoc(wontDoDocRef, { tasks: wontDoTasks.value, updatedAt: serverTimestamp() });

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days.value[selectedDayIndex.value].day}`);
  await updateDoc(selectedDayDocRef, {
    tasks: selectedDayRoutine.value,
    updatedAt: serverTimestamp()
  });

  console.log("Task restored from 'Won't Do'");
};

const clearTasksForToday = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;

  const confirmDelete = confirm("Are you sure you want to delete all tasks for today?");
  if (!confirmDelete) return;

  const selectedDay = days.value[selectedDayIndex.value].day;
  const docRef = doc(db, 'weeklyRoutines', `${userId.value}_${selectedDay}`);

  try {
    await deleteDoc(docRef);
    selectedDayRoutine.value = [];
    wontDoTasks.value = [];
    console.log("✅ All tasks deleted for today.");
  } catch (error) {
    console.error("❌ Failed to delete all tasks:", error);
    alert("Something went wrong while deleting tasks.");
  }
};

const toggleLabelHighlight = (label) => {
  const index = activeLabels.value.indexOf(label);
  if (index > -1) {
    activeLabels.value.splice(index, 1);
  } else {
    activeLabels.value.push(label);
  }
};

const toggleIcons = (index) => {
  iconVisibility.value[index] = !iconVisibility.value[index];
};

const getOriginalIndex = (task) => {
  return selectedDayRoutine.value.findIndex(t =>
      t.title === task.title && t.createdAt === task.createdAt
  );
};

const deleteTask = async (index) => {
  const confirmed = confirm("Are you sure you want to delete this task?");
  if (!confirmed) return;

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days.value[selectedDayIndex.value].day}`);

  try {
    selectedDayRoutine.value.splice(index, 1);

    await updateDoc(selectedDayDocRef, {
      tasks: selectedDayRoutine.value,
      updatedAt: serverTimestamp()
    });

    console.log('Task deleted successfully');
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

const handleDragEnd = async () => {
  if (selectedDayIndex.value === -1 || !userId.value) {
    console.error('No selected day or user is not logged in');
    return;
  }

  try {
    const selectedDayDocRef = doc(
        db,
        'weeklyRoutines',
        `${userId.value}_${days.value[selectedDayIndex.value].day}`
    );

    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      await updateDoc(selectedDayDocRef, {
        tasks: selectedDayRoutine.value,
        updatedAt: serverTimestamp(),
      });
      console.log('Task order updated successfully in Firestore');
    } else {
      console.warn('Selected day document does not exist. Creating a new one...');
      await setDoc(selectedDayDocRef, {
        tasks: selectedDayRoutine.value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('New document created and task order saved.');
    }
  } catch (error) {
    console.error('Error updating task order:', error);
  }
};

const scheduleNotification = async (task, reminder) => {
  if (!task || !reminder.date || !reminder.time) {
    console.error("Invalid task or reminder data");
    return;
  }

  const convertTo12HourFormat = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formattedTime = convertTo12HourFormat(reminder.time);
  const scheduledDateTime = new Date(`${reminder.date}T${reminder.time}:00`).toISOString();

  const playerId = window.OneSignal?.User?.PushSubscription?.id;

  if (!playerId) {
    console.error("Player ID not found. Make sure OneSignal is initialized.");
    return;
  }

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy',
    'Content-Type': 'application/json'
  };

  const notificationData = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    "include_player_ids": [playerId],
    "contents": { "en": `${task.title} at ${formattedTime}` },
    "headings": { "en": "Task Reminder" },
    "send_after": scheduledDateTime,
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', notificationData, { headers });
    console.log('Scheduled notification successfully');
    alert(`Task "${task.title}" has been scheduled successfully for ${formattedTime}!`);
  } catch (error) {
    console.error('Error scheduling notification:', error);
    alert("Failed to schedule the task. Please try again.");
  }
};

const fetchUserName = async (userId) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnapshot = await getDoc(userDocRef);

    if (userDocSnapshot.exists()) {
      return userDocSnapshot.data().name;
    } else {
      console.warn('User document not found');
      return 'Unknown User';
    }
  } catch (error) {
    console.error('Error fetching user name:', error);
    return 'Error Fetching User';
  }
};

const sendNotificationToPlayer = async (userName, action) => {
  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy',
    'Content-Type': 'application/json'
  };

  const actionMessages = {
    created: {
      content: `${userName} created a new task!`,
      heading: "New Task Alert"
    },
    completed: {
      content: `${userName} completed a task!`,
      heading: "Task Completed"
    }
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    "include_player_ids": ["121ecc8a-8a68-4c12-8378-d37ae2648c96"],
    "contents": { "en": actionMessages[action]?.content || "An action was performed." },
    "headings": { "en": actionMessages[action]?.heading || "Notification" }
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const addNewTask = async () => {
  if (!userId.value) {
    alert('You must be logged in to add a task');
    return;
  }

  if (newTask.value.title.trim() === '') {
    alert('Task name cannot be empty');
    return;
  }

  const selectedDays =
      newTask.value.selectedDays.length > 0
          ? newTask.value.selectedDays
          : [days.value[selectedDayIndex.value]];

  const labels =
      typeof newTask.value.labels === 'string'
          ? newTask.value.labels.split(',').map(label => label.trim())
          : [];

  const task = {
    title: newTask.value.title.trim(),
    completed: false,
    important: false,
    time: '',
    priority: newTask.value.priority,
    labels: labels,
    notes: newTask.value.notes,
    userId: userId.value,
    type: newTask.value.type,
    focusTime: newTask.value.focusTime || 25, // Default 25 minutes for focus mode
    createdAt: new Date().toISOString()
  };

  // Parse datetime-local input if provided
  if (newTask.value.reminder?.datetime) {
    const dateObj = new Date(newTask.value.reminder.datetime);
    const date = dateObj.toISOString().split('T')[0];
    const time = dateObj.toTimeString().slice(0, 5);

    task.time = time;
    task.reminder = {
      date,
      time,
      repeat: newTask.value.reminder.repeat || ''
    };
  }

  try {
    for (const selectedDay of selectedDays) {
      const selectedDayDocRef = doc(
          db,
          'weeklyRoutines',
          `${userId.value}_${selectedDay.day}`
      );
      const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

      let existingTasks = [];
      if (selectedDayDocSnapshot.exists()) {
        existingTasks = selectedDayDocSnapshot.data().tasks || [];
      }

      const position = parseInt(newTask.value.position, 10);
      existingTasks.splice(position, 0, task);

      await setDoc(selectedDayDocRef, {
        tasks: existingTasks,
        updatedAt: serverTimestamp()
      });

      if (selectedDay.day === days.value[selectedDayIndex.value].day) {
        selectedDayRoutine.value = [...existingTasks];
      }
    }

    if (task.reminder) {
      await scheduleNotification(task, task.reminder);
    }

    newTask.value = {
      title: '',
      time: '',
      priority: 'low',
      labels: [],
      notes: '',
      selectedDays: [],
      position: 0,
      reminder: { datetime: '', repeat: '' },
      type: 'recurring',
      focusTime: 25
    };
    closeModal();

    const userName = await fetchUserName(userId.value);
    if (userName) {
      await sendNotificationToPlayer(userName, "created");
    }
  } catch (error) {
    console.error('Error adding task:', error);
    alert('Failed to add task. Please try again.');
  }
};

// Voice Input
let recognition;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening.value = true;
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    listening.value = false;
  };

  recognition.onend = () => {
    listening.value = false;
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }

    liveTranscript.value = transcript.trim();

    if (event.results[event.results.length - 1].isFinal) {
      newTask.value.title = transcript.trim();
      addNewTask();
      liveTranscript.value = '';
      recognition.stop();
    }
  };
}

const startVoiceInput = () => {
  if (recognition) {
    recognition.start();
  } else {
    alert('Speech recognition not supported in this browser');
  }
};

const cancelVoiceInput = () => {
  if (recognition) recognition.stop();
  listening.value = false;
  liveTranscript.value = '';
};

// Smart Prompt
const submitSmartPrompt = async () => {
  if (!smartPrompt.value.trim()) return;

  isLoading.value = true;

  try {
    await convertPromptToTasks(smartPrompt.value.trim());
    await deductCredit();
    smartPrompt.value = '';
  } catch (error) {
    console.error("❌ Task generation failed:", error);
    alert("Failed to generate tasks.");
  } finally {
    isLoading.value = false;
  }
};

const convertPromptToTasks = async (promptText) => {
  const OPENAI_API_KEY = process.env.VUE_APP_OPENAI_API_KEY;

  if (!hasPaid.value) {
    showPaymentModal.value = true;
    return;
  }

  if (userCredits.value <= 0) {
    showPaymentModal.value = true;
    return;
  }

  try {
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: `You are an intelligent assistant that transforms any list-related idea into a clear, structured checklist. The list can be for anything: routines, travel, shopping, recipes, study, cleaning, or goals.

Your job is to extract only the list items from the input and return them in clean JSON format like this:
{
  "tasks": ["item 1", "item 2", "item 3"]
}

Do not include explanations, formatting, or markdown. Only return the JSON object.

Input: "${promptText}"`
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
    );

    let content = response.data.choices[0].message.content.trim();
    if (content.startsWith("```")) content = content.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(content);
    if (parsed.tasks?.length) {
      await saveGeneratedTasks(parsed.tasks);
    }
  } catch (err) {
    console.error("Failed to convert input to tasks:", err);
    alert("Could not understand your input.");
    throw err;
  }
};

const saveGeneratedTasks = async (tasks) => {
  const today = days.value[selectedDayIndex.value].day;
  const docRef = doc(db, 'weeklyRoutines', `${userId.value}_${today}`);
  const snapshot = await getDoc(docRef);
  const existing = snapshot.exists() ? snapshot.data().tasks || [] : [];

  const formatted = tasks.map((t) => ({
    title: t,
    completed: false,
    type: 'recurring',
    focusTime: 25,
    createdAt: new Date().toISOString()
  }));

  await setDoc(docRef, {
    tasks: [...existing, ...formatted],
    updatedAt: serverTimestamp()
  });

  await fetchSelectedDayRoutine();
  alert(`📝 Added ${formatted.length} tasks from your prompt.`);
};

const triggerHandwritingUpload = () => {
  if (!hasPaid.value) {
    showPaymentModal.value = true;
    return;
  }
  handwritingInput.value.click();
};

const handleHandwritingUpload = async (event) => {
  const file = event.target.files[0];
  const OPENAI_API_KEY = process.env.VUE_APP_OPENAI_API_KEY;

  if (!file) return;

  if (!hasPaid.value) {
    showPaymentModal.value = true;
    return;
  }

  if (userCredits.value <= 0) {
    showPaymentModal.value = true;
    return;
  }

  isLoading.value = true;

  const reader = new FileReader();
  reader.onload = async () => {
    const base64Image = reader.result.split(',')[1];

    try {
      const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `You're an AI handwriting interpreter. Extract all handwritten list items from this image. Ignore logos, backgrounds, printed text, or cartoons. Return only this JSON format: { "tasks": ["item1", "item2", "..."] }. The handwriting may be joined, cursive, or angled.`
                  },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                  }
                ]
              }
            ],
            temperature: 0.3,
            max_tokens: 1000
          },
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
      );

      let raw = response.data.choices[0].message.content.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/```json|```/g, "").trim();
      }

      const parsed = JSON.parse(raw);
      await saveGeneratedTasks(parsed.tasks);
      await deductCredit();
    } catch (err) {
      console.error("❌ Image analysis failed:", err);
      alert("Could not extract tasks. Make sure it's a clear list.");
    } finally {
      isLoading.value = false;
    }
  };

  reader.readAsDataURL(file);
};

const deductCredit = async () => {
  if (!userId.value) return;

  const userDocRef = doc(db, 'users', userId.value);
  const snapshot = await getDoc(userDocRef);
  if (!snapshot.exists()) return;

  const currentCredits = snapshot.data().credits || 0;
  const newCredits = Math.max(currentCredits - 1, 0);
  const stillPaid = newCredits > 0;

  await updateDoc(userDocRef, {
    credits: newCredits,
    hasPaid: stillPaid,
  });

  userCredits.value = newCredits;
  hasPaid.value = stillPaid;

  console.log(`🔻 Deducted 1 credit. New total: ${newCredits}. hasPaid: ${stillPaid}`);
};

const redirectToCheckout = () => {
  // Implement checkout redirect
  console.log('Redirect to checkout');
};

// Focus Timer Functions
const formatFocusTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getFocusProgress = (task) => {
  const totalTime = (task.focusTime || 25) * 60;
  if (focusTimeRemaining.value === 0) return 0;
  return Math.max(0, Math.min(100, ((totalTime - focusTimeRemaining.value) / totalTime) * 100));
};

const startFocusTimer = (task) => {
  const totalSeconds = (task.focusTime || 25) * 60;

  if (focusTimeRemaining.value === 0) {
    focusTimeRemaining.value = totalSeconds;
  }

  focusTimerRunning.value = true;
  focusStartTime.value = Date.now();

  focusTimerInterval.value = setInterval(() => {
    if (focusTimeRemaining.value > 0) {
      focusTimeRemaining.value--;
    } else {
      completeFocusSession(task);
    }
  }, 1000);
};

const pauseFocusTimer = () => {
  focusTimerRunning.value = false;
  if (focusTimerInterval.value) {
    clearInterval(focusTimerInterval.value);
    focusTimerInterval.value = null;
  }
};

const resetFocusTimer = (task) => {
  pauseFocusTimer();
  focusTimeRemaining.value = (task.focusTime || 25) * 60;
};

const completeFocusSession = (task) => {
  pauseFocusTimer();

  // Play completion sound or notification
  speak(`Great job! You completed a ${task.focusTime || 25} minute focus session on ${task.title}`);

  // Show celebration
  const shouldComplete = confirm(`🎉 Focus session complete!\n\nYou stayed focused on "${task.title}" for ${task.focusTime || 25} minutes.\n\nMark this task as complete?`);

  if (shouldComplete && currentFocusTaskIndex.value !== null) {
    toggleTaskCompletion(currentFocusTaskIndex.value);
    closeTaskFocusMode();
  } else {
    focusTimeRemaining.value = 0;
  }
};

// Fetch Functions
const fetchSelectedDayRoutine = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;

  const selectedDay = days.value[selectedDayIndex.value];
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${selectedDay.day}`);

  try {
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      let tasks = selectedDayDocSnapshot.data().tasks || [];

      const isPastDay = new Date(selectedDay.date) < new Date(getTodayDate());

      if (isPastDay) {
        tasks = tasks.map(task => ({
          ...task,
          completed: false
        }));

        await updateDoc(selectedDayDocRef, {
          tasks: tasks,
          updatedAt: serverTimestamp()
        });
      }

      selectedDayRoutine.value = tasks;
    } else {
      selectedDayRoutine.value = [];
    }
  } catch (error) {
    console.error('Error fetching tasks for the selected day:', error);
    selectedDayRoutine.value = [];
  }
};

const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formattedDate = today.toISOString().split('T')[0];
  return formattedDate;
};

const fetchStreakOnLoad = async () => {
  if (!userId.value) return;

  const streakDocRef = doc(db, 'streaks', userId.value);

  try {
    const streakDocSnapshot = await getDoc(streakDocRef);

    if (streakDocSnapshot.exists()) {
      const data = streakDocSnapshot.data();
      streak.value = data.streak || 0;
      console.log('Streak fetched:', streak.value);
    } else {
      console.log('No streak document found for this user');
    }
  } catch (error) {
    console.error('Error fetching streak on load:', error);
  }
};

const fetchUserCredits = async () => {
  if (!userId.value) return;

  const userDocRef = doc(db, 'users', userId.value);

  try {
    const userDocSnapshot = await getDoc(userDocRef);
    if (userDocSnapshot.exists()) {
      userCredits.value = userDocSnapshot.data().credits || 0;
      console.log('User credits loaded:', userCredits.value);
    }
  } catch (error) {
    console.error('Error fetching user credits:', error);
  }
};

const fetchWontDoTasks = async () => {
  if (!userId.value || selectedDayIndex.value === -1) {
    console.warn("User ID or selected day is not set.");
    return;
  }

  try {
    const wontDoDocRef = doc(db, "wontDoTasks", `${userId.value}_${days.value[selectedDayIndex.value].day}`);
    const wontDoDocSnapshot = await getDoc(wontDoDocRef);

    if (wontDoDocSnapshot.exists()) {
      const data = wontDoDocSnapshot.data();
      wontDoTasks.value = data.tasks || [];
      console.log("Loaded 'Won't Do' tasks from Firestore:", wontDoTasks.value);
    } else {
      wontDoTasks.value = [];
    }
  } catch (error) {
    console.error("Error fetching 'Won't Do' tasks:", error);
  }
};

// Lifecycle
onMounted(async () => {
  try {
    isLoading.value = true;
    await new Promise(resolve => setTimeout(resolve, 2000));

    const todayIndex = new Date().getDay();
    selectedDayIndex.value = todayIndex;
    currentDate.value = formatDateLong(new Date());

    // Generate week dates
    const today = new Date();
    const currentDayIndex = today.getDay();
    const week = [];

    for (let i = 0; i < 7; i++) {
      const diff = i - currentDayIndex;
      const day = new Date(today);
      day.setDate(today.getDate() + diff);

      const formattedDate = day.toLocaleDateString('en-CA');
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day);

      week.push({ day: dayName, date: formattedDate });
    }

    days.value = week;
  } catch (error) {
    console.error('Error loading:', error);
  } finally {
    isLoading.value = false;
  }
});

// Watch for selectedDayIndex changes
watch(selectedDayIndex, async () => {
  // Clean up focus timer when switching days
  if (focusTimerRunning.value) {
    pauseFocusTimer();
  }
  focusTimeRemaining.value = 0;
  currentFocusTaskIndex.value = 0;

  await fetchWontDoTasks();
});

// Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId.value = user.uid;
    console.log('✅ User authenticated:', user.uid);

    const userDocRef = doc(db, 'users', user.uid);

    try {
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        hasPaid.value = data.hasPaid === true;
        userCredits.value = typeof data.credits === "number" ? data.credits : 0;
      }
    } catch (error) {
      console.warn('Could not load user data:', error);
    }

    // Load gamification data
    await loadUserRank();
    await fetchStreakOnLoad();
    await fetchUserCredits();

    // The watcher will handle fetching tasks when both userId and selectedDayIndex are set

    // Check daily productivity status
    try {
      await checkDailyProductivity();
    } catch (error) {
      console.warn('Could not check daily productivity:', error);
    }
  } else {
    userId.value = null;
    selectedDayRoutine.value = [];
  }
});
</script>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.delay-75 {
  animation-delay: 75ms;
}

.delay-150 {
  animation-delay: 150ms;
}

.delay-225 {
  animation-delay: 225ms;
}

.delay-300 {
  animation-delay: 300ms;
}

/* Smooth transitions */
* {
  transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Dark mode scrollbar */
.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>