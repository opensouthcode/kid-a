import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { User, UserRole } from './types.js';

const userRoles = new Set<UserRole>(['desk', 'lead', 'wheel']);

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function asUserRole(value: unknown, label: string): UserRole {
  if (typeof value !== 'string' || !userRoles.has(value as UserRole)) {
    throw new Error(`${label} must be desk, lead, or wheel`);
  }

  return value as UserRole;
}

function asString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function normalizeUser(value: unknown, index: number): User {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`users.${index} must be an object`);
  }

  const user = value as Record<string, unknown>;
  const role = asUserRole(user.role, `users.${index}.role`);
  const activityId =
    user.activityId === undefined ? undefined : Number(user.activityId);

  if (
    role === 'lead' &&
    (!Number.isInteger(activityId) || activityId === undefined || activityId <= 0)
  ) {
    throw new Error(`users.${index}.activityId must be a positive integer`);
  }

  return {
    id: asString(user.id, `users.${index}.id`),
    name: asString(user.name, `users.${index}.name`),
    role,
    ...(activityId ? { activityId } : {}),
  };
}

function getUserDataPaths() {
  if (process.env.KID_A_USERS_FILE) {
    return [path.resolve(process.env.KID_A_USERS_FILE)];
  }

  return [
    path.resolve('src/data/users.json'),
    path.resolve('server/data/users.json'),
  ];
}

export async function readStaffUsers(): Promise<User[]> {
  const attemptedPaths: string[] = [];

  for (const userDataPath of getUserDataPaths()) {
    attemptedPaths.push(userDataPath);

    try {
      const parsedUsers = JSON.parse(await readFile(userDataPath, 'utf8')) as unknown;

      if (!Array.isArray(parsedUsers)) {
        throw new Error(`${userDataPath} must contain an array`);
      }

      return parsedUsers.map(normalizeUser);
    } catch (error) {
      if (isMissingFileError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Missing users data; checked ${attemptedPaths.join(', ')}`);
}
