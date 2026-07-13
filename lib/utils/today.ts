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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DayMinutes = {
  label: string;
  minutes: number;
  isToday: boolean;
};

/** Trailing 7 calendar days (ending today) of logged minutes, for the Time Map bar graph. */
export const getWeeklyMinutesByDay = <
  Session extends {
    actualSeconds: number;
    endedAt: string;
    excludedFromInsights?: boolean;
  },
>(sessions: Session[], now = new Date()): DayMinutes[] => {
  const days: DayMinutes[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);

    const totalSeconds = sessions.reduce((total, session) => {
      if (session.excludedFromInsights) return total;

      const endedAt = new Date(session.endedAt);
      const sameDay =
        endedAt.getFullYear() === day.getFullYear() &&
        endedAt.getMonth() === day.getMonth() &&
        endedAt.getDate() === day.getDate();

      return sameDay ? total + session.actualSeconds : total;
    }, 0);

    days.push({
      label: WEEKDAY_LABELS[day.getDay()],
      minutes: Math.round(totalSeconds / 60),
      isToday: offset === 0,
    });
  }

  return days;
};
