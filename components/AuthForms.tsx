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
        <label className="mb-1 block text-sm font-medium">真实姓名</label>
        <input
          name="real_name"
          required
          minLength={2}
          maxLength={20}
          className="input"
          placeholder="与学籍一致的姓名（仅供管理员审核）"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">学号</label>
        <input name="student_id" required maxLength={20} className="input" placeholder="与学籍一致的学号" />
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
        <label className="mb-1 block text-sm font-medium">手机号</label>
        <input
          name="phone"
          required
          pattern="1[3-9][0-9]{9}"
          maxLength={11}
          className="input"
          placeholder="11 位手机号"
          title="11 位手机号"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          邮箱<span className="ml-1 text-xs text-muted">（选填）</span>
        </label>
        <input name="email" type="email" className="input" placeholder="选填" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">密码</label>
        <input name="password" type="password" required minLength={8} className="input" placeholder="至少 8 位" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">确认密码</label>
        <input name="password2" type="password" required minLength={8} className="input" placeholder="再输入一次" />
      </div>
      <p className="rounded-md bg-soft/60 px-3 py-2 text-xs leading-5 text-muted">
        🔒 隐私说明：姓名、学号、手机号仅供管理员审核身份与处理账号申诉，保存在论坛数据库中；密码经
        bcrypt 单向加密，任何人（包括管理员）都无法查看原文；上传图片会自动剥离 EXIF/GPS
        定位信息。昵称默认为用户名，登录后可在「账号设置」修改。
      </p>
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
