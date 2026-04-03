export default function BusinessFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="text-xs text-muted-foreground space-y-1 leading-relaxed text-center">
      <div className="font-bold text-foreground/70">(주)기술의숲</div>
      <div>대표자: 심규남 · 사업자등록번호: 444-87-03436</div>
      {!compact && <div>주소: 대전광역시 서구 둔지로 60 3층</div>}
      {!compact && <div>이메일: techforest@naver.com</div>}
    </footer>
  );
}
