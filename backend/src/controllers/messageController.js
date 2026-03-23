const messageService = require("../services/messageService");

exports.getAll = async (req, res, next) => {
  try { res.json(await messageService.getAll(req.query)); } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await messageService.create(req.body, req.user.name)); } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try { res.json(await messageService.updateStatus(req.params.id, req.body.status)); } catch (err) { next(err); }
};

exports.getUnreadCount = async (req, res, next) => {
  try { res.json({ count: await messageService.getUnreadCount(req.userId) }); } catch (err) { next(err); }
};

exports.getPendingRequestCount = async (req, res, next) => {
  try { res.json({ count: await messageService.getPendingRequestCount(req.userId) }); } catch (err) { next(err); }
};
