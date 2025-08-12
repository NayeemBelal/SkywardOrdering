import { DataProvider, Identifier, RaRecord } from 'react-admin';
import { supabase } from '../lib/supabase';

const table = (r: string) => supabase.from(r);

type CompositeConfig = { secondKey: 'item_id' | 'employee_id' };
const compositeResources: Record<string, CompositeConfig> = {
  app_site_items: { secondKey: 'item_id' },
  app_site_employees: { secondKey: 'employee_id' },
};

function isCompositeResource(resource: string): resource is keyof typeof compositeResources {
  return resource in compositeResources;
}

function withCompositeId(resource: string, row: any): RaRecord {
  if (!row || typeof row !== 'object') return row as RaRecord;
  if (isCompositeResource(resource) && 'site_id' in row) {
    const secondKey = compositeResources[resource].secondKey;
    const secondVal = (row as any)[secondKey];
    if (secondVal != null) {
      return { ...row, id: `${row.site_id}-${secondVal}` } as RaRecord;
    }
  }
  return row as RaRecord;
}

function parseCompositeId(resource: string, id: Identifier): { site_id: number; second_id: number } {
  const [s, i] = String(id).split('-');
  return { site_id: Number(s), second_id: Number(i) };
}

const provider: DataProvider = {
  getList: async (resource) => {
    const { data } = await table(resource).select('*');
    const rows = data || [];
    const dataOut = isCompositeResource(resource)
      ? rows.map((r: any) => withCompositeId(resource, r))
      : rows;
    return { data: dataOut, total: rows.length };
  },
  getOne: async (resource, params) => {
    if (isCompositeResource(resource)) {
      const { site_id, second_id } = parseCompositeId(resource, params.id);
      const secondKey = compositeResources[resource].secondKey;
      const { data } = await table(resource)
        .select('*')
        .eq('site_id', site_id)
        .eq(secondKey, second_id)
        .single();
      return { data: withCompositeId(resource, data) };
    }
    const { data } = await table(resource).select('*').eq('id', params.id).single();
    return { data: data as RaRecord };
  },
  getMany: async (resource, params) => {
    if (isCompositeResource(resource)) {
      // Not used; return empty or fetch individually
      const records: RaRecord[] = [];
      for (const id of params.ids) {
        const { data } = await provider.getOne(resource, { id, meta: undefined } as any);
        records.push(data);
      }
      return { data: records };
    }
    const { data } = await table(resource).select('*').in('id', params.ids as Identifier[]);
    return { data: (data || []) as RaRecord[] };
  },
  create: async (resource, params) => {
    const { data } = await table(resource).insert(params.data as any).select('*').single();
    const record = isCompositeResource(resource) ? withCompositeId(resource, data) : (data as RaRecord);
    return { data: record };
  },
  update: async (resource, params) => {
    if (isCompositeResource(resource)) {
      // Not supported: composite key immutable; return existing
      const { data } = await provider.getOne(resource, { id: params.id, meta: undefined } as any);
      return { data };
    }
    const { data } = await table(resource)
      .update(params.data as any)
      .eq('id', params.id)
      .select('*')
      .single();
    return { data: data as RaRecord };
  },
  delete: async (resource, params) => {
    if (isCompositeResource(resource)) {
      const { site_id, second_id } = parseCompositeId(resource, params.id);
      const secondKey = compositeResources[resource].secondKey;
      await table(resource).delete().eq('site_id', site_id).eq(secondKey, second_id);
      return { data: { id: params.id } as any };
    }
    await table(resource).delete().eq('id', params.id);
    return { data: { id: params.id } as any };
  },
  deleteMany: async (resource, params) => {
    if (isCompositeResource(resource)) {
      for (const id of params.ids) {
        const { site_id, second_id } = parseCompositeId(resource, id);
        const secondKey = compositeResources[resource].secondKey;
        await table(resource).delete().eq('site_id', site_id).eq(secondKey, second_id);
      }
      return { data: params.ids };
    }
    await table(resource).delete().in('id', params.ids as Identifier[]);
    return { data: params.ids };
  },
  updateMany: async (resource, params) => {
    if (isCompositeResource(resource)) {
      // Not supported; no-op
      return { data: [] };
    }
    const { data } = await table(resource).update(params.data as any).in('id', params.ids as Identifier[]).select('id');
    return { data: (data || []).map((d: any) => d.id) };
  },
};

export default provider;
