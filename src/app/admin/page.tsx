"use client";

import { useState, useEffect } from "react";

interface Submission {
  recordId: string;
  phone: string;
  wechat: string;
  taskType: string;
  content: string;
  submittedAt: number;
  submitter: string;
  status: string;
  points: number;
  reviewedAt?: number;
  reviewNote?: string;
}

interface Reward {
  tier: number;
  name: string;
  pointsCost: number;
  totalCount: number;
  remainingCount: number;
}

export default function AdminPage() {
  const [tab, setTab] = useState<"review" | "rewards" | "cards">("review");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [subRes, rewRes] = await Promise.all([
      fetch("/api/admin/review"),
      fetch("/api/redeem"),
    ]);
    const subData = await subRes.json();
    const rewData = await rewRes.json();
    setSubmissions(subData.submissions || []);
    setRewards(rewData.rewards || []);
  }

  async function handleSync() {
    setSyncing(true);
    setMsg("");
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      setMsg(`同步完成：新增 ${data.newCount} 条，共 ${data.total} 条`);
      loadData();
    } else {
      setMsg(`同步失败：${data.error}`);
    }
    setSyncing(false);
  }

  async function handleReview(recordId: string, action: "approve" | "reject") {
    const res = await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, action }),
    });
    const data = await res.json();
    if (data.success) loadData();
  }

  async function handleFulfill() {
    const res = await fetch("/api/admin/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fulfill" }),
    });
    const data = await res.json();
    setMsg(data.success ? `已发放 ${data.fulfilled} 张卡密` : data.error);
  }

  async function handleImportCards() {
    const input = prompt("请粘贴卡密数据（每行格式：档位,卡号,卡密）");
    if (!input) return;
    const cards = input.split("\n").filter(Boolean).map((line) => {
      const [tier, cardNumber, cardSecret] = line.split(",");
      return { tier: Number(tier), cardNumber: cardNumber.trim(), cardSecret: cardSecret.trim() };
    });
    const res = await fetch("/api/admin/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import", cards }),
    });
    const data = await res.json();
    setMsg(data.success ? `已导入 ${data.imported} 张卡密` : data.error);
  }

  const filtered = submissions.filter((s) => filter === "all" || s.status === filter);

  const tabStyle = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition ${
      tab === t ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">KerWork 运营后台</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {syncing ? "同步中..." : "同步飞书数据"}
          </button>
        </div>

        {msg && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">{msg}</div>
        )}

        <div className="flex gap-2 mb-6">
          <button className={tabStyle("review")} onClick={() => setTab("review")}>任务审核</button>
          <button className={tabStyle("rewards")} onClick={() => setTab("rewards")}>礼品池</button>
          <button className={tabStyle("cards")} onClick={() => setTab("cards")}>卡密管理</button>
        </div>

        {tab === "review" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex gap-2 mb-4">
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-full ${
                    filter === f ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {f === "all" ? "全部" : f === "pending" ? "待审核" : f === "approved" ? "已通过" : "已拒绝"}
                  {f !== "all" && ` (${submissions.filter((s) => s.status === f).length})`}
                </button>
              ))}
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filtered.map((s) => (
                <div key={s.recordId} className="p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-semibold text-indigo-600">{s.taskType}</span>
                      <span className="text-xs text-gray-400 ml-2">+{s.points}分</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(s.submittedAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{s.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {s.phone} · {s.submitter}
                    </span>
                    {s.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(s.recordId, "approve")}
                          className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReview(s.recordId, "reject")}
                          className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          拒绝
                        </button>
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        s.status === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}>
                        {s.status === "approved" ? "已通过" : "已拒绝"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-gray-400 py-8">暂无记录</p>
              )}
            </div>
          </div>
        )}

        {tab === "rewards" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">礼品池状态</h2>
            <div className="space-y-3">
              {rewards.map((r) => (
                <div key={r.tier} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.pointsCost} 积分/份</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-indigo-600">{r.remainingCount}</div>
                    <div className="text-xs text-gray-400">剩余 / {r.totalCount} 总</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "cards" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex gap-3 mb-4">
              <button
                onClick={handleImportCards}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                导入卡密
              </button>
              <button
                onClick={handleFulfill}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                一键发放卡密
              </button>
            </div>
            <p className="text-sm text-gray-500">
              导入格式：每行一条，格式为「档位,卡号,卡密」（如：200,6226000000001,abc123）
            </p>
            <p className="text-sm text-gray-500 mt-1">
              点击「一键发放卡密」将自动为所有待发放的兑换申请分配对应档位的卡密。
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
