export default function BusinessFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="w-full px-6 py-2 border-t border-border/40">
      <div className={`${compact ? "max-w-[400px] mx-auto text-center" : "max-w-2xl mx-auto"} space-y-0.5`}>
        <p className="text-xs font-bold text-muted-foreground">(주)기술의숲</p>
        <p className="text-xs text-muted-foreground/70">
          대표자 심규남 &nbsp;·&nbsp; 사업자등록번호 444-87-03436
        </p>
        {!compact && (
          <p className="text-xs text-muted-foreground/70">
            대전광역시 서구 둔지로 60 3층 &nbsp;·&nbsp; techforest@naver.com
          </p>
        )}
      </div>
    </footer>
  );
}
