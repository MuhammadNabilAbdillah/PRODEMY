import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = createClient(url || 'http://localhost', key || 'missing');

/** Ambil semua baris (Supabase membatasi 1000 baris per permintaan) */
export async function fetchAll(table, cols = '*', mod = (q) => q) {
  let out = [], from = 0;
  for (;;) {
    const { data, error } = await mod(supabase.from(table).select(cols)).order('id').range(from, from + 999);
    if (error) throw error;
    out = out.concat(data);
    if (data.length < 1000) return out;
    from += 1000;
  }
}

/** Unggah file ke bucket privat, kembalikan path-nya */
export async function upload(bucket, folder, file) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
}
export const removeFile = (bucket, path) => path ? supabase.storage.from(bucket).remove([path]) : null;
