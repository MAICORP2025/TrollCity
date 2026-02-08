import { supabase } from './supabase';

export interface MobileErrorLog {
  error_message: string;
  stack_trace?: string;
  device_info?: any;
  page_url?: string;
  user_id?: string;
}

export const MobileErrorLogger = {
  logError: async (error: any, context?: any) => {
    // Prevent DB locking during migration
    if (process.env.NODE_ENV === 'development') {
        console.warn('[MobileErrorLogger] Logging paused for migration safety:', error);
        return;
    }

    try {
      // Basic detection for mobile/PWA
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

      // Only log if explicitly requested or if we are on mobile/PWA
      // (Optional: can relax this to log all errors if needed)
      
      const session = await supabase.auth.getSession();
      const user = session.data.session?.user;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isMobile,
        isPWA,
        context
      };

      const { error: dbError } = await supabase
        .from('mobile_error_logs')
        .insert({
          user_id: user?.id || null,
          error_message: errorMessage,
          stack_trace: stackTrace,
          device_info: deviceInfo,
          page_url: window.location.href
        });

      if (dbError) {
        console.error('Failed to log mobile error to DB:', dbError);
      } else {
        console.log('Mobile error logged to DB');
      }
    } catch (loggingError) {
      console.error('Critical failure in MobileErrorLogger:', loggingError);
    }
  }
};

export const logMobileError = MobileErrorLogger.logError;
