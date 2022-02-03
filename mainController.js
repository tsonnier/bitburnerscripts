import {getServerList} from "./getServerNames.js";
import {skipServer, shuffle} from "./controller.js";

//const hackThresh = 0.7;
//const growThresh = 0.3;
const weakenThresh = 1.1;

//const hackRatio = 0.05;
//const growRatio = 0.6;
//const weakenRatio = 0.9;

  const memThresh = 0.90;
  const delayMult = 2.0;

/** @param {NS} ns **/
export async function main(ns) {
	// designed to run only on home, but runs 1hack.js, 1grow.js, and 1weaken.js on bought servers (and home)
	var deleteRoot = true;
	var serversRemaining;
	var servList;
	var minWaitTime, timeRun;

	while(true)
	{
		
		servList = getServerList(ns, ns.getHostname(), [], "" );

		deleteRoot = true;
		// Determine how many servers we have root access to
		while(deleteRoot)
		{
			deleteRoot = false;
			// Determine how many servers we have root access to
			for(var iserv = 0; iserv < servList.length; iserv++)
			{
				if(await skipServer(ns, servList[iserv]))
				{
					ns.print("Skipping server " + servList[iserv]);
					servList.splice(iserv, 1);
					deleteRoot = true;
//					if(iserv > 0)
//						iserv--;
					continue;
				}
			}
		}


		serversRemaining = servList.length;
		await shuffle(servList);

		minWaitTime = 10000; // base minimum wait time


		for(const serv of servList) // go through list of target servers
		{
			timeRun = await runOnServs(ns, serv, serversRemaining, "1grow.js");
			if(timeRun > 0)
				minWaitTime = (minWaitTime > timeRun ? timeRun : minWaitTime); // minimum time to wait on a script
			timeRun = await runOnServs(ns, serv, serversRemaining, "1weaken.js");
			if(timeRun > 0)
				minWaitTime = (minWaitTime > timeRun ? timeRun : minWaitTime); // minimum time to wait on a script
			timeRun = await runOnServs(ns, serv, serversRemaining, "1hack.js");
			if(timeRun > 0)
				minWaitTime = (minWaitTime > timeRun ? timeRun : minWaitTime); // minimum time to wait on a script
			serversRemaining--;
			ns.print("serversRemaining = " + serversRemaining);
			await ns.sleep(10);
		}

		while(servList.length > 0)
			servList.pop();
		// loop all available targets
		await ns.sleep(minWaitTime * delayMult) // don't want this running too often;
		
	}
	
}

async function runOnServs(ns, target, totalTargets, scriptToRun)
{

	var maxMon, currMon;
	var servRamMax, servRamCurr;
	var process;
	var ramForTarget;
	var runThreads;
	var growAn, hackAn, weakenAn;
	var runThreadsLeft;
	var servSec, servMinSec;
	var scriptSize;
	var purchServList;
	var timeRun;

	// Script info
	scriptSize = await ns.getScriptRam(scriptToRun);

	// Purchased Server List
	purchServList = await ns.getPurchasedServers();
	purchServList.push("home");
	await shuffle(purchServList);


	// General server info of target
	currMon = await ns.getServerMoneyAvailable(target);
	ns.print("currMon = " + currMon);
	maxMon = await ns.getServerMaxMoney(target);
	ns.print("maxMon = " + maxMon);

	servSec = await ns.getServerSecurityLevel(target);
	servMinSec = await ns.getServerMinSecurityLevel(target);

	// Derived server info
	if(currMon <= 50)
		currMon = 50;
	growAn = await ns.growthAnalyze(target, maxMon/currMon);
	hackAn = await ns.hackAnalyze(target);
	weakenAn = await ns.weakenAnalyze(1);

	// initial threads to run, spread across all purchased servers
	switch(scriptToRun)
	{
		case "1grow.js":
			runThreadsLeft = Math.ceil(growAn);
			ns.print("maxMon = " + maxMon + ", currMon = " + currMon + ", growAn = " + growAn);
			ns.print("runThreadsLeft at start = " + runThreadsLeft);
			if(currMon == 0)
				runThreadsLeft = 1000;
			break;
		case "1hack.js":
			runThreadsLeft = Math.ceil(currMon/(hackAn * 2)); // Try to only get halk the total money
			if(hackAn == 0)
				runThreadsLeft = 10000;
			ns.print("currMon = " + currMon + ", hackAn = " + hackAn);
			ns.print("runThreadsLeft at start = " + runThreadsLeft);
			break;
		case "1weaken.js":
			runThreadsLeft = Math.ceil((servSec - servMinSec)/weakenAn); // only run enough threads to bring down to minimum
			if(weakenAn == 0)
				runThreadsLeft = 10000;
			ns.print("servSec = " + servSec + ", servMinSec = " + servMinSec + ", weakenAn = " + weakenAn);
			ns.print("runThreadsLeft at start = " + runThreadsLeft);
			break;
	}


	for(const serv of purchServList)
	{
		ns.print("serv = " + serv);
		//if(serv == "home")
			//ns.tprint("running on home");
		if(await ns.isRunning(scriptToRun, serv, target))
		{ // Get through the servers that are already running grow for the target
			process = await ns.getRunningScript(scriptToRun, serv, target);
			runThreadsLeft -= process.threads;
			continue;
		}

		servRamMax = await ns.getServerMaxRam(serv) * memThresh;
		servRamCurr = servRamMax - await ns.getServerUsedRam(serv);

		// Split up server into ram per target
		ramForTarget = (servRamMax) / (totalTargets * 2);
		ns.print("ramForTarget = " + ramForTarget + ", scriptSize = " + scriptSize);
		// Figure out maximum amount of threads

		runThreads = Math.floor(ramForTarget / scriptSize);
		ns.print("runThreads = " + runThreads + ", check for threads left");
		if(runThreads > runThreadsLeft)
			runThreads = runThreadsLeft;

		switch(scriptToRun)
		{
			case "1grow.js":
				ns.print("runThreads = " + runThreads + ", check for security");	
				if(servSec > servMinSec * weakenThresh)
					runThreads = runThreads / 4; // slow the growth rate so weaken can work

				break;
			case "1hack.js":
				ns.print("runThreads = " + runThreads + ", check for security");
				if(servSec > servMinSec * weakenThresh)
					runThreads = runThreads / 8; // slow the growth rate so weaken can work
				if(currMon < maxMon * 0.5)
					runThreads = 0;
				break;
			case "1weaken.js": // no need to do anything about this
				break;
		}
		if(servRamCurr < runThreads * scriptSize)
			runThreads = servRamCurr/scriptSize - 5;

		ns.print("scriptSize = " + scriptSize + ",runThreads = " + runThreads);
		if(runThreads > 0)
		{
			if(runThreads < 1)
				runThreads = 1;

			runThreads = Math.floor(runThreads);
			
			ns.print("Running " + scriptToRun + " on " + serv + ", " + runThreads + " threads");
			await ns.exec(scriptToRun, serv, runThreads, target);
			runThreadsLeft -= runThreads;
			ns.print("Remaining threads = " + runThreadsLeft);
			switch(scriptToRun)
			{
				case("1grow.js"):
					timeRun = ns.getGrowTime(target);
					break;
				case("1hack.js"):
					timeRun = ns.getHackTime(target);
					break;
				case("1weaken.js"):
					timeRun = ns.getWeakenTime(target);
					break;
			}

		}
		else
			timeRun = 0;
		return timeRun;
	}		
}