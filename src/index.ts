import { SeedOptions } from './models/SeedOptions';
import portalService from './services/portal-service';
import * as OrderCloudSDK from 'ordercloud-javascript-sdk';

// import fs from 'fs';
import path from 'path';
import { csvToJson } from './helpers/csvToJson';

async function run(options: SeedOptions) {
  await portalService.login(
    options.username,
    options.password,
    options.marketplaceID,
    options.environment
  );

  let productFeed;
  if (options.filepath) {
    productFeed = await csvToJson(options.filepath);
  } else {
    // get data from template
    const projectRoot = path.join(__dirname, '../', '../');
    const templatesFolder = path.join(projectRoot, 'templates');
    productFeed = await csvToJson(path.join(templatesFolder, `${options.template}.csv`));
  }

  // max to add logic here
  const me = await OrderCloudSDK.Me.Get();
  console.log(me);
}

export default {
  run,
};
