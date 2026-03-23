const settingsService = require("../services/settingsService");

exports.getMenuSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getMenuSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
};

exports.updateMenuSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateMenuSettings(req.body);
    res.json(settings);
  } catch (err) {
    next(err);
  }
};

exports.getPositionAccess = async (req, res, next) => {
  try {
    const data = await settingsService.getPositionAccess();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.updatePositionAccess = async (req, res, next) => {
  try {
    const { position, menus } = req.body;
    if (!position) return res.status(400).json({ error: "Position is required" });
    const result = await settingsService.updatePositionAccess(position, menus);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
