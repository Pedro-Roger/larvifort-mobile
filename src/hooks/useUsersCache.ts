import { useState, useEffect, useCallback } from 'react';
import { getDb } from '../database/db';
import type { User } from '../types';

export function useUsersCache() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        id: string;
        name: string;
        role: string;
        active: number;
        updated_at: string;
      }>(`SELECT * FROM users_cache WHERE active = 1 ORDER BY name ASC`);

      setUsers(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role as User['role'],
          active: r.active === 1,
          updatedAt: r.updated_at,
        })),
      );
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { users, isLoading, reload: load };
}
