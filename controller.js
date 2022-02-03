import {getServerList} from "getServerNames.js";

/** @param {NS} ns **/
export async function main(ns) {
	var currHost = ns.getHostname(); // Machine this script resides on
	var perc = ns.args[0]; // Maximum percentage of machine's ram to use
	var servList;
	var numRoot;
	var maxRam;
	var ramPerServ, ramRemaining;
	var serversRemaining;
	var hackNum, growNum, weakenNum;
	var hackThresh, growThresh, weakenThresh;
	var hackRatio, growRatio, weakenRatio;
	var hackThreads, growThreads, weakenThreads;
	var securityLow, moneyLow, moneyHigh;
	var hackSize, growSize, weakenSize;
	var hackPerc;
	var servMoney, servMaxMoney, servSec, servMinSec;

	hackThresh = 0.7;
	growThresh = 0.3;
	weakenThresh = 1.1;

	hackRatio = 0.05;
	growRatio = 0.6;
	weakenRatio = 0.9;

	hackSize = ns.getScriptRam("1hack.js");
	growSize = ns.getScriptRam("1grow.js");
	weakenSize = ns.getScriptRam("1weaken.js");

	var deleteRoot;

	if(ns.args.length == 0) // Set default percentage if not input
		perc = 0.95;
	while(true)
	{
		await ns.sleep(100);
		servList = getServerList(ns, currHost, [], "" );
		maxRam = (await ns.getServerMaxRam(currHost) - await ns.getServerUsedRam(currHost)) * perc;
		numRoot = 0;
		deleteRoot = true;

		if(maxRam > hackSize || maxRam > growSize || maxRam > weakenSize)
		{
			// Determine how many servers we have root access to
			while(deleteRoot)
			{
				deleteRoot = false;
				// Determine how many servers we have root access to
				for(const iserv in servList)
				{
					if(await skipServer(ns, servList[iserv]))
					{
						servList.splice(iserv, 1);
						deleteRoot = true;
						continue;
					}
				}
			}

			serversRemaining = servList.length;
			await shuffle(servList);
			
			// Determine maximum amount of ram we can use for each server
			ramRemaining = maxRam;

			for(const serv of servList)
			{
				if(ns.hasRootAccess(serv) && serv != "home" && serversRemaining > 0)
				{
					ramPerServ = ramRemaining / serversRemaining;
				
					await ns.print("ramPerServ = " + ramPerServ + ", serversRemaining = " + serversRemaining);
					await ns.print("ramRemaining = " + ramRemaining);

					if(ramPerServ < weakenSize)
						ramPerServ = weakenSize;

					hackThreads = 0;
					growThreads = 0;
					weakenThreads = 0;

					servSec = ns.getServerSecurityLevel(serv);
					servMinSec = ns.getServerMinSecurityLevel(serv);
					servMoney = ns.getServerMoneyAvailable(serv);
					if(servMoney < 50)
						servMoney = 50;
					servMaxMoney = ns.getServerMaxMoney(serv);

					if(servMaxMoney == 0)
						continue;

					securityLow = !(servSec > (servMinSec * weakenThresh));
					await ns.print("securityLow = " + securityLow);
					moneyHigh =  !(servMaxMoney > servMoney) && !(servMaxMoney == 0);
					await ns.print("moneyHigh = " + moneyHigh);
					moneyLow = (servMaxMoney * growThresh > servMoney) || (servMoney == 0);
					await ns.print("moneyLow = " + moneyLow);


					await ns.print("ramPerServ = " + ramPerServ);

					// Determine number of threads for each of weaken, grow, hack
					hackThreads = (ramPerServ/hackSize) * hackRatio;
					hackThreads = ((!securityLow || !moneyHigh) ? 0 : ((ramPerServ/hackSize) * hackRatio ));
					await ns.print("hackSize = " + hackSize + ", hackThreads = " + hackThreads);
					
					if(hackThreads > 0 && !ns.isRunning("1hack.js", currHost, serv))
					{
						if(hackThreads < 1)
							hackThreads = 1;
						hackThreads = Math.floor(hackThreads);
						await ns.print("Running hack on " + serv + ", " + hackThreads + " threads");
						await ns.exec("1hack.js", currHost, hackThreads, serv );
						ramRemaining = ramRemaining - (hackSize * hackThreads);
					}

					growThreads = (ramPerServ/growSize) * growRatio;
					growThreads = (!securityLow ? 0 : ((ramPerServ/growSize) * growRatio ));

					if(growThreads > Math.ceil(ns.growthAnalyze(currHost, (servMaxMoney/servMoney))))
						growThreads = Math.ceil(ns.growthAnalyze(currHost, (servMaxMoney/servMoney)));
					await ns.print("growSize = " + growSize + ",growThreads = " + growThreads);

					if(growThreads > 0 && !ns.isRunning("1grow.js", currHost, serv))
					{
						if(growThreads < 1)
							growThreads = 1;
						growThreads = Math.floor(growThreads);
						await ns.print("Running grow on " + serv + ", " + growThreads + " threads");						
						await ns.exec("1grow.js", currHost, growThreads, serv );	
						ramRemaining = ramRemaining - (growSize * growThreads);
					}

					weakenThreads = (ramPerServ/weakenSize) * weakenRatio;
					weakenThreads = (securityLow ? 0 : ((ramPerServ/weakenSize) * weakenRatio ));
					await ns.print("weakenSize = " + weakenSize + ", weakenThreads = " + weakenThreads);	

					if(weakenThreads > 0 && !ns.isRunning("1weaken.js", currHost, serv))
					{
						if(weakenThreads < 1)
							weakenThreads = 1;
						weakenThreads = Math.floor(weakenThreads);
						await ns.print("Running weaken on " + serv + ", " + weakenThreads + " threads, effect: " + ns.weakenAnalyze(weakenThreads));
						await ns.exec("1weaken.js", currHost, weakenThreads, serv );
						ramRemaining = ramRemaining - (weakenSize * weakenThreads);
					}

					if(ns.fileExists("Formulas.exe", "home"))
					{
						hackPerc = ns.formulas.hacking.hackPercent(ns.getServer(serv), ns.getPlayer());
						if(hackThreads > (0.5 / hackPerc))
							hackThreads = (0.5 / hackPerc);
					}

					await ns.sleep(10);		
						
				}
				serversRemaining--;
				
			}
			await ns.sleep(10000);
		}
		
	}
	
	
}

export async function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

export async function skipServer(ns, serv)
{
	var host = ns.getHostname();
	if(!(ns.hasRootAccess(serv)) || 
			serv == "home" ||
			!(ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(serv)) || 
			(ns.getServerMaxMoney(serv) == 0) || 
			(serv.substring(0, 5) == "Serv-") ||
			ns.isRunning("1hack.js", host, serv) ||
			(ns.isRunning("1grow.js", host, serv) && ns.isRunning("1weaken.js", host, serv)))
		return true;
	return false;
}