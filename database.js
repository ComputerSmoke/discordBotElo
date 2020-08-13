const sqlite3 = require("sqlite3");

/**
 * @param {sqlite3.Database} db The database object
 */
const initialize = (db) => {
	return new Promise((resolve, reject) => {
		db.run(`CREATE TABLE IF NOT EXISTS users (
		discord_id TEXT NOT NULL PRIMARY KEY,
		elo INT NOT NULL,
        wins INT NOT NULL,
        losses INT NOT NULL,
		draws INT NOT NULL)`, (err, res) => {
			if (err) {
				console.log(err);
				resolve("DB_ERR");
				return;
			}
			db.run(`CREATE TABLE IF NOT EXISTS looking (
			discord_id TEXT NOT NULL PRIMARY KEY,
			playing TINYINT NOT NULL DEFAULT 0,
			FOREIGN KEY(discord_id) REFERENCES users(discord_id))`, (err, res) => {
				if (err) {
					console.log(err);
					resolve("DB_ERR");
					return;
				}
				resolve("OK");
			});
		});
	});
}

/**
 * @param {sqlite3.Database} db The database object
 * @param {number} discord_id The discord id of the user
 */
const registerUser = (db, discord_id) => {
	return new Promise((resolve, reject) => {
		db.all("SELECT * FROM users WHERE discord_id = " + discord_id, (err, res) => {
			if (err) {
				console.log(err);
				resolve("DB_ERR");
				return;
			}
			if (res.length > 0) {
				resolve("ALREADY_CREATED");
				return;
			}
			db.run(`INSERT INTO users (discord_id, elo, wins, losses, draws) VALUES (${discord_id}, 1400, 0, 0, 0)`, (err, res) => {
				if (err) {
					console.log(err);
					resolve("DB_ERR");
					return;
				}
				resolve("OK");
				return;
			});
		});
	})
}

/**
 * @param {sqlite3.Database} db The database object
 * @param {number} discord_id The discord id of the user
 */
const getStats = (db, discord_id) => {
	return new Promise((resolve, reject) => {
		db.all("SELECT elo, wins, losses, draws, discord_id FROM users WHERE discord_id = " + discord_id, (err, res) => {
			if (err) {
				console.log(err);
				resolve("DB_ERR");
				return;
			}
			if (res.length == 0) {
				resolve("NOT_REGISTERED");
				return;
			}
			resolve(res[0]);
			return;
		});
	})
}

/**
 * @param {sqlite3.Database} db The database object
 * @param {number} discord_id The discord id of the user
 */
const toggleLooking = (db, discord_id) => {
	return new Promise((resolve, reject) => {
		db.all("SELECT elo FROM users WHERE discord_id = " + discord_id, (err, res) => {
			if (err) {
				console.log(err);
				resolve("DB_ERR");
				return;
			}
			if (res.length == 0) {
				resolve("NOT_REGISTERED");
				return;
			}
			db.all("SELECT playing FROM looking WHERE discord_id = " + discord_id, (err, res) => {
				if (err) {
					console.log(err);
					resolve("DB_ERR");
					return;
				}
				if (res.length == 0) {
					// User is not looking, mark him as looking
					db.run(`INSERT INTO looking (discord_id) VALUES (${discord_id})`, (err, res) => {
						if (err) {
							console.log(err);
							resolve("DB_ERR");
							return;
						}
						resolve("MARKED_LOOKING");
						return;
					});
					return;
				}
				else {
					// User is looking / playing, mark him as not looking
					db.run(`DELETE FROM looking WHERE discord_id = ` + discord_id, (err, res) => {
						if (err) {
							console.log(err);
							resolve("DB_ERR");
							return;
						}
						resolve("REMOVED_LOOKING");
						return;
					});
					return;
				}
			})
		});
	});
}

/**
 * @param {sqlite3.Database} db The database object
 * @param {number} discord_id The discord id of the user
 */
const togglePlaying = (db, discord_id) => {
	return new Promise((resolve, reject) => {
		db.all("SELECT playing FROM looking WHERE discord_id = " + discord_id, (err, res) => {
			if (err) {
				console.log(err);
				resolve("DB_ERR");
				return;
			}
			if (res.length == 0) {
				resolve("NOT_LOOKING");
				return;
			}
			if (res[0].playing == 0) {
				// User is currently not playing, mark him as playing
				db.run("UPDATE looking SET playing = 1 WHERE discord_id = " + discord_id, (err, res) => {
					if (err) {
						console.log(err);
						resolve("DB_ERR");
						return;
					}
					resolve("MARKED_PLAYING");
					return;
				});
				return;
			}
			else {
				// User is currently playing, mark him as not playing
				db.run("UPDATE looking SET playing = 0 WHERE discord_id = " + discord_id, (err, res) => {
					if (err) {
						console.log(err);
						resolve("DB_ERR");
						return;
					}
					resolve("REMOVED_PLAYING");
					return;
				});
				return;
			}
		});
	});
}

/**
 * @param {sqlite3.Database} db The database object
 */
const listLooking = (db) => {
	return new Promise((resolve, reject) => {
		db.all("SELECT looking.discord_id, elo FROM looking INNER JOIN users ON looking.discord_id = users.discord_id WHERE playing = 0", (err, res) => {
			if (err) {
				console.log(err);
				resolve("DB_ERR");
				return;
			}
			resolve(res);
			return;
		})
	});
}

/**
 * @param {sqlite3.Database} db The database object
 */
const getLeaderboard = (db) => {
	return new Promise((resolve, reject) => {
		db.all("SELECT discord_id, elo FROM users ORDER BY elo DESC", (err, res) => {
			if (err) {
				console.log(err);
				resolve("DB_ERR");
				return;
			}
			resolve(res);
			return;
		});
	});
}

/**
 * @param {sqlite3.Database} db The database object
 * @param {number} discord_id The discord id of the user
 */
const removePlaying = (db, discord_id) => {
	return new Promise((resolve, reject) => {
		db.all("SELECT playing FROM looking WHERE discord_id = " + discord_id, (err, res) => {
			if (err) {
				console.log(err);
				resolve("DB_ERR");
				return;
			}
			if (res.length == 0) {
				resolve("OK");
				return;
			}
			else {
				db.run("UPDATE looking SET playing = 0 WHERE discord_id = " + discord_id, (err, res) => {
					if (err) {
						console.log(err);
						resolve("DB_ERR");
						return;
					}
					resolve("OK");
					return;
				});
			}
			return;
		});
	});
}


/**
 * @param {sqlite3.Database} db The database object
 * @param {number} discord_id The discord id of the user
 * @param {object} stats The new stats
 */
const updateStats = (db, discord_id, stats) => {
	return new Promise((resolve, reject) => {
		db.run(`UPDATE users SET
		elo = ${stats.elo},
		wins = ${stats.wins},
		losses = ${stats.losses},
		draws = ${stats.draws}
		WHERE discord_id = ${discord_id}`, (err, res) => {
				if (err) {
					console.log(err);
					resolve("DB_ERR");
					return;
				}
				resolve("OK");
				return;
		});
	});
}

module.exports = {
	initialize,
	registerUser,
	getStats,
	toggleLooking,
	togglePlaying,
	listLooking,
	getLeaderboard,
	removePlaying,
	updateStats
}