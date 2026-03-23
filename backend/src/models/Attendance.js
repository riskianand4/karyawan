const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, default: "" },
  date: { type: String, required: true },
  clockIn: { type: String, default: null },
  clockOut: { type: String, default: null },
  status: { type: String, enum: ["present", "late", "absent", "leave"], default: "present" },
  location: { type: String, default: "" },
  deviceId: { type: String, default: "" },
  biokey: { type: String, default: "" },
}, { timestamps: true });

attendanceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Attendance", attendanceSchema);
