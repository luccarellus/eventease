import { User } from '@supabase/supabase-js';

export const isAdmin = (user: User | null | undefined): boolean => {
  return user?.app_metadata?.role === 'admin';
};

