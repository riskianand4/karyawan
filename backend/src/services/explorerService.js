const ExplorerFolder = require("../models/ExplorerFolder");
const ExplorerFile = require("../models/ExplorerFile");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const config = require("../config/env");

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const canDelete = (item, userRole) => {
  if (userRole === "admin") return true;
  const age = Date.now() - new Date(item.createdAt).getTime();
  return age < THREE_DAYS_MS;
};

// Check access
const hasAccess = async (folder, userId, userRole, userTeamIds = []) => {
  if (userRole === "admin") return true;
  if (!folder) return true; // root
  if (folder.accessType === "all") return true;
  if (folder.ownerId === userId || folder.createdBy === userId) return true;
  if (folder.accessType === "specific" && folder.accessIds.includes(userId)) return true;
  if (folder.accessType === "team" && folder.accessIds.some(id => userTeamIds.includes(id))) return true;
  return false;
};

exports.listContents = async (parentId, userId, userRole) => {
  const filter = { parentId: parentId || null };
  
  let folders = await ExplorerFolder.find(filter).sort({ name: 1 });
  const files = await ExplorerFile.find(filter ? { folderId: parentId || null } : {}).sort({ name: 1 });
  
  // Filter by access for non-admin
  if (userRole !== "admin") {
    folders = folders.filter(f => {
      if (f.accessType === "all") return true;
      if (f.ownerId === userId || f.createdBy === userId) return true;
      if (f.accessType === "specific" && f.accessIds.includes(userId)) return true;
      return false;
    });
  }
  
  return { folders, files };
};

exports.createFolder = async (data) => {
  return ExplorerFolder.create(data);
};

exports.updateFolder = async (id, data) => {
  const folder = await ExplorerFolder.findById(id);
  if (!folder) throw Object.assign(new Error("Folder tidak ditemukan"), { statusCode: 404 });
  Object.assign(folder, data);
  await folder.save();
  return folder;
};

exports.deleteFolder = async (id, userId, userRole) => {
  const folder = await ExplorerFolder.findById(id);
  if (!folder) throw Object.assign(new Error("Folder tidak ditemukan"), { statusCode: 404 });
  
  if (!canDelete(folder, userRole)) {
    throw Object.assign(new Error("Folder sudah lebih dari 3 hari, hanya admin yang bisa menghapus"), { statusCode: 403 });
  }
  
  // Cascade delete subfolders and files
  const deleteRecursive = async (folderId) => {
    const subFolders = await ExplorerFolder.find({ parentId: folderId });
    for (const sf of subFolders) {
      await deleteRecursive(sf._id.toString());
    }
    await ExplorerFile.deleteMany({ folderId });
    await ExplorerFolder.findByIdAndDelete(folderId);
  };
  
  await deleteRecursive(id);
  return { message: "Folder berhasil dihapus" };
};

exports.uploadFile = async (data) => {
  return ExplorerFile.create(data);
};

exports.renameFile = async (id, name) => {
  const file = await ExplorerFile.findById(id);
  if (!file) throw Object.assign(new Error("File tidak ditemukan"), { statusCode: 404 });
  file.name = name;
  await file.save();
  return file;
};

exports.deleteFile = async (id, userId, userRole) => {
  const file = await ExplorerFile.findById(id);
  if (!file) throw Object.assign(new Error("File tidak ditemukan"), { statusCode: 404 });
  
  if (!canDelete(file, userRole)) {
    throw Object.assign(new Error("File sudah lebih dari 3 hari, hanya admin yang bisa menghapus"), { statusCode: 403 });
  }
  
  // Try to delete physical file
  try {
    const baseDir = path.join(__dirname, "../../", config.uploadDir);
    const filePath = path.join(baseDir, file.fileUrl.replace(/^\/uploads\/?/, ""));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) { /* ignore */ }
  
  await ExplorerFile.findByIdAndDelete(id);
  return { message: "File berhasil dihapus" };
};

exports.shareFolder = async (id, accessType, accessIds) => {
  const folder = await ExplorerFolder.findById(id);
  if (!folder) throw Object.assign(new Error("Folder tidak ditemukan"), { statusCode: 404 });
  folder.accessType = accessType;
  folder.accessIds = accessIds || [];
  await folder.save();
  return folder;
};

exports.zipFolder = async (id) => {
  const folder = await ExplorerFolder.findById(id);
  if (!folder) throw Object.assign(new Error("Folder tidak ditemukan"), { statusCode: 404 });
  
  const baseDir = path.join(__dirname, "../../", config.uploadDir);
  const tmpPath = path.join("/tmp", `explorer-${id}-${Date.now()}.zip`);
  
  const output = fs.createWriteStream(tmpPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  
  return new Promise((resolve, reject) => {
    output.on("close", () => resolve({ path: tmpPath, name: folder.name + ".zip" }));
    archive.on("error", reject);
    archive.pipe(output);
    
    const addFilesRecursive = async (folderId, prefix) => {
      const files = await ExplorerFile.find({ folderId });
      for (const f of files) {
        const filePath = path.join(baseDir, f.fileUrl.replace(/^\/uploads\/?/, ""));
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: prefix + f.name });
        }
      }
      const subFolders = await ExplorerFolder.find({ parentId: folderId });
      for (const sf of subFolders) {
        await addFilesRecursive(sf._id.toString(), prefix + sf.name + "/");
      }
    };
    
    addFilesRecursive(id, "").then(() => archive.finalize()).catch(reject);
  });
};

exports.getFolder = async (id) => {
  return ExplorerFolder.findById(id);
};

exports.getBreadcrumb = async (folderId) => {
  const crumbs = [];
  let currentId = folderId;
  while (currentId) {
    const folder = await ExplorerFolder.findById(currentId);
    if (!folder) break;
    crumbs.unshift({ id: folder._id.toString(), name: folder.name });
    currentId = folder.parentId;
  }
  return crumbs;
};
