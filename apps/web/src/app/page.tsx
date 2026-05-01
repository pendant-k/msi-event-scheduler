import { adminLoginAction } from "@/app/actions";

export default function HomePage() {
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
                defaultValue="admin@example.com"
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
                defaultValue="password"
                autoComplete="current-password"
                required
              />
            </label>
          </div>
          <p className="text-sm text-base-content/60">로컬 프로토타입은 env 기반 mock gate를 사용합니다.</p>
          <button className="btn btn-primary w-full" type="submit">
            로그인
          </button>
        </div>
      </form>
    </div>
  );
}
