export type TodayTask = {
  completed?: boolean;
};

export const selectRandomTasks = <Task extends TodayTask>(
  tasks: Task[],
  count = 3,
  random: () => number = Math.random,
) => {
  const activeTasks = tasks.filter((task) => !task.completed);
  const shuffledTasks = [...activeTasks];

  for (let index = shuffledTasks.length - 1; index > 0; index -= 1) {
    const randomValue = Math.max(0, Math.min(0.999999, random()));
    const swapIndex = Math.floor(randomValue * (index + 1));
    [shuffledTasks[index], shuffledTasks[swapIndex]] = [
      shuffledTasks[swapIndex],
      shuffledTasks[index],
    ];
  }

  return shuffledTasks.slice(0, Math.max(0, count));
};

export const getPreviousDaySeconds = <
  Session extends {
    actualSeconds: number;
    endedAt: string;
    excludedFromInsights?: boolean;
  },
>(sessions: Session[], now = new Date()) => {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return sessions.reduce((total, session) => {
    if (session.excludedFromInsights) return total;

    const endedAt = new Date(session.endedAt);
    const isYesterday =
      endedAt.getFullYear() === yesterday.getFullYear() &&
      endedAt.getMonth() === yesterday.getMonth() &&
      endedAt.getDate() === yesterday.getDate();

    return isYesterday ? total + session.actualSeconds : total;
  }, 0);
};
