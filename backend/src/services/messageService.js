const Message = require("../models/Message");
const Notification = require("../models/Notification");

exports.getAll = async (query = {}) => {
  const filter = {};
  if (query.userId) {
    filter.$or = [{ fromUserId: query.userId }, { toUserId: query.userId }];
  }
  if (query.fromUserId) filter.fromUserId = query.fromUserId;
  if (query.toUserId) filter.toUserId = query.toUserId;
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  return Message.find(filter).sort({ createdAt: -1 });
};

exports.create = async (data, senderName) => {
  const message = await Message.create(data);

  // Notify recipient
  const typeLabels = { message: "Pesan Baru", collaboration_request: "Permintaan Kolaborasi", announcement: "Pengumuman" };
  await Notification.create({
    userId: data.toUserId,
    title: typeLabels[data.type] || "Pesan Baru",
    message: `${senderName}: ${data.content.substring(0, 100)}`,
    type: "info",
  });

  return message;
};

exports.updateStatus = async (id, status) => {
  const message = await Message.findByIdAndUpdate(id, { status }, { new: true });
  if (!message) throw Object.assign(new Error("Pesan tidak ditemukan"), { statusCode: 404 });
  return message;
};

exports.getUnreadCount = async (userId) => {
  return Message.countDocuments({
    toUserId: userId,
    status: { $in: ["pending", "read"] },
    type: { $ne: "collaboration_request" },
    fromUserId: { $ne: userId },
  });
};

exports.getPendingRequestCount = async (userId) => {
  return Message.countDocuments({
    toUserId: userId,
    type: "collaboration_request",
    status: "pending",
  });
};
