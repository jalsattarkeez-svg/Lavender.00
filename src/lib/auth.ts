import { supabase } from '@/lib/supabase';

export async function signUp(email: string, password: string, displayName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || '' },
    },
  });
  if (error) throw error;
  return data;
}

export async function verifyOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });
  if (error) throw error;
  return data;
}

export async function resendSignupOtp(email: string) {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

const PRODUCTION_ORIGIN = 'https://lavender-00.vercel.app';
const RESET_PATH = '/reset-password';

function getResetRedirectUrl(): string {
  const origin = window.location.origin;
  const isLocalDev =
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');
  if (isLocalDev) {
    return `${origin}${RESET_PATH}`;
  }
  return `${PRODUCTION_ORIGIN}${RESET_PATH}`;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getResetRedirectUrl(),
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}
