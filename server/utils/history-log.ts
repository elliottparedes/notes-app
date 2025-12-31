import { executeQuery } from './db';
import type { EntityType, ActionType } from '../../models/HistoryLog';

interface LogChangeParams {
  entityType: EntityType;
  entityId: string;
  userId: number;
  userName: string;
  ownerId: number;
  action: ActionType;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Log a single change to the history_log table
 * Uses fire-and-forget pattern to not block main operations
 */
export async function logChange(params: LogChangeParams): Promise<void> {
  const {
    entityType,
    entityId,
    userId,
    userName,
    ownerId,
    action,
    fieldName = null,
    oldValue = null,
    newValue = null
  } = params;

  // Serialize values to JSON strings
  const oldValueStr = oldValue !== null && oldValue !== undefined ? JSON.stringify(oldValue) : null;
  const newValueStr = newValue !== null && newValue !== undefined ? JSON.stringify(newValue) : null;

  try {
    await executeQuery(
      `INSERT INTO history_log
       (entity_type, entity_id, user_id, user_name, owner_id, action, field_name, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entityType, entityId, userId, userName, ownerId, action, fieldName, oldValueStr, newValueStr]
    );
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to log history change:', error);
  }
}

/**
 * Compare old and new entity values and log changes for each modified field
 */
export async function logMultipleFieldChanges(
  entityType: EntityType,
  entityId: string,
  userId: number,
  userName: string,
  ownerId: number,
  oldEntity: Record<string, unknown>,
  newEntity: Record<string, unknown>,
  trackedFields: string[]
): Promise<void> {
  const changes: Array<{ field: string; oldVal: unknown; newVal: unknown }> = [];

  for (const field of trackedFields) {
    const oldVal = oldEntity[field];
    const newVal = newEntity[field];

    // Only log if value actually changed
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field, oldVal, newVal });
    }
  }

  // Log all changes
  for (const change of changes) {
    await logChange({
      entityType,
      entityId,
      userId,
      userName,
      ownerId,
      action: 'update',
      fieldName: change.field,
      oldValue: change.oldVal,
      newValue: change.newVal
    });
  }
}

/**
 * Log creation of a new entity
 */
export async function logCreate(
  entityType: EntityType,
  entityId: string,
  userId: number,
  userName: string,
  ownerId: number,
  entityData: Record<string, unknown>
): Promise<void> {
  await logChange({
    entityType,
    entityId,
    userId,
    userName,
    ownerId,
    action: 'create',
    newValue: entityData
  });
}

/**
 * Log deletion of an entity
 */
export async function logDelete(
  entityType: EntityType,
  entityId: string,
  userId: number,
  userName: string,
  ownerId: number,
  entityData: Record<string, unknown>
): Promise<void> {
  await logChange({
    entityType,
    entityId,
    userId,
    userName,
    ownerId,
    action: 'delete',
    oldValue: entityData
  });
}
