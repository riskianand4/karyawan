import { useState, useMemo, useEffect, useRef } from "react";
import { StatsSkeleton, CardGridSkeleton } from "@/components/PageSkeleton";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TaskContext";
import type { Task, TaskStatus, TeamGroup } from "@/types";
import TaskDetailModal from "@/components/TaskDetailModal";
import CreateTaskDialog from "@/components/CreateTaskDialog";
import TaskFilters from "@/components/TaskFilters";
import TaskListView from "@/components/TaskListView";
import ConfirmDialog from "@/components/ConfirmDialog";
import { motion } from "framer-motion";
import { CheckSquare, GripVertical, Flag, Inbox, Calendar, MessageCircleCodeIcon, Paperclip, Users, Clock, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, isPast, isToday } from "date-fns";
import { id as localeID } from "date-fns/locale";
import StatsCard from "@/components/StatsCard";
import EmployeeGrid, { EmployeeHeader } from "@/components/EmployeeGrid";
import { useAdminBadges } from "@/hooks/useAdminBadges";
import api from "@/lib/api";
import { toast } from "sonner";

const COLUMNS: { status: TaskStatus; label: string; accent: string; emptyText: string }[] = [
  { status: "todo", label: "Akan Dikerjakan", accent: "bg-muted-foreground", emptyText: "Tidak ada yang menunggu" },
  { status: "in-progress", label: "Sedang Dikerjakan", accent: "bg-primary", emptyText: "Mulai bekerja!" },
  { status: "needs-review", label: "Perlu Ditinjau", accent: "bg-warning", emptyText: "Semua sudah ditinjau" },
  { status: "completed", label: "Selesai", accent: "bg-success", emptyText: "Selesaikan tugas!" },
];

const PRIORITY_STYLES: Record<string, string> = { high: "bg-destructive/10 text-destructive", medium: "bg-warning/10 text-warning", low: "bg-muted text-muted-foreground" };
const PRIORITY_LABELS: Record<string, string> = { high: "Tinggi", medium: "Sedang", low: "Rendah" };

const Tasks = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, users } = useAuth();
  const { tasks, updateTaskStatus, refreshTasks, loading: tasksLoading } = useTasks();
  const adminBadges = useAdminBadges();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [pendingDrop, setPendingDrop] = useState<{ taskId: string; status: TaskStatus } | null>(null);
  const [taskTab, setTaskTab] = useState<"personal" | "team">(
    searchParams.get("tab") === "team" ? "team" : "personal"
  );
  const [teams, setTeams] = useState<TeamGroup[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    searchParams.get("teamId") || null
  );
  const [adminTab, setAdminTab] = useState<"employee" | "team">(
    searchParams.get("tab") === "team" ? "team" : "employee"
  );
  const [completionDrop, setCompletionDrop] = useState<{ taskId: string } | null>(null);
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [completingTask, setCompletingTask] = useState(false);
  const completionFileRef = useRef<HTMLInputElement>(null);

  const [employeeTasks, setEmployeeTasks] = useState<Task[]>([]);
  const [employeeTasksLoading, setEmployeeTasksLoading] = useState(false);

  useEffect(() => {
    api.getTeams().then(setTeams).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAdmin && employeeId) {
      setEmployeeTasksLoading(true);
      api.getTasks({ assigneeId: employeeId })
        .then(setEmployeeTasks)
        .catch(() => setEmployeeTasks([]))
        .finally(() => setEmployeeTasksLoading(false));
    }
  }, [isAdmin, employeeId]);

  const isLeader = useMemo(() => {
    if (!user) return false;
    return teams.some((t) => t.leaderId === user.id);
  }, [teams, user]);

  const leaderTeams = useMemo(() => {
    if (!user) return [];
    return teams.filter((t) => t.leaderId === user.id);
  }, [teams, user]);

  const allMyTasks = useMemo(() => {
    if (isAdmin && employeeId) return employeeTasks;
    return tasks;
  }, [tasks, isAdmin, employeeId, employeeTasks]);

  const teamTasksForSelectedTeam = useMemo(() => {
    if (!selectedTeamId) return [];
    return tasks.filter((task) => task.type === "team" && task.teamId === selectedTeamId);
  }, [tasks, selectedTeamId]);

  const filteredByTab = useMemo(() => {
    if (isAdmin) return allMyTasks;
    return allMyTasks.filter((t) => {
      if (taskTab === "personal") return t.type === "personal" || !t.type;
      return t.type === "team";
    });
  }, [allMyTasks, taskTab, isAdmin]);

  const myTasks = useMemo(() => {
    const sourceTasks = isAdmin && selectedTeamId ? teamTasksForSelectedTeam : filteredByTab;
    return sourceTasks.filter((t) => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [filteredByTab, isAdmin, selectedTeamId, teamTasksForSelectedTeam, search, priorityFilter]);

  useEffect(() => {
    if (selectedTask) {
      const source = isAdmin && employeeId ? employeeTasks : tasks;
      const updated = source.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated); else setSelectedTask(null);
    }
  }, [tasks, employeeTasks]);

  if (isAdmin && !employeeId && !selectedTeamId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-primary" /> Tugas
          </h1>
          <CreateTaskDialog teams={teams} isLeader={isLeader} />
        </div>
        <Tabs value={adminTab} onValueChange={(v) => setAdminTab(v as "employee" | "team")} className="w-full">
          <TabsList className="h-8">
            <TabsTrigger value="employee" className="text-xs px-4 h-7">Per Karyawan</TabsTrigger>
            <TabsTrigger value="team" className="text-xs px-4 h-7">Per Tim</TabsTrigger>
          </TabsList>
          <TabsContent value="employee" className="mt-3">
            <EmployeeGrid basePath="/tasks" badgeCounts={Object.fromEntries(Object.entries(adminBadges.perEmployee).map(([k, v]) => [k, v.tasks]))} />
          </TabsContent>
          <TabsContent value="team" className="mt-3">
            {teams.length === 0 ? (
              <EmptyState icon={Users} title="Belum ada tim" description="Buat tim terlebih dahulu di halaman Tim" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teams.map((team, i) => {
                  const teamTasks = tasks.filter((t) => t.type === "team" && t.teamId === team.id);
                  const doneTasks = teamTasks.filter((t) => t.status === "completed").length;
                  const leader = users.find((u) => u.id === team.leaderId);
                  return (
                    <motion.div
                      key={team.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedTeamId(team.id)}
                      className="ms-card-hover p-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{team.name}</p>
                          <p className="text-[10px] text-muted-foreground">Ketua: {leader?.name || "-"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <Badge variant="secondary" className="text-[10px]">{teamTasks.length} tugas</Badge>
                        <Badge variant="outline" className="text-[10px]">{doneTasks} selesai</Badge>
                        <Badge variant="outline" className="text-[10px]">{team.memberIds?.length || 0} anggota</Badge>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (isAdmin && selectedTeamId) {
    const team = teams.find((t) => t.id === selectedTeamId);
    const teamTasksList = myTasks;
    const pendingCount = teamTasksList.filter((t) => t.status === "todo").length;
    const inProgCount = teamTasksList.filter((t) => t.status === "in-progress").length;
    const reviewCount = teamTasksList.filter((t) => t.status === "needs-review").length;
    const doneCount = teamTasksList.filter((t) => t.status === "completed").length;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedTeamId(null)} className="text-xs text-primary hover:underline">← Kembali</button>
          <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" /> Tugas Tim: {team?.name}
          </h1>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <StatsCard label="Akan Dikerjakan" value={pendingCount} icon={Clock} color="text-amber-600" bgColor="bg-amber-600/20" delay={0} />
          <StatsCard label="Sedang Dikerjakan" value={inProgCount} icon={TrendingUp} color="" bgColor="bg-primary" delay={1} />
          <StatsCard label="Ditinjau" value={reviewCount} icon={AlertTriangle} color="text-orange-600" bgColor="bg-orange-600/20" delay={2} />
          <StatsCard label="Selesai" value={doneCount} icon={CheckCircle2} color="text-success" bgColor="bg-success/10" delay={3} />
        </div>
        <TaskFilters search={search} onSearchChange={setSearch} priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter} view={view} onViewChange={setView} />
        {teamTasksList.length === 0 ? (
          <EmptyState icon={Inbox} title="Belum ada tugas tim" description="Tugas tim yang dibuat untuk grup ini akan tampil di sini." />
        ) : view === "list" ? (
          <TaskListView tasks={teamTasksList} onTaskClick={setSelectedTask} isAdmin={isAdmin} />
        ) : (
          <KanbanBoard tasks={teamTasksList} columns={COLUMNS} users={users} canDragTask={() => false} onDragStart={() => {}} onDrop={(e: React.DragEvent) => { e.preventDefault(); setDragOverColumn(null); }} dragOverColumn={dragOverColumn} setDragOverColumn={setDragOverColumn} onTaskClick={setSelectedTask} />
        )}
        <TaskDetailModal task={selectedTask} open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null); }} />
      </div>
    );
  }

  const canDragTask = (task: Task) => {
    if (task.status === "completed") return false;
    if (isAdmin) return false;
    if (task.type === "team") return isLeader && leaderTeams.some((t) => t.id === task.teamId);
    return true;
  };

  const handleDragStart = (e: React.DragEvent, taskId: string, task: Task) => {
    if (!canDragTask(task)) return;
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const draggedTask = myTasks.find((t) => t.id === taskId);
    if (draggedTask?.status === "completed") {
      toast.error("Tugas yang sudah selesai tidak dapat diubah statusnya");
      setDragOverColumn(null);
      return;
    }

    if (status === "completed") {
      setCompletionDrop({ taskId });
      setCompletionFiles([]);
      if (completionFileRef.current) completionFileRef.current.value = "";
    } else {
      setPendingDrop({ taskId, status });
    }
    setDragOverColumn(null);
  };

  const confirmDrop = () => {
    if (pendingDrop) {
      updateTaskStatus(pendingDrop.taskId, pendingDrop.status);
      setPendingDrop(null);
    }
  };

  const handleCompletionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setCompletionFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const confirmCompletionDrop = async () => {
    if (!completionDrop || completionFiles.length === 0) return;

    try {
      setCompletingTask(true);
      const formData = new FormData();
      completionFiles.forEach((file) => formData.append("files", file));
      await api.uploadTaskAttachments(completionDrop.taskId, formData);
      await updateTaskStatus(completionDrop.taskId, "completed");
      await refreshTasks();
      setCompletionDrop(null);
      setCompletionFiles([]);
      toast.success("Tugas selesai dan dokumentasi tersimpan");
    } catch {
      toast.error("Gagal menyimpan dokumentasi penyelesaian");
    } finally {
      setCompletingTask(false);
    }
  };

  const isLoading = isAdmin && employeeId ? employeeTasksLoading : tasksLoading;

  const pending = filteredByTab.filter((t) => t.status === "todo").length;
  const inProg = filteredByTab.filter((t) => t.status === "in-progress").length;
  const review = filteredByTab.filter((t) => t.status === "needs-review").length;
  const done = filteredByTab.filter((t) => t.status === "completed").length;

  const miniStats = [
    { label: "Akan Dikerjakan", value: pending, icon: Clock, color: "text-amber-600", bgColor: "bg-amber-600/20" },
    { label: "Sedang Dikerjakan", value: inProg, icon: TrendingUp, color: "", bgColor: "bg-primary" },
    { label: "Ditinjau", value: review, icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-600/20" },
    { label: "Selesai", value: done, icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10" },
  ];

  const personalCount = allMyTasks.filter((t) => t.type === "personal" || !t.type).length;
  const teamCount = allMyTasks.filter((t) => t.type === "team").length;

  return (
    <div className="space-y-3">
      {isAdmin && employeeId && <EmployeeHeader employeeId={employeeId} backPath="/tasks" />}

      {!isAdmin && (
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-primary" /> Tugas
          </h1>
          {isLeader && <CreateTaskDialog teams={leaderTeams} isLeader={isLeader} />}
        </div>
      )}

      {!isAdmin && (
        <Tabs value={taskTab} onValueChange={(v) => setTaskTab(v as "personal" | "team")} className="w-full">
          <TabsList className="h-8">
            <TabsTrigger value="personal" className="text-xs px-3 h-7">
              Pribadi {personalCount > 0 && <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1">{personalCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs px-3 h-7">
              Tim {teamCount > 0 && <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1">{teamCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <>
          <StatsSkeleton count={4} />
          <CardGridSkeleton count={8} cols={4} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {miniStats.map((s, i) => <StatsCard key={s.label} {...s} delay={i} />)}
          </div>

          <TaskFilters search={search} onSearchChange={setSearch} priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter} view={view} onViewChange={setView} />

          {myTasks.length === 0 && !search && priorityFilter === "all" ? (
            <EmptyState
              icon={Inbox}
              title={isAdmin && employeeId ? "Belum ada tugas untuk karyawan ini" : taskTab === "team" ? "Belum ada tugas tim" : "Belum ada tugas"}
              description=""
            />
          ) : view === "list" ? (
            <TaskListView tasks={myTasks} onTaskClick={setSelectedTask} isAdmin={isAdmin} />
          ) : (
            <KanbanBoard tasks={myTasks} columns={COLUMNS} users={users} canDragTask={canDragTask} onDragStart={handleDragStart} onDrop={handleDrop} dragOverColumn={dragOverColumn} setDragOverColumn={setDragOverColumn} onTaskClick={setSelectedTask} />
          )}

          <TaskDetailModal task={selectedTask} open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null); }} />
          <ConfirmDialog open={!!pendingDrop} onOpenChange={(open) => { if (!open) setPendingDrop(null); }} title="Ubah status tugas?" description="Yakin ingin memindahkan tugas ini ke status baru?" onConfirm={confirmDrop} />
          <Dialog open={!!completionDrop} onOpenChange={(open) => { if (!open) { setCompletionDrop(null); setCompletionFiles([]); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm">Dokumentasi Penyelesaian Tugas</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">Upload minimal 1 file dokumentasi (gambar/PDF) sebagai bukti penyelesaian tugas.</p>
              <div className="space-y-3">
                <input ref={completionFileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleCompletionFileChange} className="hidden" />
                <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full border-dashed" onClick={() => completionFileRef.current?.click()}>
                  <Paperclip className="w-3.5 h-3.5" /> Pilih File Dokumentasi
                </Button>
                {completionFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {completionFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted text-xs">
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1 text-foreground">{file.name}</span>
                        <span className="text-muted-foreground shrink-0">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button className="w-full text-xs" disabled={completionFiles.length === 0 || completingTask} onClick={confirmCompletionDrop}>
                  {completingTask ? "Menyimpan dokumentasi..." : `Selesaikan Tugas (${completionFiles.length} file)`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default Tasks;

interface KanbanBoardProps {
  tasks: Task[];
  columns: typeof COLUMNS;
  users: any[];
  canDragTask: (task: Task) => boolean;
  onDragStart: (e: React.DragEvent, taskId: string, task: Task) => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  dragOverColumn: TaskStatus | null;
  setDragOverColumn: (s: TaskStatus | null) => void;
  onTaskClick: (task: Task) => void;
}

const KanbanBoard = ({ tasks, columns, users, canDragTask, onDragStart, onDrop, dragOverColumn, setDragOverColumn, onTaskClick }: KanbanBoardProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
    {columns.map((col) => {
      const colTasks = tasks.filter((t) => t.status === col.status);
      return (
        <div key={col.status}
          onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.status); }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={(e) => onDrop(e, col.status)}
          className={`rounded-xl p-3 transition-all min-h-[220px] ${dragOverColumn === col.status ? "bg-accent ring-2 ring-primary/20 scale-[1.01]" : "bg-muted/40"}`}
        >
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`w-2.5 h-2.5 rounded-full ${col.accent}`} />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</span>
            <Badge variant="secondary" className="ml-auto text-[10px] h-5">{colTasks.length}</Badge>
          </div>
          <div className="space-y-2">
            {colTasks.length === 0 ? (
              <div className="text-center py-8"><p className="text-xs text-muted-foreground/60">{col.emptyText}</p></div>
            ) : colTasks.map((task, i) => {
              const deadlineDate = new Date(task.deadline);
              const overdue = isPast(deadlineDate) && task.status !== "completed";
              const dueToday = isToday(deadlineDate);
              const draggable = canDragTask(task);
              return (
                <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  draggable={draggable} onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, task.id, task)}
                  onClick={() => onTaskClick(task)} className="ms-card-hover p-3 cursor-pointer group"
                >
                  <div className="flex items-start gap-2">
                    {draggable && <GripVertical className="w-4 h-4 text-muted-foreground/20 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        {task.type === "team" && <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">Tim</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${PRIORITY_STYLES[task.priority]}`}><Flag className="w-2.5 h-2.5 inline mr-0.5" />{PRIORITY_LABELS[task.priority]}</span>
                        <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? "text-destructive font-medium" : dueToday ? "text-warning" : "text-muted-foreground"}`}>
                          <Calendar className="w-2.5 h-2.5" />{overdue ? "Terlambat" : formatDistanceToNow(deadlineDate, { addSuffix: true, locale: localeID })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {task.notes.length > 0 && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MessageCircleCodeIcon className="w-2.5 h-2.5" /> {task.notes.length}</span>}
                        {(task.attachments?.length || 0) > 0 && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" /> {task.attachments.length}</span>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);