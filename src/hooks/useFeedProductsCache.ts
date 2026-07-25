import { useState, useEffect, useCallback } from 'react';
import { getDb } from '../database/db';
import type { FeedProduct } from '../types';

/** Feed products pulled during sync, so the feeding form works with no signal. */
export function useFeedProductsCache() {
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        id: string;
        name: string;
        price_kg: number | null;
        bag_weight_kg: number | null;
        active: number;
      }>(`SELECT * FROM feed_products_cache WHERE active = 1 ORDER BY name ASC`);

      setProducts(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          priceKg: r.price_kg,
          bagWeightKg: r.bag_weight_kg,
          active: true,
        })),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { products, isLoading, reload: load };
}
