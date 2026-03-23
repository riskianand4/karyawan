const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");
const LeaveBalance = require("../models/LeaveBalance");
const Notification = require("../models/Notification");
const User = require("../models/User");

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.getAttendance = async (query = {}) => {
  const filter = {};
  if (query.userId) filter.userId = query.userId;
  if (query.userName) filter.userName = { $regex: new RegExp(`^${escapeRegex(query.userName.trim())}$`, "i") };
  if (query.date) filter.date = query.date;
  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = query.startDate;
    if (query.endDate) filter.date.$lte = query.endDate;
  }
  return Attendance.find(filter).sort({ date: -1, clockIn: -1 });
};

exports.clockIn = async (userId, location) => {
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toTimeString().slice(0, 5);
  const isLate = time > "08:00";

  let record = await Attendance.findOne({ userId, date });
  if (record && record.clockIn) throw Object.assign(new Error("Sudah clock in hari ini"), { statusCode: 400 });

  const user = await User.findById(userId);
  const userName = user ? user.name : "";

  if (record) {
    record.clockIn = time;
    record.status = isLate ? "late" : "present";
    record.location = location;
    record.userName = userName;
    await record.save();
  } else {
    record = await Attendance.create({
      userId, date, clockIn: time, status: isLate ? "late" : "present", location, userName,
    });
  }
  return record;
};

exports.clockOut = async (userId) => {
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toTimeString().slice(0, 5);

  const record = await Attendance.findOne({ userId, date });
  if (!record || !record.clockIn) throw Object.assign(new Error("Belum clock in"), { statusCode: 400 });
  if (record.clockOut) throw Object.assign(new Error("Sudah clock out"), { statusCode: 400 });

  record.clockOut = time;
  await record.save();
  return record;
};

exports.processWebhook = async (payload) => {
  if (!payload || !payload.biodata) throw Object.assign(new Error("Invalid payload"), { statusCode: 400 });

  const { user_id, disp_nm, tran_dt, tran_id } = payload.biodata;
  const deviceId = payload.biopush?.device || "";
  const biokey = payload.biopush?.biokey || "";

  if (!user_id || !tran_dt) throw Object.assign(new Error("Missing user_id or tran_dt"), { statusCode: 400 });

  const [datePart, timePart] = tran_dt.split(" ");
  const clockTime = timePart ? timePart.slice(0, 5) : null;

  let resolvedUserId = user_id;
  if (disp_nm) {
    const matchedUser = await User.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(disp_nm)}$`, "i") },
    });
    if (matchedUser) {
      resolvedUserId = matchedUser._id.toString();
    }
  }

  const existingRecord = await Attendance.findOne({ userId: resolvedUserId, date: datePart });

  if (existingRecord) {
    if (existingRecord.clockIn && !existingRecord.clockOut) {
      existingRecord.clockOut = clockTime;
      existingRecord.userName = disp_nm || existingRecord.userName || "";
      existingRecord.deviceId = deviceId;
      existingRecord.biokey = biokey;
      if (tran_id) existingRecord.tranId = tran_id;
      await existingRecord.save();
      return { success: true, message: "Clock out berhasil", record: existingRecord };
    }

    return { success: true, message: "Record sudah lengkap untuk hari ini", record: existingRecord };
  }

  const isLate = clockTime > "09:00";
  const record = await Attendance.create({
    userId: resolvedUserId,
    date: datePart,
    clockIn: clockTime,
    status: isLate ? "late" : "present",
    tranId: tran_id || null,
    userName: disp_nm || "",
    deviceId,
    biokey,
  });

  return { success: true, message: "Clock in berhasil", record };
};

// Import CSV
exports.importCSV = async (rows) => {
  const results = [];
  for (const row of rows) {
    const record = await Attendance.create({ ...row, source: "import" });
    results.push(record);
  }
  return { imported: results.length };
};

// Summary per user
exports.getSummary = async (userId, month) => {
  const filter = { userId };
  if (month) filter.date = { $regex: `^${month}` };
  const records = await Attendance.find(filter);

  const summary = { total: records.length, present: 0, late: 0, absent: 0, leave: 0, izin: 0, sakit: 0, alpa: 0, dinasLuar: 0 };
  for (const r of records) {
    if (r.status === "present") summary.present++;
    else if (r.status === "late") summary.late++;
    else if (r.status === "absent") summary.absent++;
    else if (r.status === "leave") summary.leave++;

    if (r.reason === "izin") summary.izin++;
    else if (r.reason === "sakit") summary.sakit++;
    else if (r.reason === "alpa") summary.alpa++;
    else if (r.reason === "dinas luar") summary.dinasLuar++;
  }
  return summary;
};

// Leave requests
exports.getLeaveRequests = async (query = {}) => {
  const filter = {};
  if (query.userId) filter.userId = query.userId;
  if (query.status) filter.status = query.status;
  return LeaveRequest.find(filter).sort({ createdAt: -1 });
};

exports.createLeaveRequest = async (data) => {
  return LeaveRequest.create(data);
};

exports.approveLeaveRequest = async (id, adminId, status) => {
  const req = await LeaveRequest.findById(id);
  if (!req) throw Object.assign(new Error("Pengajuan tidak ditemukan"), { statusCode: 404 });
  req.status = status;
  req.approvedBy = adminId;
  await req.save();

  const statusLabel = status === "approved" ? "disetujui" : "ditolak";
  await Notification.create({
    userId: req.userId,
    title: `Pengajuan Cuti ${status === "approved" ? "Disetujui" : "Ditolak"}`,
    message: `Pengajuan cuti Anda telah ${statusLabel}`,
    type: status === "approved" ? "success" : "warning",
  });

  return req;
};

// Leave balance
exports.getLeaveBalance = async (userId) => {
  let balance = await LeaveBalance.findOne({ userId });
  if (!balance) {
    balance = await LeaveBalance.create({ userId });
  }
  return balance;
};

exports.getLeaveBalances = async () => {
  return LeaveBalance.find();
};
