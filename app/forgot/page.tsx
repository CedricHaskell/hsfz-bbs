import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ForgotForm } from "@/components/ForgotForm";

export const metadata = { title: "找回密码" };

export default async function ForgotPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="card p-5">
        <h1 className="text-xl font-bold">找回密码</h1>
        <p className="mb-4 mt-1 text-sm text-muted">
          输入注册时的用户名和手机号，验证通过后即可设置新密码。
        </p>
        <ForgotForm />
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        想起密码了？{" "}
        <Link href="/login" className="link font-medium">
          去登录
        </Link>
      </p>
    </div>
  );
}
