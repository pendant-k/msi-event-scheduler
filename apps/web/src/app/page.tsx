import { adminLoginAction } from "@/app/actions";

export default function HomePage() {
  const defaultEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center">
      <form action={adminLoginAction} className="surface-flat w-full overflow-hidden">
        <div className="bg-white px-10 py-6">
          <img src="/logo.png" alt="메생이" className="mx-auto h-64 w-full object-contain object-center" />
        </div>
        <div className="space-y-4 p-6">
          <div>
            <h1 className="text-2xl font-bold">관리자 로그인</h1>
          </div>
          <div className="space-y-3">
            <label className="form-control">
              <span className="label-text">이메일</span>
              <input
                name="email"
                type="email"
                className="input input-bordered w-full"
                defaultValue={defaultEmail}
                autoComplete="email"
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">비밀번호</span>
              <input
                name="password"
                type="password"
                className="input input-bordered w-full"
                placeholder="관리자 비밀번호"
                autoComplete="current-password"
                required
              />
            </label>
          </div>
          <button className="btn btn-primary w-full" type="submit">
            로그인
          </button>
        </div>
      </form>
    </div>
  );
}
