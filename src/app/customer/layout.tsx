// src/app/customer/layout.tsx
// =======================================================
// CUSTOMER 공통 레이아웃
// -------------------------------------------------------
// - customer 영역 공통 wrapper
// - 상단 헤더/타이틀은 각 페이지의 CustomerShellClient에서 처리
// - layout에서는 최소한의 배경/영역만 담당
// =======================================================

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function CustomerLayout({ children }: Props) {
  return <>{children}</>;
}