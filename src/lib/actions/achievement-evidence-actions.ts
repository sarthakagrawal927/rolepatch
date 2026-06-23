'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { AchievementEvidence, AchievementImpact } from '@/lib/types';

const IMPACT_TYPES = new Set<AchievementImpact>([
  'revenue',
  'cost',
  'growth',
  'quality',
  'speed',
  'leadership',
  'technical',
  'other',
]);

export type AchievementEvidenceInput = Omit<
  AchievementEvidence,
  'id' | 'created_at' | 'updated_at'
>;

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function serializeList(value: string[]): string {
  return JSON.stringify(value.map((item) => item.trim()).filter(Boolean));
}

function normalize(input: AchievementEvidenceInput): AchievementEvidenceInput {
  return {
    title: input.title.trim(),
    situation: input.situation.trim(),
    action: input.action.trim(),
    result: input.result.trim(),
    metric: input.metric.trim(),
    scope: input.scope.trim(),
    skills: input.skills.map((item) => item.trim()).filter(Boolean),
    role_targets: input.role_targets.map((item) => item.trim()).filter(Boolean),
    impact_type: IMPACT_TYPES.has(input.impact_type) ? input.impact_type : 'other',
  };
}

function toEvidence(row: Record<string, unknown>): AchievementEvidence {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    situation: String(row.situation ?? ''),
    action: String(row.action ?? ''),
    result: String(row.result ?? ''),
    metric: String(row.metric ?? ''),
    scope: String(row.scope ?? ''),
    skills: parseList(row.skills),
    role_targets: parseList(row.role_targets),
    impact_type: IMPACT_TYPES.has(row.impact_type as AchievementImpact)
      ? (row.impact_type as AchievementImpact)
      : 'other',
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
  };
}

export async function listAchievementEvidence(): Promise<AchievementEvidence[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM achievement_evidence WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return result.rows.map((row) => toEvidence(row as Record<string, unknown>));
}

export async function createAchievementEvidence(input: AchievementEvidenceInput): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to create achievement evidence');
  const data = normalize(input);
  if (!data.title || !data.result) throw new Error('Title and result are required');

  const id = uuid();
  await db.execute({
    sql: `INSERT INTO achievement_evidence (
      id, user_id, title, situation, action, result, metric, scope, skills, role_targets, impact_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      userId,
      data.title,
      data.situation,
      data.action,
      data.result,
      data.metric,
      data.scope,
      serializeList(data.skills),
      serializeList(data.role_targets),
      data.impact_type,
    ],
  });
  revalidatePath('/evidence');
  revalidatePath('/dashboard');
  return id;
}

export async function updateAchievementEvidence(
  id: string,
  input: AchievementEvidenceInput
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update achievement evidence');
  const data = normalize(input);
  if (!data.title || !data.result) throw new Error('Title and result are required');

  await db.execute({
    sql: `UPDATE achievement_evidence SET
      title = ?, situation = ?, action = ?, result = ?, metric = ?, scope = ?,
      skills = ?, role_targets = ?, impact_type = ?, updated_at = unixepoch()
      WHERE id = ? AND user_id = ?`,
    args: [
      data.title,
      data.situation,
      data.action,
      data.result,
      data.metric,
      data.scope,
      serializeList(data.skills),
      serializeList(data.role_targets),
      data.impact_type,
      id,
      userId,
    ],
  });
  revalidatePath('/evidence');
  revalidatePath('/dashboard');
}

export async function deleteAchievementEvidence(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to delete achievement evidence');
  await db.execute({
    sql: 'DELETE FROM achievement_evidence WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  revalidatePath('/evidence');
  revalidatePath('/dashboard');
}
