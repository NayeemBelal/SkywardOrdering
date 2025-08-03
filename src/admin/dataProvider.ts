import { DataProvider } from 'react-admin';
import { supabase } from '../lib/supabase';

const table = (r: string) => supabase.from(r);

const provider: DataProvider = {
  getList: async (r) => {
    const { data } = await table(r).select('*');
    return { data: data || [], total: data?.length || 0 };
  },
  getOne: async (r, p) => {
    const { data } = await table(r).select('*').eq('id', p.id).single();
    return { data: data! };
  },
  getMany: async (r, p) => {
    const { data } = await table(r).select('*').in('id', p.ids); 
    return { data: data || [] };
  },
  create: async (r, p) => {
    const { data } = await table(r).insert(p.data).select('*').single();
    return { data: data! };
  },
  update: async (r, p) => {
    const { data } = await table(r).update(p.data).eq('id', p.id).select('*').single();
    return { data: data! };
  },
  delete: async (r, p) => {
    await table(r).delete().eq('id', p.id);
    return { data: { id: p.id } };
  },
  deleteMany: async (r, p) => {
    await table(r).delete().in('id', p.ids);
    return { data: p.ids };
  },
  updateMany: async (r,p)=>{
    const { data } = await table(r).update(p.data).in('id', p.ids).select('id');
    return { data: data?.map(d=>d.id) || [] };
  },
};

export default provider;
