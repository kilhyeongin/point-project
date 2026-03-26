// src/lib/validatePassword.ts
// 비밀번호 복잡도 검증 유틸

/**
 * 비밀번호 규칙:
 * - 최소 8자
 * - 최대 72자 (bcrypt 한계)
 * - 영문, 숫자, 특수문자 중 2가지 이상 포함
 */
export function validatePassword(password: string): { ok: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };
  }

  if (password.length > 72) {
    return { ok: false, error: "비밀번호는 72자 이하이어야 합니다." };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const typesCount = [hasLetter, hasDigit, hasSpecial].filter(Boolean).length;

  if (typesCount < 2) {
    return {
      ok: false,
      error: "비밀번호는 영문, 숫자, 특수문자 중 2가지 이상을 포함해야 합니다.",
    };
  }

  return { ok: true };
}
