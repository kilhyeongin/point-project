import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "./setup/db";
import { creditWallet, debitWallet, getWalletBalance, getWalletBalancesMap } from "@/services/wallet";

describe("wallet service", () => {
  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => { await clearDB(); });

  const uid = () => new mongoose.Types.ObjectId();

  // ── creditWallet ─────────────────────────────────────────────────

  it("creditWallet: 잔액이 증가한다", async () => {
    const id = uid();
    await creditWallet(id, 1000);
    expect(await getWalletBalance(id)).toBe(1000);
  });

  it("creditWallet: 여러 번 적립하면 누적된다", async () => {
    const id = uid();
    await creditWallet(id, 1000);
    await creditWallet(id, 500);
    expect(await getWalletBalance(id)).toBe(1500);
  });

  it("creditWallet: 0 이하 금액은 에러", async () => {
    const id = uid();
    await expect(creditWallet(id, 0)).rejects.toThrow();
    await expect(creditWallet(id, -100)).rejects.toThrow();
  });

  // ── debitWallet ──────────────────────────────────────────────────

  it("debitWallet: 잔액이 감소한다", async () => {
    const id = uid();
    await creditWallet(id, 1000);
    await debitWallet(id, 300);
    expect(await getWalletBalance(id)).toBe(700);
  });

  it("debitWallet: 잔액 부족 시 에러가 발생한다", async () => {
    const id = uid();
    await creditWallet(id, 100);
    await expect(debitWallet(id, 101)).rejects.toThrow("잔액 부족");
  });

  it("debitWallet: 잔액이 0일 때 에러가 발생한다", async () => {
    const id = uid();
    await expect(debitWallet(id, 1)).rejects.toThrow("잔액 부족");
  });

  it("debitWallet: 음수 잔액이 되지 않는다", async () => {
    const id = uid();
    await creditWallet(id, 500);
    await expect(debitWallet(id, 600)).rejects.toThrow();
    expect(await getWalletBalance(id)).toBe(500); // 변하지 않음
  });

  it("debitWallet: 정확히 잔액만큼 차감 가능하다", async () => {
    const id = uid();
    await creditWallet(id, 1000);
    await debitWallet(id, 1000);
    expect(await getWalletBalance(id)).toBe(0);
  });

  it("debitWallet: 0 이하 금액은 에러", async () => {
    const id = uid();
    await creditWallet(id, 1000);
    await expect(debitWallet(id, 0)).rejects.toThrow();
    await expect(debitWallet(id, -100)).rejects.toThrow();
  });

  it("debitWallet: 잔액 부족 에러 메시지에 현재 잔액과 요청 금액이 포함된다", async () => {
    const id = uid();
    await creditWallet(id, 100);
    await expect(debitWallet(id, 200)).rejects.toThrow("100");
    await expect(debitWallet(id, 200)).rejects.toThrow("200");
  });

  // ── getWalletBalance ─────────────────────────────────────────────

  it("getWalletBalance: 지갑이 없으면 0을 반환한다", async () => {
    expect(await getWalletBalance(uid())).toBe(0);
  });

  it("getWalletBalance: 충전 후 올바른 잔액을 반환한다", async () => {
    const id = uid();
    await creditWallet(id, 7777);
    expect(await getWalletBalance(id)).toBe(7777);
  });

  // ── getWalletBalancesMap ─────────────────────────────────────────

  it("getWalletBalancesMap: 여러 유저 잔액을 한 번에 조회한다", async () => {
    const id1 = uid();
    const id2 = uid();
    await creditWallet(id1, 1000);
    await creditWallet(id2, 2000);

    const map = await getWalletBalancesMap([id1, id2]);
    expect(map.get(String(id1))).toBe(1000);
    expect(map.get(String(id2))).toBe(2000);
  });

  it("getWalletBalancesMap: 빈 배열은 빈 맵을 반환한다", async () => {
    const map = await getWalletBalancesMap([]);
    expect(map.size).toBe(0);
  });

  it("getWalletBalancesMap: 지갑 없는 유저는 0으로 초기화된다", async () => {
    const id = uid();
    const map = await getWalletBalancesMap([id]);
    expect(map.get(String(id))).toBe(0);
  });

  // ── creditWallet 반환값 ──────────────────────────────────────────

  it("creditWallet: balanceBefore/balanceAfter를 반환한다", async () => {
    const id = uid();
    await creditWallet(id, 500);
    const result = await creditWallet(id, 300);
    expect(result.balanceBefore).toBe(500);
    expect(result.balanceAfter).toBe(800);
  });

  it("debitWallet: balanceBefore/balanceAfter를 반환한다", async () => {
    const id = uid();
    await creditWallet(id, 1000);
    const result = await debitWallet(id, 400);
    expect(result.balanceBefore).toBe(1000);
    expect(result.balanceAfter).toBe(600);
  });
});
