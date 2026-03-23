const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  fromUserId: { type: String, required: true },
  toUserId: { type: String, required: true },
  type: { type: String, enum: ["message", "collaboration_request", "announcement"], default: "message" },
  content: { type: String, required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected", "read"], default: "pending" },
  createdAt: { type: String, default: () => new Date().toISOString() },
}, { timestamps: true });

messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Message", messageSchema);
