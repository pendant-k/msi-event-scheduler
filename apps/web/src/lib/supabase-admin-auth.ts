export type AdminAuthAdapter = {
  signInWithPassword(input: { adminId: string; password: string }): Promise<{ adminUserId: string }>;
};

export const localAdminAuthAdapter: AdminAuthAdapter = {
  async signInWithPassword(input) {
    const expectedAdminIds = [process.env.ADMIN_ID?.trim() || "admin", process.env.ADMIN_EMAIL?.trim()].filter(
      (value): value is string => Boolean(value)
    );
    const expectedPassword = process.env.ADMIN_PASSWORD ?? "password";
    if (!expectedAdminIds.includes(input.adminId) || input.password !== expectedPassword) {
      throw new Error("invalid_admin_credentials");
    }
    return { adminUserId: "local-super-admin" };
  }
};

// Production adapter hook: replace localAdminAuthAdapter with Supabase Auth
// id/password sign-in while keeping admin routes unchanged.
