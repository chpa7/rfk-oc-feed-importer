import { SeedOptions } from './models/SeedOptions';
import portalService from './services/portal-service';
import * as OrderCloudSDK from 'ordercloud-javascript-sdk';
import * as helpers from './helpers';

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

  const me = await OrderCloudSDK.Me.Get();
  console.log(me);
  const categoryIDs = await categoryBuilder(productFeed, '0001'); // (Product Feed file, CatalogID)
  await postCategoryAssignments(categoryIDs, '0001', '0001'); // (CatalogID, BuyerID)
  await postProducts(productFeed, '0001', 'https:'); // (Save productfeed.csv to inputData folder, CatalogID, optional prefix for image paths)
}

async function categoryBuilder(productFeed: any[], catalogID: string) {
  const processedCategoryIDs = new Set<string>();

  for (let row of productFeed) {
    const categoriesSplitByPipe = row.Categories.split('|');

    for (let pipeSplitCategory of categoriesSplitByPipe) {
      const categoryIDs = pipeSplitCategory.split('>');
      let categoryID = '';
      let parentCategoryID = '';
      for (let catID of categoryIDs) {
        const categoryNameFormatted = catID.trimStart().trimEnd();
        const categoryIDFormatted = catID
          .replace(/\|/g, '-') // Convert pipes to hyphens,
          .replace(/[`~!@#$%^&*()|+=?;:'",.<>\{\}\[\]\\\/]/gi, '') // Remove most special characters (not hyphens/underscores)
          .replace(/ /g, ''); // Remove spaces
        categoryID +=
          categoryID.length == 0
            ? categoryIDFormatted.toLowerCase()
            : '-' + categoryIDFormatted.toLowerCase();
        if (processedCategoryIDs.has(categoryID)) {
          parentCategoryID = categoryID;
          continue;
        } else {
          processedCategoryIDs.add(categoryID);
          await postCategory(categoryID, categoryNameFormatted, parentCategoryID, catalogID);
          parentCategoryID = categoryID;
        }
      }
    }
  }
  return processedCategoryIDs;
}

async function postCategory(
  categoryID: string,
  categoryName: string,
  parentCategoryID: string,
  catalogID: string
) {
  const categoryRequest = {
    ID: categoryID,
    Active: true,
    Name: categoryName,
    ParentID: parentCategoryID,
  };
  try {
    const postedCategory = await OrderCloudSDK.Categories.Create(catalogID, categoryRequest);
    console.log('Success', postedCategory.ID);
    return postedCategory;
  } catch (ex) {
    console.log('Category Error', ex);
  }
}

async function postCategoryAssignments(
  categoryIDSet: Set<string>,
  catalogID: string,
  buyerID: string
) {
  const categoryIDs = Array.from(categoryIDSet);
  let categoryProgress = 1;
  let categoryErrors = {};
  const total = categoryIDs.length;
  await helpers.batchOperations(
    categoryIDs,
    async function singleOperation(categoryID: string): Promise<any> {
      // Post category assignment
      const categoryAssignmentRequest = {
        CategoryID: categoryID,
        BuyerID: buyerID,
        Visible: true,
        ViewAllProducts: true,
      };

      try {
        await OrderCloudSDK.Categories.SaveAssignment(catalogID, categoryAssignmentRequest);
        console.log(`Posted ${categoryProgress} category assignments out of ${total}`);
        categoryProgress++;
      } catch (ex) {
        console.log('Category Assignment Error', ex);
        categoryErrors[categoryID!] = ex;
        categoryProgress++;
      }
    }
  );
}

async function postProducts(productFeed: any[], catalogID: string, imageUrlPrefix = '') {
  let productProgress = 1;
  let productErrors = {};
  const total = productFeed.length;

  console.log(`Posting ${productFeed.length} products.`);

  await helpers.batchOperations(
    productFeed,
    async function singleOperation(row: any): Promise<any> {
      // Post price schedule
      const priceScheduleRequest = {
        ID: row.Id,
        Name: row.Name,
        PriceBreaks: [
          {
            Quantity: 1,
            Price: row.Price,
          },
        ],
      };

      try {
        await OrderCloudSDK.PriceSchedules.Create(priceScheduleRequest);
      } catch (ex) {
        console.log('Price Schedule Error', ex);
      }

      // Post product
      const productRequest = {
        ID: row.Id,
        Name: row.Name,
        Active: true,
        Description: row.Description,
        DefaultPriceScheduleID: row.Id,
        xp: {
          Images: [
            {
              Url: imageUrlPrefix + row.ImageUrl,
              ThumbnailUrl: imageUrlPrefix + row.Thumbnail,
              Tags: null,
            },
          ],
          Status: 'Draft',
          IsResale: false,
          IntegrationData: null,
          HasVariants: false,
          Note: '',
          Tax: {
            Category: 'P0000000',
            Code: 'PC030156',
            Description:
              'Clothing And Related Products (Business-To-Business)-Work clothes (other)',
          },
          UnitOfMeasure: {
            Qty: 1,
            Unit: 'Per',
          },
          ProductType: 'Standard',
          SizeTier: 'D',
          Accessorials: null,
          Currency: 'USD',
          ArtworkRequired: false,
          PromotionEligible: true,
          FreeShipping: false,
          FreeShippingMessage: 'Free Shipping',
          Documents: null,
        },
      };

      try {
        await OrderCloudSDK.Products.Create(productRequest);
        console.log(`Posted ${productProgress} products out of ${total}`);
        productProgress++;
      } catch (ex) {
        console.log('Product Error', ex);
        productErrors[row.Id!] = ex;
        productProgress++;
      }

      // Post category-product assignment
      const categoriesSplitByPipe = row.Categories.split('|');
      for (let pipeSpiltCategory of categoriesSplitByPipe) {
        const categoryIDs = pipeSpiltCategory.split('>');
        let categoryID = '';
        for (let catID of categoryIDs) {
          const categoryIDFormatted = catID
            .replace(/\|/g, '-') // Convert pipes to hyphens,
            .replace(/[`~!@#$%^&*()|+=?;:'",.<>\{\}\[\]\\\/]/gi, '') // Remove most special characters (not hyphens/underscores)
            .replace(/ /g, ''); // Remove spaces
          categoryID +=
            categoryID.length == 0
              ? categoryIDFormatted.toLowerCase()
              : '-' + categoryIDFormatted.toLowerCase();
        }
        try {
          const categoryProductAssignmentRequest = {
            CategoryID: categoryID,
            ProductID: row.Id,
          };
          await OrderCloudSDK.Categories.SaveProductAssignment(
            catalogID,
            categoryProductAssignmentRequest
          );
        } catch (ex) {
          console.log('Product Category Assignment Error', ex);
        }
      }
    }
  );
  console.log('done');
}

export default {
  run,
};
