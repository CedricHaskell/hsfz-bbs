"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type ActionState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

function Alert({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        state.ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
    >
      {state.message}
    </div>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <div>
        <label className="mb-1 block text-sm font-medium">用户名</label>
        <input name="username" required className="input" placeholder="你的用户名" autoFocus />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">密码</label>
        <input name="password" type="password" required className="input" placeholder="••••••••" />
      </div>
      <SubmitButton className="btn-primary w-full justify-center" pendingText="登录中…">
        登录
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        还没有账号？{" "}
        <Link href="/register" className="link font-medium">
          注册新账号
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <div>
        <label className="mb-1 block text-sm font-medium">用户名</label>
        <input
          name="username"
          required
          pattern="[a-z0-9_]{3,20}"
          className="input"
          placeholder="小写字母 / 数字 / 下划线，3-20 位"
          title="小写字母、数字或下划线，3-20 位"
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">昵称</label>
        <input name="nickname" required maxLength={12} className="input" placeholder="论坛里展示的名字" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">年级</label>
        <select name="grade" required defaultValue="" className="input">
          <option value="" disabled>
            请选择年级…
          </option>
          {["初一", "初二", "初三", "高一", "高二", "高三", "已毕业", "其他"].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">密码</label>
        <input name="password" type="password" required minLength={6} className="input" placeholder="至少 6 位" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">确认密码</label>
        <input name="password2" type="password" required minLength={6} className="input" placeholder="再输入一次" />
      </div>
      <details className="rounded-md border border-line bg-soft/60 px-3 py-2.5">
        <summary className="cursor-pointer select-none text-sm font-medium text-brand">
          🎫 我在校友名单里（免审核通道，选填）
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">
            管理员已导入校友名单（姓名 + 学号）。信息匹配成功的账号<strong>免审核直接开通</strong>；不匹配或留空则进入正常人工审核。
          </p>
          <input name="real_name" maxLength={20} className="input" placeholder="真实姓名" />
          <input name="student_id" maxLength={20} className="input" placeholder="学号" />
        </div>
      </details>
      <SubmitButton className="btn-primary w-full justify-center" pendingText="提交中…">
        提交注册申请
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        已有账号？{" "}
        <Link href="/login" className="link font-medium">
          去登录
        </Link>
      </p>
    </form>
  );
}
