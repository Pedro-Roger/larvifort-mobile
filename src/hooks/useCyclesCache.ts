import { useState, useEffect, useCallback } from 'react';
import { getDb } from '../database/db';
import type { Cycle } from '../types';
import { CycleStatus } from '../types';

export function useCyclesCache(pondId?: string | null) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const db = await getDb();
      let rows: any[];

      if (pondId) {
        rows = await db.getAllAsync(
          `SELECT c.*, p.code as pond_code, p.name as pond_name
           FROM cycles_cache c
           LEFT JOIN ponds_cache p ON p.id = c.pond_id
           WHERE c.pond_id = ? AND c.status = ?
           ORDER BY c.stock_date DESC`,
          [pondId, CycleStatus.ATIVO],
        );
      } else {
        rows = await db.getAllAsync(
          `SELECT c.*, p.code as pond_code, p.name as pond_name
           FROM cycles_cache c
           LEFT JOIN ponds_cache p ON p.id = c.pond_id
           WHERE c.status = ?
           ORDER BY c.stock_date DESC`,
          [CycleStatus.ATIVO],
        );
      }

      setCycles(
        rows.map((r) => {
          const stockDate = r.stock_date ? new Date(r.stock_date) : null;
          const daysOfCulture = stockDate
            ? Math.floor((Date.now() - stockDate.getTime()) / (1000 * 60 * 60 * 24))
            : undefined;

          return {
            id: r.id,
            pondId: r.pond_id,
            phase: r.phase,
            status: r.status as Cycle['status'],
            supplier: r.supplier,
            stockDate: r.stock_date,
            updatedAt: r.updated_at,
            pondCode: r.pond_code,
            pondName: r.pond_name,
            daysOfCulture,
          };
        }),
      );
    } catch {
      setCycles([]);
    } finally {
      setIsLoading(false);
    }
  }, [pondId]);

  useEffect(() => {
    load();
  }, [load]);

  return { cycles, isLoading, reload: load };
}
