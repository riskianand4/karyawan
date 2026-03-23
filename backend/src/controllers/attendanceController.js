const attendanceService = require("../services/attendanceService");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const path = require("path");

exports.getAttendance = async (req, res, next) => {
  try {
    const query = { ...req.query };
    if (req.user.role !== "admin") {
      query.userName = req.user.name;
      delete query.userId;
    }
    res.json(await attendanceService.getAttendance(query));
  } catch (err) { next(err); }
};

exports.clockIn = async (req, res, next) => {
  try { res.json(await attendanceService.clockIn(req.userId, req.body.location)); } catch (err) { next(err); }
};

exports.clockOut = async (req, res, next) => {
  try { res.json(await attendanceService.clockOut(req.userId)); } catch (err) { next(err); }
};

exports.handleWebhook = async (req, res, next) => {
  try { res.json(await attendanceService.processWebhook(req.body)); } catch (err) { next(err); }
};

exports.getLeaveRequests = async (req, res, next) => {
  try { res.json(await attendanceService.getLeaveRequests(req.query)); } catch (err) { next(err); }
};

exports.createLeaveRequest = async (req, res, next) => {
  try { res.status(201).json(await attendanceService.createLeaveRequest(req.body)); } catch (err) { next(err); }
};

exports.approveLeaveRequest = async (req, res, next) => {
  try { res.json(await attendanceService.approveLeaveRequest(req.params.id, req.userId, req.body.status)); } catch (err) { next(err); }
};

exports.getLeaveBalance = async (req, res, next) => {
  try { res.json(await attendanceService.getLeaveBalance(req.params.userId || req.userId)); } catch (err) { next(err); }
};

exports.getLeaveBalances = async (req, res, next) => {
  try { res.json(await attendanceService.getLeaveBalances()); } catch (err) { next(err); }
};
