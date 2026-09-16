import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  create: vi.fn(async (input: unknown) => input),
  update: vi.fn(async (input: unknown) => input),
  deleteMany: vi.fn(),
}));
vi.mock('../prisma/generated/client', () => ({
  PrismaClient: class {
    profile = { create: calls.create, update: calls.update, deleteMany: calls.deleteMany };
    project = { create: calls.create, deleteMany: calls.deleteMany };
    column = { deleteMany: calls.deleteMany };
    task = { deleteMany: calls.deleteMany };
  },
}));
import { postgresAdapter } from '../lib/adapters/postgres';

describe('Prisma adapter boundary', () => {
  it('rejects unscoped deletes without calling the database', async () => {
    for (const table of ['profiles', 'projects', 'columns', 'tasks'] as const) {
      const result = await postgresAdapter[table].delete();
      expect(result.error).toBeInstanceOf(Error);
    }
    expect(calls.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects null subscription changes rather than silently changing billing state', async () => {
    const result = await postgresAdapter.profiles.update({ id: 'fixture', subscription_status: null });
    expect(result.error).toBeInstanceOf(Error);
    expect(calls.update).not.toHaveBeenCalled();
  });

  it('preserves the project slug expected by the generated Prisma schema', async () => {
    const data = { name: 'Fixture', slug: 'fixture', user_id: 'owner' };
    const result = await postgresAdapter.projects.insert(data);
    expect(result.error).toBeNull();
    expect(calls.create).toHaveBeenCalledWith({ data });
  });
});
