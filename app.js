const Discord = require('discord.js');
const client = new Discord.Client();
var fs = require('fs');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);
const fileStat = promisify(fs.stat);

var pendingReports = {};

var leaderboard = [];
try {
	fs.readFile('./save/leaderboard.txt', 'utf8', (err, contents) => {
		leaderboard = JSON.parse(contents);
	});
} catch(e) {
	console.error(e);
}

var looking = {};
var channelId = fs.readFileSync('./server/channel.txt',"utf8");

var playing = {};

client.once('ready', () => {
	console.log('Ready!');
	client.on('message', message => {
		if(!(message.content.startsWith("'") || message.content.startsWith("`") || message.content.startsWith("-")) || message.author.bot || (message.channel.id != channelId)) return;
		try {
			var cmd = message.content.toLowerCase().slice(1).split(/ +/);

			var channel = message.channel;
			console.log('got msg');
			var mentions = message.mentions.users;
			var tag = message.author.tag;

			var id = message.author.id;

			switch(cmd[0]) {
				case "register":
					register(id, channel, tag);
					break;
				case "rep":
					report(id, cmd, channel, mentions);
					break;
				case "help":
					sayHelp(channel);
					break;
				case "leaderboard":
					sayLeaderboard(id, channel);
					console.log('5');
					break;
				case "cancel":
					cancelRep(id, cmd, channel, mentions);
					break;
				case "looking":
					toggleLooking(id, channel);
					break;
				case "look":
					listLooking(id, channel);
					break;
				case "stats":
					sayStats(id, channel);
					break;
				case "playing":
					nowPlaying(id, channel);
					break;
				default:
					sayUnrec(channel);
			}
			console.log('6');
		} catch(e) {
			console.error(e);
		}
	});
});

async function nowPlaying(id, channel) {
	if(!playing[id]) {
		if(looking[id]) {
			delete looking[id];
			playing[id] = 0;
			channel.send("You have been temporarily removed from the looking list, and will be re-added when you report game results. Good luck!");
		} else {
			channel.send("I didn't do anything because you weren't listed as looking for a game, but you can still report your results afterward with -rep [W/L/D] [player]")
		}
	} else {
		channel.send("You were already listed as playing, report the game results to be automatically added back to the looking list");
	}
}

async function sayStats(id, channel) {
	try {
		var stat = await getStats('./save/accounts/'+id+'.txt');
		if(stat) {
			var user = JSON.parse(await readFile('./save/accounts/'+id+'.txt', 'utf8'));
			var toWrite = "Your stats:\nRating:\t"+user.r+"\nW: "+user.w+"\tL: "+user.l+"\tD: "+user.d;
			channel.send(toWrite);
		} else {
			channel.send("Want stats? Register with -register");
		}
	} catch(e) {
		console.error(e);
	}
}

async function listLooking(id, channel) {
	try {
		var lookingString = "";
		var lookingArray = Object.keys(looking);
		if(lookingArray.length > 0) {
			lookingString = "Players currently looking for rated games:\n";
			for(var i = 0; i < lookingArray.length; i++) {
				var tag = looking[lookingArray[i]].tag;
				var r = looking[lookingArray[i]].r;
				lookingString += tag + "\t\t\t" + r + "\n";
			}
			if(looking[id]) {
				lookingString += "\nYou are currently listed as looking for a game. To toggle this, use -looking";
			} else{
				lookingString += "\nYou are not currently listed as looking for a game. To toggle this, use -looking";
			}
		} else {
			lookingString = "Nobody is currently listed as looking for a game. To list yourself, use -looking";
		}
		channel.send(lookingString);
	} catch(e) {
		console.error(e);
	}
}

async function toggleLooking(id, channel) {
	try {
		if(!looking[id]) {
			var stat = await getStats('./save/accounts/'+id+'.txt');
			if(stat) {
				var user = JSON.parse(await readFile('./save/accounts/'+id+'.txt', 'utf8'));
				looking[id] = {tag: user.tag, r: user.r, t: 0};
				channel.send("You are now listed as looking for rated play.");
				listLooking(id, channel);
			} else {
				channel.send("You must first register for rated play with -register");
			}
		} else {
			delete looking[id];
			channel.send("You are no longer listed as looking for a rated game");
		}
	} catch(e) {
		console.error(e);
	}
}

async function cancelRep(id, cmd, channel, mentions) {
	try {
		if(id && mentions.first()) {
			if(pendingReports[id] && pendingReports[id][mentions.first().id]) {
				if(cmd[1] == "w") {
					if(pendingReports[id][mentions.first().id].w > 0) {
						pendingReports[id][mentions.first().id].w--;
						channel.send("Your pending win report has been canceled.");
					} else {
						channel.send("You have no pending win reports to cancel with this player. They may have timed out or been confirmed");
					}
				} else if(cmd[1] == "l") {
					if(pendingReports[id][mentions.first().id].l > 0) {
						pendingReports[id][mentions.first().id].l--;
						channel.send("Your pending loss report has been canceled.");
					} else {
						channel.send("You have no pending loss reports to cancel with this player. They may have timed out or been confirmed");
					}
				} else if(cmd[1] == "d") {
					if(pendingReports[id][mentions.first().id].d > 0) {
						pendingReports[id][mentions.first().id].d--;
						channel.send("Your pending draw report has been canceled.");
					} else {
						channel.send("You have no pending draw reports to cancel with this player. They may have timed out or been confirmed");
					}
				} else {
					channel.send("I don't understand if you want to cancel a win, loss, or draw. Be sure to use the format -cancel [W/L/D] [player]");
				}
			} else {
				channel.send("You have no pending reports to cancel with this player");
			}
		} else {
			channel.send("I don't know who you're canceling against. Please cancel with the format -cancel [W/L/D] [player]");
		}
	} catch(e) {
		console.error(e);
	}
}

async function sayHelp(channel) {
	channel.send("-register\t:\tRegister for rated play\n-rep [W/L/D] [opponent]\t:\tReport the results of a rated game. Both players must do this.\n-leaderboard\t:\tView the leaderboard\n-looking\t:\tList yourself as looking for a rated game\n-look\t:\tView the list of players looking for a rated game\n-cancel [W/L/D] [player]\t:\tCancel a pending game report\n-stats\t:\tView your rating\n-playing\t:\tRemove yourself from the looking for game list until you report the results of a game");
}

async function sayLeaderboard(id, channel) {
	console.log('saying leaderboard');
	var leadString = "";
	if(leaderboard.length < 1) {
		leadString = "There is currently nobody on the leaderboard. Play a game to become #1!";
	}
	var c = 0;
	while(c < leaderboard.length && c < 10) {
		leadString += (c+1)+":\t" + leaderboard[c].r + "\t" + leaderboard[c].tag;
		if(leaderboard[c].id == id) {
			leadString += "\t<----\n";
		} else {
			leadString += "\n";
		}
		c++;
	}
	console.log('1');
	var rank = 0;
	for(var i = 0; i < leaderboard.length; i++) {
		if(leaderboard[i].id == id) {
			rank = i+1;
		}
	}


	console.log('2');
	var yours = "\n\n";
	if(rank != 0 && rank > 10) {
		var i = rank-3;
		if(i < 10) {
			i = 10;
		}
		while(i < leaderboard.length && i < rank+2) {
			yours += (i+1)+":\t"+leaderboard[i].r+"\t"+leaderboard[i].tag;
			if(i == rank-1) {
				yours += "\t<----\n";
			} else {
				yours += "\n"
			}
			i++;
		}
	}
	leadString+= yours;


	
	console.log('3');
	console.log("sending" + leadString);
	channel.send(leadString);
	console.log('4');
}

async function report(id, cmd, channel, mentions) {
	try {
		var stat = await getStats('./save/accounts/'+id+'.txt');
		if(stat) {
			//file exists
			if(mentions.first()) {
				var stat2 = await getStats('./save/accounts/'+mentions.first().id+'.txt');
				if(stat2 && mentions.first().id != id) {
					if(playing[id] != null) {
						delete playing[id];
						var user = JSON.parse(await readFile('./save/accounts/'+id+'.txt', 'utf8'));
						looking[id] = {tag: user.tag, r: user.r, t: 0};
						console.log('added to looking');
					}
					var confirmed = false;
					if(pendingReports[mentions.first().id] && pendingReports[mentions.first().id][id]) {
						if(cmd[1] == "w" && pendingReports[mentions.first().id][id].l > 0) {
							pendingReports[mentions.first().id][id].l--;
							rec(id, mentions.first().id, 1, channel);
							confirmed = true;
							channel.send("Your win has been confirmed.");
						} else if(cmd[1] == "l" && pendingReports[mentions.first().id][id].w > 0) {
							pendingReports[mentions.first().id][id].w--;
							rec(id, mentions.first().id, 0, channel);
							confirmed = true;
							channel.send("Your loss has been confirmed.");
						} else if(cmd[1] == "d" && pendingReports[mentions.first().id][id].d > 0) {
							pendingReports[mentions.first().id][id].d--;
							rec(id, mentions.first().id, .5, channel);
							confirmed = true;
							channel.send("Your draw has been confirmed.");
						} 
						console.log("checking reports");
						if(pendingReports[mentions.first().id][id].w == 0 && pendingReports[mentions.first().id][id].l == 0 && pendingReports[mentions.first().id][id].d == 0) {
							delete pendingReports[mentions.first().id][id];
							var reportCount = Object.keys(pendingReports[mentions.first().id]).length;
							if(reportCount < 1) {
								delete pendingReports[mentions.first().id];
							}
						}
						console.log("removed reports");
					}
					if(!confirmed) {
						if(!pendingReports[id]) {
							pendingReports[id] = {};
						}
						if(!pendingReports[id][mentions.first().id]) {
							pendingReports[id][mentions.first().id] = {w:0,l:0,d:0,t:0}
						}
						if(cmd[1] == "w") {
							pendingReports[id][mentions.first().id].w++;
							channel.send("Your win has been reported, and will be confirmed when your opponent reports their corresponding loss.");
						} else if(cmd[1] == "l") {
							pendingReports[id][mentions.first().id].l++;
							channel.send("Your loss has been reported, and will be confirmed when your opponent reports their corresponding win.");
						} else if(cmd[1] == "d") {
							pendingReports[id][mentions.first().id].d++;
							channel.send("Your draw has been reported, and will be confirmed when your opponent reports their corresponding draw.");
						} else {
							channel.send("I don't understand if it was a win, loss, or draw. Be sure to use the format -rep [W/L/D] [player]")
						}
					}

				} else {
					channel.send("I don't recognize that player. Make sure you use the format -rep [W/L/D] [player], and that they have registered.");
				}
			} else {
				channel.send("I don't recognize that player. Make sure you use the format -rep [W/L/D] [player], and that they have registered.");
			}
		} else {
			channel.send("You must first register with -register");
		}
	} catch(e) {
		console.error(e);
	}
	console.log("finished report");
}

async function rec(ida, idb, s, channel) {
	console.log("starting rec")
	pa = await getUser(ida);
	pb = await getUser(idb);

	console.log("pa: " + pa + " pb: " + pb);
	console.log("pa.r: " + pa.r + " pb.r: " + pb.r);

	k = 25;

	ac = Math.ceil(k*(s-(1/(1+Math.pow(10,(pb.r-pa.r)/400)))));
	bc = Math.ceil(k*((1-s)-(1/(1+Math.pow(10,(pa.r-pb.r)/400)))));

	var achar = "";
	if(ac > 0) {
		achar = "+";
	}
	var bchar = "";
	if(bc > 0) {
		bchar = "+";
	}

	console.log("pa.r: " + pa.r + " pb.r: " + pb.r);

	pa.r += ac;
	pb.r += bc;

	console.log("pa.r: " + pa.r + " pb.r: " + pb.r);

	if(s == 1) {
		pa.w++;
		pb.l++;
	} else if(s == .5) {
		pa.d++;
		pb.d++;
	} else if(s == 0) {
		pa.l++;
		pb.w++;
	}
	console.log("did math")

	write('./save/accounts/'+ida, JSON.stringify(pa));
	write('./save/accounts/'+idb, JSON.stringify(pb));
	console.log("wrote twice")
	channel.send("New Ratings:\n"+pa.tag+": "+pa.r+" ("+achar+ac+")\nW: "+pa.w+" L: "+pa.l+" D: "+pa.d+"\n\n"+pb.tag+": "+pb.r+" ("+bchar+bc+")\nW: "+pb.w+" L: "+pb.l+" D: "+pb.d);
	console.log("sent msg");
    adjustLeaderboard(ida, pa.r, pa.tag);
	adjustLeaderboard(idb, pb.r, pb.tag);
	write('./save/leaderboard',JSON.stringify(leaderboard));
	console.log("adjusted leaderboard");
}

function adjustLeaderboard(id, r, tag) {
	var c = 0;
	var found = false;
	while(c < leaderboard.length && !found) {
		if(leaderboard[c].id == id) {
			leaderboard.splice(c, 1);
			found = true;
		}
		c++;
	}

	var i = 0;
	found = false;
	while(i < leaderboard.length && !found) {
		if(leaderboard[i].r <= r) {
			leaderboard.splice(i, 0, {id: id, r: r, tag: tag});
			found = true;
		}
		i++;
	}
	if(!found && leaderboard.length < 200) {
		leaderboard.push({id: id, r: r, tag: tag});
	}
}

async function getUser(id) {
	try {
		var user = JSON.parse(await readFile('./save/accounts/'+id+'.txt', 'utf8'));
		console.log("user: " + user);
		return user;
	} catch(e) {
		console.error(e);
	}
}

async function sayUnrec(channel) {
	channel.send("Unrecognized command. Use -help for more info.");
}

async function register(id, channel, tag) {
	try {
		var stat = await getStats('./save/accounts/'+id+'.txt');
		if(stat) {
			//file exists
			channel.send("You already have an account!");
		} else {
			// file does not exist
			var toWrite = JSON.stringify({
				r: 1400,
				w: 0,
				l: 0,
				d: 0,
				tag: tag
			});
			write('./save/accounts/'+id, toWrite);
			channel.send("You are now registered.");
		}
	} catch(e) {
		console.error(e);
	}
}

async function write(path, data) {
    try {
        fs.writeFile(path+'TEMP.txt',data,(error) => {                  
            if (error) throw error; 
            fs.rename(path+'TEMP.txt', path+'.txt', (error2) => {
                if (error2) throw error2;
                return;
            });
        });
    } catch(e) {
        console.error(e);
    }
}

async function getStats(file) {
    var stat;
    try {
        stat = await fileStat(file);
        return stat;
    } catch(e) {
        console.error(e);
        return false;
    }
}

setInterval(function() {
	var reporters = Object.keys(pendingReports);
	for(var i = 0; i < reporters.length; i++) {
		var reporter = reporters[i];
		var reports = Object.keys(pendingReports[reporters[i]]);
		for(var j = 0; j < reports.length; j++) {
			var reportee = reports[j];
			var report = pendingReports[reporter][reportee];
			if(report.t == 0) {
				report.t++;
			} else {
				delete pendingReports[reporter][reportee];
			}
		}
		var reportCount = Object.keys(pendingReports[reporters[i]]).length;
		if(reportCount < 1) {
			delete pendingReports[reporters[i]];
		}
	}
	var players = Object.keys(playing);
	for(var i = 0; i < players.length; i++) {
		var player = playing[players[i]];
		if(player > 0) {
			delete playing[players[i]];
		} else {
			player++;
		}
	}
}, 21600000);

setInterval(function() {
	var lookers = Object.keys(looking);
	for(var i = 0; i < lookers.length; i++) {
		var look = looking[lookers[i]];
		if(look.t > 0) {
			delete looking[lookers[i]];
		} else {
			look.t++;
		}
	}
}, 3600000);

client.login(fs.readFileSync('./server/auth.txt',"utf8"));