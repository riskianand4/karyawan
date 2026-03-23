const mongoose = require("mongoose");

const payslipSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  basicSalary: { type: Number, required: true },
  allowances: [{ name: String, amount: Number }],
  deductions: [{ name: String, amount: Number }],
  netSalary: { type: Number, required: true },
}, { timestamps: true });

payslipSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Payslip", payslipSchema);
