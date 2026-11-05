// Transfer a task to another weekday tab (HomeView TransferModal).
// Moving a task is not the free daily creation cap. Pro can hold any number of tasks, so a move is not refused for length.
export const MAX_TASKS_PER_DAY = Infinity;
// next tab after the current one (wraps), never the current tab itself
export const defaultTransferDay = (current, count) => (count < 2 ? null : (current < 0 ? 0 : (current + 1) % count));
export const transferFits = (targetLen, max = MAX_TASKS_PER_DAY) => targetLen + 1 <= max;
