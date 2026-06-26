"use client";

import { useState } from "react";

interface PointsData {
  phone: string;
  points: { total: number; redeemed: number; available: number };
  tasks: {
    taskType: string;
    status: string;
    points: number;
    submittedAt: number;
    reviewNote?: string;
  }[];
  taskProgress: {
    taskType: string;
    approved: number;
    limit: number;
  }[];
  redeems: {
    rewardName: string;
    pointsCost: number;
    status: string;
    createdAt: number;
    cardNumber?: string;
    cardSecret?: string;
  }[];
}

interface Reward {
  tier: number;
  name: string;
  pointsCost: number;
  totalCount: number;
  remainingCount: number;
}

export default function Home() {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<PointsData | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redeemMsg, setRedeemMsg] = useState("");

  async function handleQuery() {
    if (!phone || phone.length < 11) {
      setError("请输入正确的手机号");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);

    try {
      const [pointsRes, rewardsRes] = await Promise.all([
        fetch(`/api/points?phone=${phone}`),
        fetch("/api/redeem"),
      ]);

      if (!pointsRes.ok) {
        const err = await pointsRes.json();
        setError(err.error || "查询失败");
        return;
      }

      setData(await pointsRes.json());
      const rewardsData = await rewardsRes.json();
      setRewards(rewardsData.rewards || []);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem(tier: number) {
    setRedeemMsg("");
    const res = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, tier }),
    });
    const result = await res.json();
    if (result.success) {
      setRedeemMsg("兑换申请已提交！活动结束后统一发放。");
      handleQuery();
    } else {
      setRedeemMsg(result.error || "兑换失败");
    }
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending": return "审核中";
      case "approved": return "已通过";
      case "rejected": return "未通过";
      case "over_limit": return "已达上限";
      case "fulfilled": return "已发放";
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": case "fulfilled": return "text-emerald-600 bg-emerald-50";
      case "rejected": return "text-red-600 bg-red-50";
      case "over_limit": return "text-gray-500 bg-gray-100";
      default: return "text-amber-600 bg-amber-50";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-indigo-700">KerWork 体验官</h1>
          <p className="text-sm text-gray-500 mt-1">积分查询与礼品兑换</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            输入注册手机号查询积分
          </label>
          <div className="flex gap-3">
            <input
              type="tel"
              maxLength={11}
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
            />
            <button
              onClick={handleQuery}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? "..." : "查询"}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {data && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">积分概览</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-indigo-50 rounded-xl">
                  <div className="text-2xl font-bold text-indigo-600">{data.points.total}</div>
                  <div className="text-xs text-gray-500 mt-1">累计获得</div>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                  <div className="text-2xl font-bold text-emerald-600">{data.points.available}</div>
                  <div className="text-xs text-gray-500 mt-1">可用积分</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-500">{data.points.redeemed}</div>
                  <div className="text-xs text-gray-500 mt-1">已兑换</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">任务进度</h2>
              <div className="flex flex-wrap gap-2">
                {data.taskProgress.map((tp) => (
                  <div key={tp.taskType} className={`text-xs px-3 py-1.5 rounded-full ${tp.approved >= tp.limit ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-600"}`}>
                    {tp.taskType} {tp.approved}/{tp.limit}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">任务记录</h2>
              {data.tasks.length === 0 ? (
                <p className="text-gray-400 text-sm">暂无任务记录</p>
              ) : (
                <div className="space-y-3">
                  {data.tasks.map((task, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{task.taskType}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(task.submittedAt).toLocaleDateString("zh-CN")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColor(task.status)}`}>
                          {statusLabel(task.status)}
                        </span>
                        {task.status === "approved" && (
                          <span className="text-sm font-semibold text-indigo-600">+{task.points}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">礼品兑换</h2>
              {redeemMsg && (
                <div className="text-sm p-3 rounded-xl bg-indigo-50 text-indigo-700 mb-4">{redeemMsg}</div>
              )}
              <div className="space-y-3">
                {rewards.map((reward) => (
                  <div key={reward.tier} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-gray-700">{reward.name}</div>
                      <div className="text-xs text-gray-400">
                        {reward.pointsCost} 积分 · 剩余 {reward.remainingCount}/{reward.totalCount}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRedeem(reward.tier)}
                      disabled={data.points.available < reward.pointsCost || reward.remainingCount <= 0}
                      className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      兑换
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {data.redeems.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">兑换记录</h2>
                <div className="space-y-3">
                  {data.redeems.map((r, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{r.rewardName}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColor(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(r.createdAt).toLocaleDateString("zh-CN")} · -{r.pointsCost} 积分
                      </div>
                      {r.cardNumber && (
                        <div className="mt-2 p-2 bg-white border border-dashed border-indigo-200 rounded-lg">
                          <div className="text-xs text-gray-500">卡号：<span className="font-mono text-gray-800">{r.cardNumber}</span></div>
                          <div className="text-xs text-gray-500">卡密：<span className="font-mono text-gray-800">{r.cardSecret}</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="text-center text-xs text-gray-400 mt-8">
          KerWork 体验官活动 · 2026.6.24 - 2026.7.24
        </div>
      </div>
    </main>
  );
}
