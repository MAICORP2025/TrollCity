import { supabase } from '@/lib/supabase';

export async function setResetPin(pin: string): Promise<{ data: any; error: any }> {
  try {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token

    return await supabase.functions.invoke('password-manager', {
      body: { action: 'set-pin', pin },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  } catch (error) {
    console.error('Error calling password-manager set-pin', error);
    return { data: null, error };
  }
}

export async function resetPasswordViaManager(params: {
  email: string;
  full_name: string;
  pin: string;
  new_password: string;
}): Promise<{ data: any; error: any }> {
  try {
    return await supabase.functions.invoke('password-manager', {
      body: { action: 'reset-password', ...params },
    });
  } catch (error) {
    console.error('Error calling password-manager reset-password', error);
    return { data: null, error };
  }
}
