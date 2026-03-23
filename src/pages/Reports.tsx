import { useTasks } from "@/contexts/TaskContext";
import { useAuth } from "@/contexts/AuthContext";
import { StatsSkeleton, TableSkeleton } from "@/components/PageSkeleton";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, AlertTriangle, Users, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/StatsCard";

const Reports = () => {
  const { tasks, loading: tasksLoading } = useTasks();
  const { users } = useAuth();
  const employees = users.filter((u) => u.role === "employee");

  const totalBulanIni = tasks.length;
  const selesaiBulanIni = tasks.filter((t) => t.status === "completed").length;
  const terlambat = tasks.filter((t) => new Date(t.deadline) < new Date() && t.status !== "completed").length;
  const rataRataPenyelesaian = totalBulanIni > 0 ? Math.round((selesaiBulanIni / totalBulanIni) * 100) : 0;

  const employeeData = employees.map((emp) => {
    const empTasks = tasks.filter((t) => t.assigneeId === emp.id);
    const completed = empTasks.filter((t) => t.status === "completed").length;
    const overdue = empTasks.filter((t) => new Date(t.deadline) < new Date() && t.status !== "completed").length;
    return { name: emp.name.split(" ")[0], total: empTasks.length, selesai: completed, terlambat: overdue, tingkat: empTasks.length > 0 ? Math.round((completed / empTasks.length) * 100) : 0 };
  });

  const stats = [
    { label: "Total Tugas", value: totalBulanIni, icon: BarChart3, color: "", bgColor: "bg-primary" },
    { label: "Tingkat Penyelesaian", value: rataRataPenyelesaian, icon: TrendingUp, color: "text-success", bgColor: "bg-success/10" },
    { label: "Tugas Terlambat", value: terlambat, icon: AlertTriangle, color: "text-destructive", bgColor: "bg-destructive/10" },
    { label: "Anggota Tim", value: employees.length, icon: Users, color: "text-violet-600", bgColor: "bg-violet-600/20" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 print:space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-primary" /> Laporan & Analitik</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs print:hidden"><Printer className="w-3.5 h-3.5" /> Ekspor PDF</Button>
      </div>
      {tasksLoading ? (
        <>
          <StatsSkeleton count={4} />
          <TableSkeleton rows={5} cols={5} />
        </>
      ) : (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{stats.map((s, i) => (<StatsCard key={s.label} {...s} delay={i} />))}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="ms-card p-4">
          <h2 className="text-xs font-semibold text-foreground mb-3">Distribusi Tugas Per Karyawan</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={employeeData} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="selesai" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Selesai" />
              <Bar dataKey="terlambat" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name="Terlambat" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="ms-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border"><h2 className="text-sm font-semibold text-foreground">Ringkasan Kinerja Tim</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Karyawan</th>
              <th className="text-center px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
              <th className="text-center px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Selesai</th>
              <th className="text-center px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Terlambat</th>
              <th className="text-center px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tingkat</th>
            </tr></thead>
            <tbody>
              {employeeData.map((emp) => (
                <tr key={emp.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{emp.name}</td>
                  <td className="px-5 py-3 text-sm text-center text-muted-foreground">{emp.total}</td>
                  <td className="px-5 py-3 text-sm text-center text-success font-medium">{emp.selesai}</td>
                  <td className="px-5 py-3 text-sm text-center">{emp.terlambat > 0 ? <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px]">{emp.terlambat}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-5 py-3 text-sm text-center font-semibold text-foreground">{emp.tingkat}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default Reports;