// Beware ugly code ahead, made quickly and dirty
// Mostly focused on minimizing LOC, not intended to be good or performant code
// Params: node main_debug.js PORT DIFFICULTY

var difficulty = parseInt(process.argv[3]);
var sw = require('discovery-swarm')();
sw.listen(parseInt(process.argv[2]));
sw.join('simpleBlockchain' + difficulty); // Connect to the correct network

var LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./' + 'simpleBlockchain' + difficulty);

var chains = JSON.parse(localStorage.getItem('chains')) || []; // [LAST_BLOCK, LAST_BLOCK, LAST_BLOCK], // BLOCK = {previous: BLOCK, data: STRING, nonce: NUMBER}

function md5 (block) {
	return require('crypto').createHash('md5').update(block.previous.md5 + "|" + block.nonce + "|" + block.data).digest("hex");
}

function isValidBlock (block) {	return md5(block).indexOf(Array(difficulty + 1).join("0")) == 0 }

function findBlock (id) {
	for (var c = 0; c < chains.length; c++) {
		var block = chains[c];
		while (block) {
			if (block.md5 == id) return block;
			block = block.previous;
		}
	}
	
	return (id == 1) ? { first: true, md5: 1, count: 0} : false;
}

function isValidChain (block) {
	while (block) {
		if (!_isValidBlock(block)) return false;
		block = block.previous.first ? undefined : block.previous;
	}
	return true;
}

function longestChain () {
	var longest = { first: true, md5:1, count: 0};
	for (var c = 0; c < chains.length; c++)
		if (chains[c].count > longest.count) longest = chains[c];
	return longest;
}

function send (block) {
	console.log("Sending", block.md5, " coming from ", block.previous.md5);
	sw.connections.forEach(function (conn) {
		conn.write(block.previous.md5 + "|" + block.nonce + "|" + block.data + "||||||");
	});
}

function sendChain (lastBlock) {
	var chain = [lastBlock];
	while (!chain[chain.length - 1].previous.first)
		chain.push(chain[chain.length - 1].previous);
	
	for (var k = chain.length - 1; k >= 0; k--)
		send(chain[k]);
}

function receivedBlock (data) {
	var block = { previous: findBlock(data[0]), nonce: data[1], data: data.slice(2).join("|") };
	if(!isValidBlock(block)) { console.log("INVALID", data, block); return; }
	if (!block.previous) { console.log("GOT BLOCK BUT DID NOT HAVE FULL CHAIN"); return; }
	block.md5 = md5(block);
	if (findBlock(block.md5)) return;
	block.count = block.previous.count + 1;
	console.log("Adding", block);
	chains.indexOf(block.previous) > -1 ? chains.splice(chains.indexOf(block.previous), 1) : false; // Remove previous block from chains, aka chains.remove(block.previous)
	chains.push(block);
}

sw.on('connection', function (connection, info) {
	console.log("Connected ", info);
	
	for (var c = 0; c < chains.length; c++)
		sendChain(chains[c]);
	
	connection.on("data", function (data) {
		var blocks = data.toString().split("||||||");
		for (var k = 0; k < blocks.length - 1; k++) receivedBlock(blocks[k].split("|"));
	});
});

var nonce = Math.floor(Math.random() * 9007199254);
function generateBlock () {
	// DATA CANNOT CONTAIN |||||| (6x the | character)
	// Not gonna write something to safely handle this, shoot me
	var block = { previous: longestChain(), nonce: nonce, data: "Some data" };
	if (isValidBlock(block)) {
		console.log("Found block", block);
		block.md5 = md5(block);
		block.count = block.previous.count + 1;
		chains.indexOf(block.previous) > -1 ? chains.splice(chains.indexOf(block.previous), 1) : false; // Remove previous block from chains, aka chains.remove(block.previous)
		chains.push(block);
		localStorage.setItem('chains', JSON.stringify(chains));
		send(block);
	}
	nonce++;
	if (nonce % 1000 == 0) console.log("Generated 1000 blocks.");
	setTimeout(generateBlock, 2);
}
setTimeout(generateBlock, 2);