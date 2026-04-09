const Task = require("../models/Task");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const TeamGroup = require("../models/TeamGroup");
const User = require("../models/User");
const PositionAccess = require("../models/PositionAccess");

const getUsersByIds = async (userIds = []) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  return User.find({ _id: { $in: uniqueIds } });
};

const getUsersWithPreference = async (userIds = [], preferenceKey) => {
  const users = await getUsersByIds(userIds);
  return users.filter((user) => user.notificationSettings?.[preferenceKey] !== false);
};

const hasTasksAccess = async (user) => {
  if (user.role === "admin") return true;
  const position = user.position || "";
  if (!position) return false;
  const pa = await PositionAccess.findOne({ position });
  return pa?.menus?.tasks === true;
};

exports.getAll = async (query = {}, requestUser = null) => {
  const filter = {};
  if (query.assigneeId) filter.assigneeId = query.assigneeId;
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.type) filter.type = query.type;
  if (query.teamId) filter.teamId = query.teamId;

  if (requestUser && requestUser.role !== "admin") {
    const userId = requestUser.id;
    const user = await User.findById(userId);
    const hasAccess = user ? await hasTasksAccess(user) : false;
    
    // If user has tasks access, show all tasks (like admin)
    if (hasAccess) {
      return Task.find(filter).sort({ createdAt: -1 });
    }

    const teams = await TeamGroup.find({ $or: [{ memberIds: userId }, { leaderId: userId }] });
    const teamIds = teams.map((team) => team._id.toString());

    const accessConditions = [
      { type: "personal", assigneeId: userId },
    ];
    if (teamIds.length > 0) {
      accessConditions.push({ type: "team", teamId: { $in: teamIds } });
    }

    const andConditions = [{ $or: accessConditions }];
    if (Object.keys(filter).length > 0) {
      andConditions.push(filter);
    }

    return Task.find({ $and: andConditions }).sort({ createdAt: -1 });
  }

  return Task.find(filter).sort({ createdAt: -1 });
};

exports.getById = async (id) => {
  const task = await Task.findById(id);
  if (!task) throw Object.assign(new Error("Task tidak ditemukan"), { statusCode: 404 });
  return task;
};

exports.create = async (data, requestUser) => {
  const role = requestUser?.role;
  const userId = requestUser?.id;

  if (role !== "admin") {
    // Check if user has tasks access via position
    const user = await User.findById(userId);
    const hasAccess = user ? await hasTasksAccess(user) : false;
    
    if (hasAccess) {
      // User with tasks access can create like admin
      // but validate team/personal requirements
    } else {
      // Only leaders can create team tasks
      const leaderTeams = await TeamGroup.find({ leaderId: userId });
      if (leaderTeams.length === 0) {
        throw Object.assign(new Error("Hanya admin dan ketua tim yang bisa membuat tugas"), { statusCode: 403 });
      }
      if (data.type !== "team") {
        throw Object.assign(new Error("Ketua tim hanya bisa membuat tugas tim"), { statusCode: 403 });
      }
      const leaderTeamIds = leaderTeams.map((t) => t._id.toString());
      if (!data.teamId || !leaderTeamIds.includes(data.teamId)) {
        throw Object.assign(new Error("Anda hanya bisa membuat tugas untuk tim yang Anda pimpin"), { statusCode: 403 });
      }
    }
  }

  if (data.type === "personal" && !data.assigneeId) {
    throw Object.assign(new Error("Tugas pribadi harus memiliki assigneeId"), { statusCode: 400 });
  }
  if (data.type === "team" && !data.teamId) {
    throw Object.assign(new Error("Tugas tim harus memiliki teamId"), { statusCode: 400 });
  }
  if (data.type === "team" && data.teamId) {
    const team = await TeamGroup.findById(data.teamId);
    if (!team) {
      throw Object.assign(new Error("Tim tidak ditemukan"), { statusCode: 404 });
    }
  }

  const task = await Task.create(data);
  const creatorName = requestUser?.name || "Seseorang";

  await Activity.create({
    type: "task_created",
    message: `${creatorName} membuat tugas '${task.title}'`,
    userId: data.assigneeId || data.createdBy,
  });

  if (task.type === "team" && task.teamId) {
    const team = await TeamGroup.findById(task.teamId);
    if (team) {
      const recipientIds = [...new Set([...(team.memberIds || []), team.leaderId].filter((id) => id && id !== data.createdBy))];
      const recipients = await getUsersWithPreference(recipientIds, "teamUpdates");
      await Promise.all(recipients.map((recipient) => Notification.create({
        userId: recipient._id.toString(),
        title: "Tugas Team Baru",
        message: `Tugas team baru: ${task.title}`,
        type: "info",
      })));
    }
  } else if (data.assigneeId) {
    const recipients = await getUsersWithPreference([data.assigneeId], "taskAssignments");
    await Promise.all(recipients.map((recipient) => Notification.create({
      userId: recipient._id.toString(),
      title: "Tugas Baru",
      message: `Anda mendapat tugas baru: ${task.title}`,
      type: "info",
    })));
  }

  return task;
};

exports.update = async (id, data) => {
  const task = await Task.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!task) throw Object.assign(new Error("Task tidak ditemukan"), { statusCode: 404 });
  return task;
};

exports.updateStatus = async (id, status, requestUser) => {
  const task = await Task.findById(id);
  if (!task) throw Object.assign(new Error("Task tidak ditemukan"), { statusCode: 404 });

  if (task.status === "completed") {
    throw Object.assign(new Error("Tugas yang sudah selesai tidak dapat diubah statusnya"), { statusCode: 400 });
  }

  const isAdminUser = requestUser?.role === "admin";
  const user = await User.findById(requestUser?.id);
  const hasAccess = user ? await hasTasksAccess(user) : false;

  if (status === "completed") {
    // Only admin, leader of team, or user with tasks access can mark completed
    if (task.type === "team" && task.teamId) {
      const team = await TeamGroup.findById(task.teamId);
      const isLeader = team && team.leaderId === requestUser?.id;
      if (!isAdminUser && !isLeader && !hasAccess) {
        throw Object.assign(new Error("Hanya ketua team atau admin yang bisa menyelesaikan tugas"), { statusCode: 403 });
      }
    } else {
      if (!isAdminUser && !hasAccess) {
        throw Object.assign(new Error("Anda tidak memiliki izin untuk menyelesaikan tugas ini"), { statusCode: 403 });
      }
    }
  }

  task.status = status;
  await task.save();

  const actorName = requestUser?.name || "Seseorang";
  const activityType = status === "completed" ? "task_completed" : "status_changed";
  const activityMessage = status === "completed"
    ? `${actorName} menyelesaikan '${task.title}'`
    : `${actorName} memindahkan '${task.title}' ke ${status}`;

  await Activity.create({
    type: activityType,
    message: activityMessage,
    userId: task.assigneeId || task.createdBy,
  });

  if (status === "completed") {
    const recipientIds = [...new Set([task.createdBy, task.assigneeId].filter((rid) => rid && rid !== requestUser?.id))];
    await Promise.all(recipientIds.map((rid) => Notification.create({
      userId: rid,
      title: "Tugas Selesai",
      message: `Tugas '${task.title}' telah diselesaikan oleh ${actorName}`,
      type: "success",
    })));

    if (task.type === "team" && task.teamId) {
      const team = await TeamGroup.findById(task.teamId);
      if (team) {
        const teamRecipientIds = [...new Set([...(team.memberIds || []), team.leaderId]
          .filter((rid) => rid && rid !== requestUser?.id && !recipientIds.includes(rid)))];
        const recipients = await getUsersWithPreference(teamRecipientIds, "teamUpdates");
        await Promise.all(recipients.map((recipient) => Notification.create({
          userId: recipient._id.toString(),
          title: "Tugas Team Selesai",
          message: `Tugas team '${task.title}' telah diselesaikan`,
          type: "success",
        })));
      }
    }
  }

  return task;
};

exports.addNote = async (id, note) => {
  const task = await Task.findById(id);
  if (!task) throw Object.assign(new Error("Task tidak ditemukan"), { statusCode: 404 });
  task.notes.push(note);
  await task.save();

  await Activity.create({
    type: "note_added",
    message: `Catatan ditambahkan di '${task.title}'`,
    userId: note.authorId,
  });

  return task;
};

exports.editNote = async (taskId, noteId, data, userId) => {
  const task = await Task.findById(taskId);
  if (!task) throw Object.assign(new Error("Task tidak ditemukan"), { statusCode: 404 });
  const note = task.notes.id(noteId);
  if (!note) throw Object.assign(new Error("Catatan tidak ditemukan"), { statusCode: 404 });
  if (note.authorId !== userId) throw Object.assign(new Error("Anda bukan pembuat catatan ini"), { statusCode: 403 });
  if (data.text !== undefined) note.text = data.text;
  if (data.attachments) note.attachments = data.attachments;
  await task.save();
  return task;
};

exports.deleteNote = async (taskId, noteId, userId) => {
  const task = await Task.findById(taskId);
  if (!task) throw Object.assign(new Error("Task tidak ditemukan"), { statusCode: 404 });
  const note = task.notes.id(noteId);
  if (!note) throw Object.assign(new Error("Catatan tidak ditemukan"), { statusCode: 404 });
  if (note.authorId !== userId) throw Object.assign(new Error("Anda bukan pembuat catatan ini"), { statusCode: 403 });
  note.deleteOne();
  await task.save();
  return task;
};

exports.remove = async (id) => {
  const task = await Task.findByIdAndDelete(id);
  if (!task) throw Object.assign(new Error("Task tidak ditemukan"), { statusCode: 404 });
  return { message: "Task berhasil dihapus" };
};
