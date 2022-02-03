/** @param {NS} ns **/
export async function main(ns) {
/*	var serverList = ns.scan("home");
	var newServerList = [];
	var currentServer = "";
	var latestServers = [];
	var differenceServerList = [];
	for(const server in serverList)
	{
		currentServer = serverList[server];
		//ns.tprint(currentServer);
		latestServers = ns.scan(currentServer);
		differenceServerList = latestServers.filter(x => serverList.indexOf(x) === -1);
		newServerList = newServerList.concat(differenceServerList);
	}
	
	differenceServerList = newServerList.filter(x => serverList.indexOf(x) === -1);
	const fullServerList = serverList.concat(differenceServerList);
	let uniqueServerList = [...new Set(fullServerList)];
	for(const server in uniqueServerList)
	{
		currentServer = uniqueServerList[server];
		ns.tprint(currentServer);
	}*/

	var serverList = getServerList(ns, "home", [], "");
	//ns.print("getServerList finished, serverList.length = " + serverList.length);
	for(const server in serverList)
	{
		await ns.print(serverList[server]);
	}
		
}

export function getServerList(ns, currentServerName, serverList, lastServer)
{
  var currentServer = currentServerName;
  var latestServerList = [];
  var newServerList = [];
  if(currentServer == "")
    currentServer = "home";
  ns.print(currentServer + " last server " + lastServer + ", serverList.length = " + serverList.length);
  if(ns.isRunning("getServerNames.js", currentServerName) && currentServerName != ns.getHostname())
	return [ns.getHostname()];
  latestServerList = ns.scan(currentServer);
  if(latestServerList.length == 0)
  {
	//ns.tprint(currentServer + " - Empty scan list");
	return [];
  }
  latestServerList = latestServerList.filter(x => serverList.indexOf(x) === -1);
  if(latestServerList.length > 0 && serverList.length > 0)
  {
	//ns.tprint(currentServer + " concatting serverList and latestServerList - latestServerList.length = " + latestServerList.length);
	newServerList = serverList.concat(latestServerList);
  }
  else if(latestServerList.length > 0)
	newServerList = latestServerList;
  else
	newServerList = serverList;
	
  //ns.print(currentServer + " - newServerList.length = " + newServerList.length);	
  for(const server in latestServerList)
  {
	if(latestServerList[server] != lastServer && latestServerList[server] != currentServer)
	{
		//ns.tprint(currentServer + " " + latestServerList[server] + " One layer deeper");
		let newList = getServerList(ns, latestServerList[server], newServerList, currentServer);
		//ns.print(currentServer + " " + latestServerList[server] + " Finish getServerList, newList.length = " + newList.length);
		if(newList.length > 0)
    		newServerList = newServerList.concat(newList);
	}
	//else
		//ns.tprint(currentServer + " " + latestServerList[server] + " skipping");

  }
  return newServerList.filter(onlyUnique);
}

function onlyUnique(value, index, self) {
	return self.indexOf(value) === index;
}