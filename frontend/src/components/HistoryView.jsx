import { useState, useEffect } from "react";
import { Trash2, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function HistoryView({ games }) {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [filterGameId, setFilterGameId] = useState("all");

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [filterGameId]);

  const fetchRecords = async () => {
    try {
      const gameParam = filterGameId !== "all" ? `?game_id=${filterGameId}` : "?limit=100";
      const response = await axios.get(`${API}/daily-records${gameParam}`);
      setRecords(response.data);
    } catch (error) {
      console.error("Error fetching records:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const gameParam = filterGameId !== "all" ? `?game_id=${filterGameId}` : "";
      const response = await axios.get(`${API}/stats${gameParam}`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm("確定要刪除此記錄嗎?")) return;
    
    try {
      await axios.delete(`${API}/daily-records/${recordId}`);
      toast.success("記錄已刪除");
      fetchRecords();
      fetchStats();
    } catch (error) {
      toast.error("刪除失敗");
      console.error(error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) {
      toast.error("請先選擇要刪除的記錄");
      return;
    }
    
    if (!window.confirm(`確定要刪除 ${selectedRecords.length} 筆記錄嗎?`)) return;
    
    try {
      await axios.delete(`${API}/daily-records/bulk/delete`, {
        data: selectedRecords
      });
      toast.success("記錄已批量刪除");
      setSelectedRecords([]);
      fetchRecords();
      fetchStats();
    } catch (error) {
      toast.error("刪除失敗");
      console.error(error);
    }
  };

  const toggleRecordSelection = (recordId) => {
    setSelectedRecords(prev => 
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  // Prepare chart data
  const weeklyData = records.slice(0, 7).reverse().map(record => ({
    date: format(new Date(record.date), 'MM/dd', { locale: zhCN }),
    完成率: record.completion_rate,
    已完成: record.completed_tasks,
    總任務: record.total_tasks,
    遊戲: record.game_name
  }));

  const monthlyData = records.slice(0, 30).reverse().map(record => ({
    date: format(new Date(record.date), 'MM/dd', { locale: zhCN }),
    完成率: record.completion_rate
  }));

  return (
    <div className="space-y-6" data-testid="history-view">
      {/* Filter and Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <Select value={filterGameId} onValueChange={setFilterGameId}>
            <SelectTrigger className="w-[200px] bg-[#141414] border-[#262626] text-white" data-testid="game-filter">
              <SelectValue placeholder="選擇遊戲" />
            </SelectTrigger>
            <SelectContent className="bg-[#141414] border-[#262626] text-white">
              <SelectItem value="all">所有遊戲</SelectItem>
              {games.map(game => (
                <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]" data-testid="total-records-stat">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">總記錄數</div>
          <div className="text-3xl font-bold text-white">{stats?.total_records || 0}</div>
        </div>
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]" data-testid="week-avg-stat">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">7天平均</div>
          <div className="text-3xl font-bold text-[#00F0FF]">{stats?.last_7_days?.avg_completion || 0}%</div>
        </div>
        <div className="p-4 rounded-lg bg-[#141414] border border-[#262626]" data-testid="month-avg-stat">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1">30天平均</div>
          <div className="text-3xl font-bold text-[#39FF14]">{stats?.last_30_days?.avg_completion || 0}%</div>
        </div>
      </div>

      {/* Charts */}
      {weeklyData.length > 0 && (
        <div className="space-y-6">
          <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]" data-testid="weekly-chart">
            <h3 className="text-xl font-medium text-neutral-200 mb-4">近7日完成率</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#737373" style={{ fontSize: '12px' }} />
                <YAxis stroke="#737373" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    border: '1px solid #262626',
                    borderRadius: '8px',
                    color: '#FFFFFF'
                  }}
                />
                <Bar dataKey="完成率" fill="#00F0FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {monthlyData.length > 7 && (
            <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]" data-testid="monthly-chart">
              <h3 className="text-xl font-medium text-neutral-200 mb-4">30日趨勢</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="date" stroke="#737373" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#737373" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141414',
                      border: '1px solid #262626',
                      borderRadius: '8px',
                      color: '#FFFFFF'
                    }}
                  />
                  <Line type="monotone" dataKey="完成率" stroke="#39FF14" strokeWidth={2} dot={{ fill: '#39FF14', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Records Table */}
      <div className="p-6 rounded-lg bg-[#141414] border border-[#262626]" data-testid="records-table">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-medium text-neutral-200">歷史記錄</h3>
          {selectedRecords.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className="bg-[#FF3B30] hover:bg-[#FF3B30]/90"
              data-testid="bulk-delete-button"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              刪除選中 ({selectedRecords.length})
            </Button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="text-center py-16 text-neutral-500" data-testid="empty-history">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-2">尚無歷史記錄</p>
            <p className="text-sm">完成任務後記錄將自動生成</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#262626] text-left">
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">
                    <input
                      type="checkbox"
                      checked={selectedRecords.length === records.length && records.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecords(records.map(r => r.id));
                        } else {
                          setSelectedRecords([]);
                        }
                      }}
                      className="rounded"
                      data-testid="select-all-checkbox"
                    />
                  </th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">日期</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">遊戲</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">已完成</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">總任務</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">完成率</th>
                  <th className="pb-3 text-xs font-bold tracking-[0.2em] uppercase text-neutral-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-[#262626] hover:bg-[#0A0A0A] transition-colors duration-200"
                    data-testid={`record-row-${record.id}`}
                  >
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={selectedRecords.includes(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                        className="rounded"
                        data-testid={`record-checkbox-${record.id}`}
                      />
                    </td>
                    <td className="py-3 text-neutral-200">
                      {format(new Date(record.date), 'yyyy/MM/dd (E)', { locale: zhCN })}
                    </td>
                    <td className="py-3 text-neutral-300 font-medium">{record.game_name}</td>
                    <td className="py-3 text-[#39FF14] font-medium">{record.completed_tasks}</td>
                    <td className="py-3 text-neutral-400">{record.total_tasks}</td>
                    <td className="py-3">
                      <span className="text-[#00F0FF] font-medium">{record.completion_rate}%</span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleDeleteRecord(record.id)}
                        className="p-1.5 rounded hover:bg-[#262626] text-[#FF3B30] transition-colors duration-200"
                        title="刪除"
                        data-testid={`delete-record-${record.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryView;