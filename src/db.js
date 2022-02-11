/*
  Security note: the database is saved to the file
  `db.json` on the local filesystem.
  It's deliberately placed in the `.data` directory
  which doesn't get copied if someone remixes the project.
*/
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const adapter = new FileSync(".data/db.json");
const db = low(adapter);

const { TWITCH_BOT_USERNAME } = process.env;

// if there's no db default it to this
db.defaults({ users: [{ username: TWITCH_BOT_USERNAME }] }).write();

function getUsers() {
  return db.get("users").value();
}

function createUser(username) {
  return db
    .get("users")
    .push({ username })
    .write();
}

function getUser(username) {
  return db
    .get("users")
    .find({ username })
    .value();
}

function updateUser(username, options) {
  return db
    .get("users")
    .find({ username })
    .assign(options)
    .write();
}

function deleteUser(username) {
  return db
    .get("users")
    .remove({ username })
    .write();
}

module.exports = {
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser
};
