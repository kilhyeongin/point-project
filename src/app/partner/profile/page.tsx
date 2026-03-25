"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ImagePlus } from "lucide-react";

type CategoryOption = {
  code: string;
  name: string;
};

type ProfileData = {
  name: string;
  username: string;
  isPublished: boolean;
  categories: string[];
  intro: string;
  benefitText: string;
  phone: string;
  address: string;
  detailAddress: string;
  applyUrl: string;
  kakaoChannelUrl: string;
  coverImageUrl: string;
  contactEmail: string;
};

const EMPTY: ProfileData = {
  name: "",
  username: "",
  isPublished: false,
  categories: [],
  intro: "",
  benefitText: "",
  phone: "",
  address: "",
  detailAddress: "",
  applyUrl: "",
  kakaoChannelUrl: "",
  coverImageUrl: "",
  contactEmail: "",
};

function isValidUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const p = new URL(value.trim());
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}

/* ───── 뷰 모드 - 정보 행 ───── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex py-3 border-b border-border/60 last:border-0 gap-4">
      <div className="w-24 shrink-0 text-xs font-bold text-muted-foreground pt-0.5">
        {label}
      </div>
      <div className="text-sm text-foreground leading-relaxed break-all min-w-0 whitespace-pre-wrap">
        {value || "-"}
      </div>
    </div>
  );
}

export default function PartnerProfilePage() {
  const [data, setData] = useState<ProfileData>(EMPTY);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "edit">("view");

  /* 편집 폼 상태 */
  const [form, setForm] = useState<ProfileData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* 이미지 업로드 상태 */
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [profileRes, optionRes] = await Promise.all([
        fetch("/api/partner/profile", { cache: "no-store" }),
        fetch("/api/partner/category-options", { cache: "no-store" }),
      ]);
      const profileData = await profileRes.json();
      const optionData = await optionRes.json();

      if (!profileRes.ok || !profileData?.ok) {
        setMsg(profileData?.error ?? "정보를 불러오지 못했습니다.");
        return;
      }

      const item = profileData.item ?? {};
      const loaded: ProfileData = {
        name: item.name ?? "",
        username: item.username ?? "",
        isPublished: Boolean(item.isPublished),
        categories: Array.isArray(item.categories) ? item.categories : [],
        intro: item.intro ?? "",
        benefitText: item.benefitText ?? "",
        phone: item.phone ?? "",
        address: item.address ?? "",
        detailAddress: item.detailAddress ?? "",
        applyUrl: item.applyUrl ?? "",
        kakaoChannelUrl: item.kakaoChannelUrl ?? "",
        coverImageUrl: item.coverImageUrl ?? "",
        contactEmail: item.contactEmail ?? "",
      };
      setData(loaded);

      if (optionRes.ok && optionData?.ok) {
        setCategoryOptions(
          Array.isArray(optionData.items) ? optionData.items : []
        );
      }
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit() {
    setForm({ ...data });
    setImagePreview(data.coverImageUrl ?? "");
    setMsg("");
    setMode("edit");
  }

  function cancelEdit() {
    setMsg("");
    setMode("view");
  }

  function update<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCategory(code: string) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(code)
        ? prev.categories.filter((c) => c !== code)
        : [...prev.categories, code],
    }));
  }

  async function handleImageFile(file: File) {
    if (!file) return;
    setMsg("");
    setImageUploading(true);
    try {
      const res = await fetch("/api/partner/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMsg(data?.message ?? "업로드 URL 발급 실패");
        return;
      }

      const putRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        setMsg("이미지 업로드에 실패했습니다.");
        return;
      }

      setImagePreview(data.publicUrl);
      update("coverImageUrl", data.publicUrl);
    } catch {
      setMsg("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setImageUploading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      setMsg("업체명을 입력해주세요.");
      return;
    }
    if (form.applyUrl && !isValidUrl(form.applyUrl)) {
      setMsg("신청 링크는 http:// 또는 https:// 형식의 올바른 주소만 입력할 수 있습니다.");
      return;
    }
    if (form.kakaoChannelUrl && !isValidUrl(form.kakaoChannelUrl)) {
      setMsg("카카오채널 링크는 http:// 또는 https:// 형식의 올바른 주소만 입력할 수 있습니다.");
      return;
    }
    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/partner/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          categories: form.categories,
          category: form.categories[0] ?? "",
          intro: form.intro,
          benefitText: form.benefitText,
          phone: form.phone,
          address: form.address,
          detailAddress: form.detailAddress,
          applyUrl: form.applyUrl,
          kakaoChannelUrl: form.kakaoChannelUrl,
          coverImageUrl: form.coverImageUrl,
          isPublished: form.isPublished,
          contactEmail: form.contactEmail,
        }),
      });

      const resData = await res.json();

      if (!res.ok || !resData?.ok) {
        setMsg(resData?.error ?? "저장에 실패했습니다.");
        return;
      }

      const item = resData.item ?? {};
      const saved: ProfileData = {
        name: item.name ?? form.name,
        username: data.username,
        isPublished: Boolean(item.isPublished),
        categories: Array.isArray(item.categories) ? item.categories : form.categories,
        intro: item.intro ?? form.intro,
        benefitText: item.benefitText ?? form.benefitText,
        phone: item.phone ?? form.phone,
        address: item.address ?? form.address,
        detailAddress: item.detailAddress ?? form.detailAddress,
        applyUrl: item.applyUrl ?? form.applyUrl,
        kakaoChannelUrl: item.kakaoChannelUrl ?? form.kakaoChannelUrl,
        coverImageUrl: item.coverImageUrl ?? form.coverImageUrl,
        contactEmail: item.contactEmail ?? form.contactEmail,
      };
      setData(saved);
      setMode("view");
      setMsg("저장되었습니다.");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  const categoryLabels = categoryOptions
    .filter((opt) => data.categories.includes(opt.code))
    .map((opt) => opt.name);

  const messageIsSuccess =
    msg.includes("저장") && !msg.includes("실패") && !msg.includes("불러오지");

  return (
    <main className="grid gap-5 grid-cols-1 min-w-0">

      {/* 헤더 */}
      <section className="flex flex-wrap justify-between items-start gap-4 p-6 sm:p-5 bg-card shadow-card rounded-2xl">
        <div>
          <div className="text-xs font-extrabold text-muted-foreground mb-2">PARTNER</div>
          <h1 className="text-3xl sm:text-2xl font-black text-foreground m-0">내 정보 관리</h1>
          <div className="mt-2 text-sm text-muted-foreground leading-relaxed break-keep">
            업체 프로필을 확인하고 수정할 수 있습니다.
          </div>
        </div>

        {!loading && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center h-7 px-3 rounded-full text-xs font-bold",
                data.isPublished
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-muted text-muted-foreground border border-border"
              )}
            >
              {data.isPublished ? "공개중" : "비공개"}
            </span>
          </div>
        )}
      </section>

      {/* 메시지 */}
      {msg ? (
        <div
          className={cn(
            "px-4 py-3.5 rounded-2xl text-sm font-bold border",
            messageIsSuccess
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          )}
        >
          {msg}
        </div>
      ) : null}

      {loading ? (
        <section className="bg-card shadow-card rounded-2xl p-5">
          <div className="text-sm font-bold text-muted-foreground">불러오는 중...</div>
        </section>
      ) : mode === "view" ? (
        /* ══════════════ 뷰 모드 ══════════════ */
        <>
          {/* 기본 정보 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              기본 정보
            </h2>

            <InfoRow label="아이디" value={data.username} />
            <InfoRow label="업체명" value={data.name} />
            <div className="flex py-3 gap-4">
              <div className="w-24 shrink-0 text-xs font-bold text-muted-foreground pt-0.5">
                공개 여부
              </div>
              <div className="text-sm text-foreground leading-relaxed">
                {data.isPublished ? "공개중" : "비공개"}
              </div>
            </div>
          </section>

          {/* 카테고리 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              카테고리
            </h2>

            {categoryLabels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {categoryLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center h-7 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground/40">선택된 카테고리 없음</div>
            )}
          </section>

          {/* 소개 / 혜택 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              소개 / 혜택
            </h2>
            <InfoRow label="업체 소개" value={data.intro} />
            <InfoRow label="혜택 설명" value={data.benefitText} />
          </section>

          {/* 연락처 / 링크 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              연락처 / 링크
            </h2>
            <InfoRow label="전화번호" value={data.phone} />
            <InfoRow label="주소" value={[data.address, data.detailAddress].filter(Boolean).join(" ")} />
            <InfoRow label="알림 이메일" value={data.contactEmail} />
            <InfoRow label="신청 링크" value={data.applyUrl} />
            <InfoRow label="카카오채널" value={data.kakaoChannelUrl} />
          </section>

          {/* 대표 이미지 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              대표 이미지
            </h2>

            <div className="rounded-xl overflow-hidden border border-border max-w-xs aspect-video bg-muted flex items-center justify-center text-sm text-muted-foreground/50">
              {data.coverImageUrl ? (
                <img
                  src={data.coverImageUrl}
                  alt="대표 이미지"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span>이미지 없음</span>
              )}
            </div>
          </section>

          {/* 수정하기 버튼 */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="default" onClick={startEdit}>
              수정하기
            </Button>
          </div>
        </>
      ) : (
        /* ══════════════ 편집 모드 ══════════════ */
        <>
          {/* 기본 정보 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              기본 정보
            </h2>

            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">아이디</label>
                <Input value={data.username} disabled />
                <div className="mt-1.5 text-xs text-muted-foreground">아이디는 변경할 수 없습니다.</div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">업체명</label>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="고객에게 표시될 업체명"
                  maxLength={100}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => update("isPublished", e.target.checked)}
                className="w-5 h-5 cursor-pointer shrink-0 accent-primary"
              />
              <div>
                <div className="text-sm font-bold text-foreground">고객 페이지에 공개</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  체크 해제 시 고객에게 노출되지 않습니다.
                </div>
              </div>
            </label>
          </section>

          {/* 카테고리 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              카테고리
            </h2>

            {categoryOptions.length === 0 ? (
              <div className="mt-1.5 text-xs text-muted-foreground">등록된 카테고리가 없습니다.</div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {categoryOptions.map((opt) => {
                  const checked = form.categories.includes(opt.code);
                  return (
                    <label
                      key={opt.code}
                      className={cn(
                        "px-3 py-2 rounded-full border-2 text-sm font-semibold cursor-pointer transition-all",
                        checked
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-background text-foreground hover:border-primary/50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(opt.code)}
                        className="hidden"
                      />
                      <span>{opt.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="mt-1.5 text-xs text-muted-foreground">
              여러 개 선택 가능합니다. 고객 관심사와 일치할수록 추천에 노출될 가능성이 높아집니다.
            </div>
          </section>

          {/* 소개 / 혜택 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              소개 / 혜택
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">업체 소개</label>
                <textarea
                  value={form.intro}
                  onChange={(e) => update("intro", e.target.value)}
                  placeholder="고객에게 보여줄 업체 소개글을 입력하세요."
                  maxLength={2000}
                  className="w-full p-3 rounded-xl border border-input bg-background text-sm leading-relaxed resize-none min-h-[160px] focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-1.5 text-xs text-muted-foreground">{form.intro.length} / 2000자</div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">혜택 설명</label>
                <textarea
                  value={form.benefitText}
                  onChange={(e) => update("benefitText", e.target.value)}
                  placeholder="예: 방문 상담 시 5,000P 사용 가능"
                  maxLength={2000}
                  className="w-full p-3 rounded-xl border border-input bg-background text-sm leading-relaxed resize-none min-h-[160px] focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-1.5 text-xs text-muted-foreground">{form.benefitText.length} / 2000자</div>
              </div>
            </div>
          </section>

          {/* 연락처 / 링크 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              연락처 / 링크
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">전화번호</label>
                <Input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="010-1234-5678"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">주소</label>
                <Input
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="업체 주소"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">상세주소</label>
                <Input
                  value={form.detailAddress}
                  onChange={(e) => update("detailAddress", e.target.value)}
                  placeholder="상세주소 입력"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">알림 수신 이메일</label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => update("contactEmail", e.target.value)}
                  placeholder="partner@example.com"
                />
                <div className="mt-1.5 text-xs text-muted-foreground">고객 신청 시 이 이메일로 알림이 발송됩니다.</div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">신청 링크</label>
                <Input
                  value={form.applyUrl}
                  onChange={(e) => update("applyUrl", e.target.value)}
                  placeholder="https://example.com/apply"
                />
                <div className="mt-1.5 text-xs text-muted-foreground">http:// 또는 https:// 형식</div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">카카오채널 링크</label>
                <Input
                  value={form.kakaoChannelUrl}
                  onChange={(e) => update("kakaoChannelUrl", e.target.value)}
                  placeholder="https://pf.kakao.com/..."
                />
                <div className="mt-1.5 text-xs text-muted-foreground">http:// 또는 https:// 형식</div>
              </div>
            </div>
          </section>

          {/* 대표 이미지 */}
          <section className="bg-card shadow-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-4">
              대표 이미지
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
                e.target.value = "";
              }}
            />

            <div
              className="relative rounded-xl overflow-hidden border-2 border-dashed border-border max-w-xs aspect-video bg-muted flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="대표 이미지 미리보기"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-bold">이미지 변경</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImagePlus className="w-8 h-8" />
                  <span className="text-sm font-semibold">클릭하여 이미지 업로드</span>
                </div>
              )}
              {imageUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">업로드 중...</span>
                </div>
              )}
            </div>

            <div className="mt-2 text-xs text-muted-foreground">JPG, PNG, WEBP, GIF · 최대 5MB</div>

            {imagePreview && (
              <button
                type="button"
                onClick={() => { setImagePreview(""); update("coverImageUrl", ""); }}
                className="mt-2 text-xs font-bold text-destructive hover:underline"
              >
                이미지 삭제
              </button>
            )}
          </section>

          {/* 저장 / 취소 */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={cancelEdit}>
              취소
            </Button>
            <Button type="button" variant="default" onClick={save} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
