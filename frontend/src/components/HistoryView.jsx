import { useState, useEffect, useCallback } from "react";
import { Trash2, Calendar, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TYPE_LABELS = { daily: "每日", weekly: "每周", version: "版本", all: "全部" };

function HistoryView({ games }) {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [filterGameId, setFilterGameId] = useState("all");
  const [taskType, setTaskType] = useState("daily");
  const [expandedGroups, setExpandedGroups] = useState({});

  const fetchRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filterGameId !== "all") params.set("game_id", filterGameId);
      if (taskType !== "all") params.set("task_type", taskType);
      const res = await axios.get(`${API}/daily-records?${params.toString()}`);
      setRecords(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [filterGameId, taskType]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterGameId !== "all") params.set("game_id", filterGameId);
      if (taskType !== "all") params.set("task_type", taskType);
      const res = await axios.get(`${API}/stats?${params.toString()}`);
      setStats(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [filterGameId, taskType]);

  useEffect(() => {
    fetchRecords();
    fetchStats();
    setSelectedRecords([]);
    setExpandedGroups({});
  }, [fetchRecords, fetchStats]);

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm("確定要刪除此記錄嗎?")) return;
    try {
      await axios.delete(`${API}/daily-records/${recordId}`);
      toast.success("記錄已刪除");
      fetchRecords();
      fetchStats();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("刪除失敗: " + detail);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) return;
    if (!window.confirm(`確定要刪除 ${selectedRecords.length} 筆記錄嗎?`)) return;
    try {
      await axios.delete(`${API}/daily-records/bulk/delete`, { data: selectedRecords });
      toast.success("已批量刪除");
      setSelectedRecords([]);
      fetchRecords();
      fetchStats();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "未知錯誤";
      toast.error("刪除失敗: " + detail);
    }
  };

  const toggleRecordSelection = (recordId) =>
    setSelectedRecords((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));

  // ===== Group records by (date + task_type) =====
  const grouped = (() => {
    const map = new Map();
    for (const r of records) {
      const key = `${r.date}__${r.task_type || "daily"}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          date: r.date,
          task_type: r.task_type || "daily",
          items: [],
        });
      }
      map.get(key).items.push(r);
    }
    // Sort groups by date desc
    return Array.from(map.values()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  })();

  const groupStats = (group) => {
    let totalTasks = 0, done = 0;
    for (const r of group.items) {
      totalTasks += r.total_tasks || 0;
      done += r.completed_tasks || 0;
    }
    const rate = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;
    return { totalTasks, done, rate, gameCount: group.items.length };
  };

  const toggleGroup = (key) => setExpandedGroups((p) => ({ ...p, [key]: !p[key] }));

  const isGroupAllSelected = (group) => group.items.every((r) => selectedRecords.includes(r.id));
  const toggleGroupSelection = (group) => {
    const ids = group.items.map((r) => r.id);
    setSelectedRecords((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

  const allRecordIds = records.map((r) => r.id);
  const allSelected = allRecordIds.length > 0 && allRecordIds.every((id) => selectedRecords.includes(id));

  const weeklyData = records.slice(0, 7).reverse().map((r) => ({
    date: format(new Date(r.date), "MM/dd", { locale: zhCN }),
    完成率: r.completion_rate,
  }));
  const monthlyData = records.slice(0, 30).reverse().map((r) => ({
    date: format(new Date(r.date), "MM/dd", { locale: zhCN }),
    完成率: r.completion_rate,
  }));

  return (
    <div className="space-y-6" data-testid="history-view">
      <Tabs value={taskType} onValueChange={setTaskType}>
        <TabsList className="grid grid-cols-4 max-w-md">
          <TabsTrigger value="daily" data-testid="history-type-daily">每日</TabsTrigger>
          <TabsTrigger value="weekly" data-testid="history-type-weekly">每周</TabsTrigger>
          <TabsTrigger value="version" data-testid="history-type-version">版本</TabsTrigger>
          <TabsTrigger value="all" data-testid="history-type-all">全部</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-neutral-400" />
        <Select value={filterGameId} onValueChange={setFilterGameId}>
          <SelectTrigger className="w-[200px] bg-[#141414] border-[#262626] text-white" data-testid="game-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#141414] border-[#262626] text-white">
            <SelectItem value="all">所有遊戲</SelectItem>
            {games.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]" data-testid="total-records-stat">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">總記錄數</div>
          <div className="text-3xl font-bold text-white">{stats?.total_records || 0}</div>
        </div>
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">7天平均</div>
          <div className="text-3xl font-bold text-[#00F0FF]">{stats?.last_7_days?.avg_completion || 0}%</div>
        </div>
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">30天平均</div>
          <div className="text-3xl font-bold text-[#39FF14]">{stats?.last_30_days?.avg_completion || 0}%</div>
        </div>
      </div>

      {weeklyData.length > 0 && (
        <div className="space-y-6">
          <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]">
            <h3 className="text-xl font-medium text-neutral-200 mb-4">近7日完成率 ({TYPE_LABELS[taskType]})</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#737373" style={{ fontSize: "12px" }} />
                <YAxis stroke="#737373" style={{ fontSize: "12px" }} />
                <Tooltip contentStyle={{ backgroundColor: "#141414", border: "1px solid #262626", borderRadius: "8px", color: "#FFFFFF" }} />
                <Bar dataKey="完成率" fill="#00F0FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {monthlyData.length > 7 && (
            <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]">
              <h3 className="text-xl font-medium text-neutral-200 mb-4">30日趨勢</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="date" stroke="#737373" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#737373" style={{ fontSize: "12px" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#141414", border: "1px solid #262626", borderRadius: "8px", color: "#FFFFFF" }} />
                  <Line type="monotone" dataKey="完成率" stroke="#39FF14" strokeWidth={2} dot={{ fill: "#39FF14", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]" data-testid="records-table">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-medium text-neutral-200">歷史記錄 ({TYPE_LABELS[taskType]})</h3>
          {selectedRecords.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="bg-[#FF3B30] hover:bg-[#FF3B30]/90" data-testid="bulk-delete-button">
              <Trash2 className="w-4 h-4 mr-2" />刪除選中 ({selectedRecords.length})
            </Button>
          )}
        </div>
        {records.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-2">尚無歷史記錄</p>
            <p className="text-sm">任務重置後記錄將自動生成</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#262626] text-left">
                  <th className="pb-3 pr-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => setSelectedRecords(e.target.checked ? allRecordIds : [])}
                      className="rounded"
                      data-testid="select-all-checkbox"
                    />
                  </th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">日期</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">類型</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">遊戲</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">完成/總計</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">完成率</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => {
                  const gs = groupStats(group);
                  const isOpen = !!expandedGroups[group.key];
                  return (
                    <>
                      <tr
                        key={group.key}
                        className="border-b border-[#262626] hover:bg-[#0A0A0A] cursor-pointer"
                        onClick={() => toggleGroup(group.key)}
                        data-testid={`group-row-${group.key}`}
                      >
                        <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isGroupAllSelected(group)}
                            onChange={() => toggleGroupSelection(group)}
                            className="rounded"
                            data-testid={`group-checkbox-${group.key}`}
                          />
                        </td>
                        <td className="py-3 text-neutral-200 flex items-center gap-2">
                          {isOpen ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                          {format(new Date(group.date), "yyyy/MM/dd (E)", { locale: zhCN })}
                        </td>
                        <td className="py-3 text-neutral-400 text-sm">{TYPE_LABELS[group.task_type]}</td>
                        <td className="py-3 text-neutral-300 font-medium">
                          <span className="text-neutral-500 text-sm">共 {gs.gameCount} 個遊戲</span>
                        </td>
                        <td className="py-3 text-neutral-300">
                          <span className="text-[#39FF14] font-medium">{gs.done}</span>
                          <span className="text-neutral-500">/{gs.totalTasks}</span>
                        </td>
                        <td className="py-3">
                          <span className="text-[#00F0FF] font-medium">{gs.rate}%</span>
                        </td>
                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`確定要刪除 ${group.items.length} 筆記錄?`)) return;
                              try {
                                await axios.delete(`${API}/daily-records/bulk/delete`, { data: group.items.map((r) => r.id) });
                                toast.success("已刪除整組");
                                fetchRecords();
                                fetchStats();
                              } catch (err) {
                                toast.error("刪除失敗");
                              }
                            }}
                            className="p-1.5 rounded hover:bg-[#262626] text-[#FF3B30]"
                            title="刪除整組"
                            data-testid={`delete-group-${group.key}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {isOpen && group.items.map((r) => (
                        <tr key={r.id} className="border-b border-[#262626]/50 bg-[#0A0A0A]/40 hover:bg-[#0A0A0A]" data-testid={`record-row-${r.id}`}>
                          <td className="py-2 pr-2 pl-6">
                            <input
                              type="checkbox"
                              checked={selectedRecords.includes(r.id)}
                              onChange={() => toggleRecordSelection(r.id)}
                              className="rounded"
                              data-testid={`record-checkbox-${r.id}`}
                            />
                          </td>
                          <td className="py-2 pl-6 text-neutral-400 text-sm">└</td>
                          <td className="py-2 text-neutral-500 text-xs">{TYPE_LABELS[r.task_type] || "每日"}</td>
                          <td className="py-2 text-neutral-300 font-medium">{r.game_name}</td>
                          <td className="py-2 text-neutral-300">
                            <span className="text-[#39FF14] font-medium">{r.completed_tasks}</span>/{r.total_tasks}
                          </td>
                          <td className="py-2"><span className="text-[#00F0FF] font-medium">{r.completion_rate}%</span></td>
                          <td className="py-2">
                            <button
                              onClick={() => handleDeleteRecord(r.id)}
                              className="p-1.5 rounded hover:bg-[#262626] text-[#FF3B30]"
                              title="刪除"
                              data-testid={`delete-record-${r.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryView;
