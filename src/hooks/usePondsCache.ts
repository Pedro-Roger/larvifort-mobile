import { useState, useEffect, useCallback } from 'react';
import { getDb } from '../database/db';
import type { Pond } from '../types';

export function usePondsCache() {
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        id: string;
        code: string;
        name: string;
        type: string;
        area_ha: number;
        status: string;
        updated_at: string;
      }>(`SELECT * FROM ponds_cache ORDER BY code ASC`);

      setPonds(
        rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          type: r.type,
          areaHa: r.area_ha,
          status: r.status as Pond['status'],
          updatedAt: r.updated_at,
        })),
      );
    } catch {
      setPonds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ponds, isLoading, reload: load };
}
