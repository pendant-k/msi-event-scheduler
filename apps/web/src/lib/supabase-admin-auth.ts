export type AdminAuthAdapter = {
  signInWithPassword(input: { email: string; password: string }): Promise<{ adminUserId: string }>;
};

export const localAdminAuthAdapter: AdminAuthAdapter = {
  async signInWithPassword(input) {
    const expectedEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
    const expectedPassword = process.env.ADMIN_PASSWORD ?? "password";
    if (input.email !== expectedEmail || input.password !== expectedPassword) {
      throw new Error("invalid_admin_credentials");
    }
    return { adminUserId: "local-super-admin" };
  }
};

// Production adapter hook: replace localAdminAuthAdapter with Supabase Auth
// email/password sign-in while keeping admin routes unchanged.
