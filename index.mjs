import {existsSync, readFileSync, writeFileSync} from 'fs';
import { configDotenv } from 'dotenv';
import { join } from 'path';

const MAX_SIZE=300;
//const dotenv = require('dotenv').config();

configDotenv();
const {NS, APIKEYS} = process.env;
const BASE_URL= `https://reverse-ns.whoisxmlapi.com/api/v1?apiKey=`;
const KEYS = APIKEYS.split(',');

// Grab lists for the NS
const nameserversList = NS.split(',');
for (let ns of nameserversList) {
  if(KEYS.length === 0 || (KEYS.length === 1 && KEYS[0].length < 5)) break;
  const filePath = join('lists', `${ns}.txt`);
  /*if(existsSync(filePath)) {
    console.info(`Skipping ${ns} fetch, already cached locally`)
    continue; // skip if already exists, let's not fetch it again :)
  }*/
  let last = '';
  let doms = [];
  if(existsSync(filePath)) {
    doms = readFileSync(filePath, {encoding: 'utf8'}).split('\n');
    last = doms.slice(-1).pop();
  }
  while(true) {
    const url = `${BASE_URL}${KEYS[0]}&ns=${ns}`;
    const req = await fetch(`${url}${last !== '' ? `&from=${last}` : ''}`);
    const json = await req.json();
    if(!json.result) {
      if(json.code === 403 && json.messages === 'Access restricted. Check credits balance or enter the correct API key.') {
        console.info(`API Key ${KEYS[0]} dead, continuing...`);
        KEYS.shift();
        // update our .env dynamically, lmao
        writeFileSync(`.env`, `APIKEYS=${KEYS.join(',')}\nNS=${NS}`);
        if(KEYS.length === 0) {
          console.error(`Ran out of API keys :triumph:`);
          break;
        }
        continue;
      } else {
        console.error(`No result from querying ${ns}`);
        console.error(json);
        break;
      }
    }
    const thesedomains = json.result.map(e => e.name);
    doms.push(...thesedomains);
    last = thesedomains.slice(-1).pop();

    if(json.size !== MAX_SIZE) {
      console.info(`Done querying ${ns}, got ${doms.length} domain names`)
      break; // this was probably the last page!
    }
  }

  writeFileSync(filePath, doms.join('\n'));
  if(KEYS.length === 0) {
    break;
  }
}

// Cook the report
const domains = {}; // NS: string[]
// load all domains
for (let ns of nameserversList) domains[ns] = readFileSync(join('lists', `${ns}.txt`), {encoding: 'utf8'}).split('\n');

const matches = [];
for (const [ns, doms] of Object.entries(domains)) {
  console.log(`Processing matches report for ${ns}`);
  const all = Object.values(domains); // string[][]
  const mt = doms.filter((dom) => {
    if(matches.includes(dom)) return false;
    return all.every((zone) => zone.includes(dom));
  })
  matches.push(...mt);
  for(const zone in all) {
    //matches.push(...Object.values(domains).filter((zone) => zone.every((zoneDomain) => zoneDomain.includes(dom))));

  }
}
writeFileSync(`report.txt`, matches.join('\n'));
console.info(`Done! Check 'report.txt'`)
