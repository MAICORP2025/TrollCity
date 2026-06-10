// Minimal supabase shim for mobile placeholder build (non-functional)
export const supabase: any = {
  auth: {
    async getUser() {
      return { data: { user: null } };
    },
    onAuthStateChange(_cb: any) {
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signOut() {},
  },
  from(_table: string) {
    return {
      select() {
        return {
          eq() {
            return { maybeSingle: async () => ({ data: null }) };
          },
        };
      },
    };
  },
  async rpc(_name: string, _params?: any) {
    return { error: null };
  },
};
