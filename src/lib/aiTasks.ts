import { supabase } from './supabase';

type AiTaskContext = {
  userId: string;
  taskId: string;
  prompt: string;
  metadata?: Record<string, any>;
};

type AiTaskResult = {
  success: boolean;
  score: number;
  outcome: any;
};

function buildSeed(userId: string, taskId: string) {
  const base = `${userId}:${taskId}:${new Date().toISOString().slice(0, 10)}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    const chr = base.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function runAiTaskSimulation(context: AiTaskContext): Promise<AiTaskResult> {
  const model = 'client-fallback';
  const seed = buildSeed(context.userId, context.taskId);

  try {
    const score = seed % 101;
    const success = score >= 50;
    const outcome = {
      success,
      score,
      details: {
        mode: 'client-fallback',
        reason: 'AI tasks must be judged by a server/Edge Function so private API keys stay off the client.'
      }
    };

    await supabase.from('troll_wars_ai_battle_logs').insert({
      user_id: context.userId,
      task_id: context.taskId,
      battle_type: 'ai_task',
      input_payload: {
        prompt: context.prompt,
        metadata: context.metadata || {}
      },
      ai_model: model,
      ai_temperature: 0,
      random_seed: seed,
      outcome,
      score
    });

    return {
      success,
      score,
      outcome
    };
  } catch (err) {
    await supabase.from('troll_wars_ai_battle_logs').insert({
      user_id: context.userId,
      task_id: context.taskId,
      battle_type: 'ai_task_error',
      input_payload: {
        prompt: context.prompt,
        metadata: context.metadata || {}
      },
      ai_model: 'error',
      ai_temperature: null,
      random_seed: buildSeed(context.userId, context.taskId),
      outcome: {
        error: (err as any)?.message || 'AI task failure',
        raw: null
      },
      score: 0
    });

    return {
      success: false,
      score: 0,
      outcome: {
        error: (err as any)?.message || 'AI task failure'
      }
    };
  }
}
