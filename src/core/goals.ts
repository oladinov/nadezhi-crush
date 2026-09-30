import { Goal, GoalProgress } from './types';

export function createInitialGoalProgress(): GoalProgress {
  return {
    score: 0,
    collected: [0, 0, 0, 0, 0],
    detonated: 0,
    created: {
      bomb1: 0,
      bomb2: 0,
      rainbow: 0,
    },
  };
}

export function cloneGoalProgress(p: GoalProgress): GoalProgress {
  return {
    score: p.score,
    collected: [...p.collected],
    detonated: p.detonated,
    created: { ...p.created },
  };
}

export function isGoalMet(goal: Goal, progress: GoalProgress): boolean {
  switch (goal.type) {
    case 'score':
      return progress.score >= goal.target;
    case 'collect':
      return (progress.collected[goal.color] ?? 0) >= goal.count;
    case 'detonate':
      return progress.detonated >= goal.count;
    case 'create':
      if (goal.kind === 'rainbow') {
        return progress.created.rainbow >= goal.count;
      }
      if (goal.kind === 'bomb') {
        if (goal.tier === 1) {
          return progress.created.bomb1 >= goal.count;
        }
        if (goal.tier === 2) {
          return progress.created.bomb2 >= goal.count;
        }
        return progress.created.bomb1 + progress.created.bomb2 >= goal.count;
      }
      return false;
  }
}

export function areAllGoalsMet(goals: Goal[], progress: GoalProgress): boolean {
  if (goals.length === 0) return true;
  return goals.every((g) => isGoalMet(g, progress));
}

export function getGoalStatus(
  goal: Goal,
  progress: GoalProgress
): { current: number; target: number; completed: boolean } {
  let current = 0;
  let target = 0;

  switch (goal.type) {
    case 'score':
      current = progress.score;
      target = goal.target;
      break;
    case 'collect':
      current = progress.collected[goal.color] ?? 0;
      target = goal.count;
      break;
    case 'detonate':
      current = progress.detonated;
      target = goal.count;
      break;
    case 'create':
      target = goal.count;
      if (goal.kind === 'rainbow') {
        current = progress.created.rainbow;
      } else if (goal.kind === 'bomb') {
        if (goal.tier === 1) {
          current = progress.created.bomb1;
        } else if (goal.tier === 2) {
          current = progress.created.bomb2;
        } else {
          current = progress.created.bomb1 + progress.created.bomb2;
        }
      }
      break;
  }

  return {
    current: Math.min(current, target),
    target,
    completed: current >= target,
  };
}

export function evaluateOutcome(
  goals: Goal[],
  progress: GoalProgress,
  movesLeft: number
): 'continue' | 'won' | 'lost' {
  if (areAllGoalsMet(goals, progress)) {
    return 'won';
  }
  if (movesLeft <= 0) {
    return 'lost';
  }
  return 'continue';
}
