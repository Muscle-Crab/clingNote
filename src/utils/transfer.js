// Transfer a task to another weekday tab (HomeView TransferModal).
import { TASK_LIMITS } from '@/config/pricing';
export const MAX_TASKS_PER_DAY = Math.max(TASK_LIMITS.free, TASK_LIMITS.pro); // 5/day
// next tab after the current one (wraps), never the current tab itself
export const defaultTransferDay = (current, count) => (count < 2 ? null : (current < 0 ? 0 : (current + 1) % count));
export const transferFits = (targetLen, max = MAX_TASKS_PER_DAY) => targetLen + 1 <= max;
