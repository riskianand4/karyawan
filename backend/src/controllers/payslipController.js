const payslipService = require("../services/payslipService");

exports.getAll = async (req, res, next) => {
  try { res.json(await payslipService.getAll(req.query)); } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try { res.json(await payslipService.getById(req.params.id)); } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await payslipService.create(req.body)); } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try { res.json(await payslipService.update(req.params.id, req.body)); } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try { res.json(await payslipService.remove(req.params.id)); } catch (err) { next(err); }
};
