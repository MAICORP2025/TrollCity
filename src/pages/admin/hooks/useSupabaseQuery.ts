import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

export const useSupabaseQuery = <T>(
  table: string,
  select: string = '*',
  filters?: { column: string; value: any; operator?: string }[],
  orderBy?: { column: string; ascending?: boolean },
  limit?: number
): T[] => {
  const [data, setData] = useState<T[]>([]);

  const filtersKey = JSON.stringify(filters);
  const orderByKey = JSON.stringify(orderBy);

  const loadData = useCallback(async () => {
    let query = supabase.from(table).select(select);

    if (filters) {
      filters.forEach(filter => {
        if (filter.operator === 'eq') {
          query = query.eq(filter.column, filter.value);
        } else if (filter.operator === 'neq') {
          query = query.neq(filter.column, filter.value);
        } else if (filter.operator === 'gt') {
          query = query.gt(filter.column, filter.value);
        } else if (filter.operator === 'gte') {
          query = query.gte(filter.column, filter.value);
        } else if (filter.operator === 'lt') {
          query = query.lt(filter.column, filter.value);
        } else if (filter.operator === 'lte') {
          query = query.lte(filter.column, filter.value);
        } else {
          query = query.eq(filter.column, filter.value);
        }
      });
    }

    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: result } = await query;
    setData((result as T[]) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, filtersKey, orderByKey, limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return data;
};