const MenuSetting = require("../models/MenuSetting");
const PositionAccess = require("../models/PositionAccess");

exports.getMenuSettings = async () => {
  let settings = await MenuSetting.findOne();
  if (!settings) {
    settings = await MenuSetting.create({});
  }
  const obj = settings.toObject();
  delete obj._id;
  delete obj.__v;
  delete obj.createdAt;
  delete obj.updatedAt;
  return obj;
};

exports.updateMenuSettings = async (data) => {
  let settings = await MenuSetting.findOne();
  if (!settings) {
    settings = await MenuSetting.create(data);
  } else {
    Object.assign(settings, data);
    await settings.save();
  }
  const obj = settings.toObject();
  delete obj._id;
  delete obj.__v;
  delete obj.createdAt;
  delete obj.updatedAt;
  return obj;
};

exports.getPositionAccess = async () => {
  const docs = await PositionAccess.find();
  const result = {};
  for (const doc of docs) {
    result[doc.position] = doc.menus.toObject ? doc.menus.toObject() : doc.menus;
  }
  return result;
};

exports.updatePositionAccess = async (position, menus) => {
  let doc = await PositionAccess.findOne({ position });
  if (!doc) {
    doc = await PositionAccess.create({ position, menus });
  } else {
    doc.menus = menus;
    await doc.save();
  }
  return { position: doc.position, menus: doc.menus };
};
