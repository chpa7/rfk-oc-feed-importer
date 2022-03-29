import { SeedOptions } from './models/SeedOptions';
import portalService from './services/portal-service';
import * as OrderCloudSDK from 'ordercloud-javascript-sdk';
import * as helpers from './helpers';

// import fs from 'fs';
import path from 'path';
import { csvToJson } from './helpers/csvToJson';
import chalk from 'chalk';
import { Buyer, Catalog } from 'ordercloud-javascript-sdk';

let results = {
  categories: {
    processed: 0,
    total: 0,
    errors: 0,
  },
  categoryAssignments: {
    processed: 0,
    total: 0,
    errors: 0,
  },
  products: {
    processed: 0,
    total: 0,
    errors: 0,
  },
};

async function run(options: SeedOptions) {
  await portalService.login(
    options.username,
    options.password,
    options.marketplaceID,
    options.environment
  );

  let productFeed;
  let categoryFeed;
  const projectRoot = path.join(__dirname, '../', '../');
  const templatesFolder = path.join(projectRoot, 'templates');

  // get product data from provided file or template
  if (options.productFilePath) {
    productFeed = await csvToJson(options.productFilePath);
  } else {
    productFeed = await csvToJson(path.join(templatesFolder, `${options.template}-products.csv`));
  }

  // get category data from provided file or template
  if (options.categoryFilePath) {
    categoryFeed = await csvToJson(options.categoryFilePath);
  } else {
    categoryFeed = await csvToJson(
      path.join(templatesFolder, `${options.template}-categories.csv`)
    );
  }
  const categoryIDMap = new Map<string, string>();
  for (let row of categoryFeed) {
    const categoryIDFormatted = row.BreadcrumbName.replace(
      /[`~!@#$%^&*()|+=?;:'",.<>\{\}\[\]\\\/]/gi,
      ''
    ) // Remove most special characters (not hyphens/underscores)
      .replace(/ /g, '') // Remove spaces
      .toLowerCase();
    categoryIDMap.set(categoryIDFormatted, row.Id);
  }
  const buyer = await getBuyer(options.buyerID);
  console.log(chalk.greenBright(`Using buyer: '${buyer.Name}'`));
  const catalog = await getCatalog(buyer, options.catalogID);
  console.log(chalk.greenBright(`Using catalog: '${catalog.Name}'`));
  await assignBuyerToCatalog(buyer, catalog);
  const categoryIDs = await categoryBuilder(categoryFeed, categoryIDMap, catalog.ID); // (Category Feed file, Category ID Map from Category Feed file, CatalogID)
  await postCategoryAssignments(categoryIDs, catalog.ID, catalog.ID); // (CatalogID, BuyerID)
  await postProducts(
    productFeed,
    categoryIDMap,
    catalog.ID,
    options.prefixImageUrls ? catalog.ID : ''
  ); // (Save productfeed.csv to inputData folder, Category ID Map from Category Feed file, CatalogID, optional prefix for image paths)

  if (results.categories.errors) {
    console.log(
      chalk.redBright(`Encountered ${results.categories.errors} while creating categories`)
    );
  }
  if (results.categoryAssignments.errors) {
    console.log(
      chalk.redBright(
        `Encountered ${results.categoryAssignments.errors} while assigning categories`
      )
    );
  }
  if (results.products.errors) {
    console.log(chalk.redBright(`Encountered ${results.products.errors} while creating products`));
  }
}

async function getBuyer(buyerID?: string) {
  try {
    if (buyerID) {
      return await OrderCloudSDK.Buyers.Get(buyerID);
    }
    const buyerList = await OrderCloudSDK.Buyers.List();
    if (buyerList.Items.length) {
      return buyerList.Items[0];
    }
    return await OrderCloudSDK.Buyers.Create({
      ID: '0001',
      Name: 'Default Buyer',
      Active: true,
    });
  } catch (ex) {
    console.error(chalk.redBright(`Error retrieving buyer`));
    throw ex; // exit process
  }
}

async function getCatalog(buyer: Buyer, catalogID?: string) {
  try {
    if (catalogID) {
      return await OrderCloudSDK.Catalogs.Get(catalogID);
    }
    if (buyer.DefaultCatalogID) {
      return await OrderCloudSDK.Catalogs.Get(buyer.DefaultCatalogID);
    }
    const catalogList = await OrderCloudSDK.Catalogs.List();
    if (catalogList.Items.length) {
      return catalogList.Items[0];
    }
    return await OrderCloudSDK.Catalogs.Create({
      ID: '0001',
      Name: 'Default Catalog',
      Active: true,
    });
  } catch (ex) {
    console.error(chalk.redBright(`Error retrieving catalog`));
    throw ex; // exit process
  }
}

async function assignBuyerToCatalog(buyer: Buyer, catalog: Catalog) {
  try {
    await OrderCloudSDK.Catalogs.SaveAssignment({
      BuyerID: buyer.ID,
      CatalogID: catalog.ID,
      ViewAllCategories: true,
      ViewAllProducts: true,
    });
  } catch (ex) {
    handleError(`Error assigning buyer to catalog`, ex);
    throw ex; // exit process
  }
}

async function categoryBuilder(
  categoryFeed: any[],
  categoryIDMap: Map<string, string>,
  catalogID: string
) {
  const total = categoryFeed.length;
  results.categories.total = total;
  console.log(chalk.greenBright(`Found ${categoryFeed.length} category rows to import`));
  const processedCategoryIDs = new Set<string>();

  for (let row of categoryFeed) {
    results.categories.processed++;
    if (results.categories.processed % 25 === 0) {
      console.log(
        chalk.magentaBright(
          `Processed ${results.categories.processed} category rows of ${results.categories.total}`
        )
      );
    }
    const categoryNames = row.BreadcrumbName.split('>');
    let categoryID = '';
    let parentCategoryID = '';
    for (let catName of categoryNames) {
      const categoryNameFormatted = catName.trimStart().trimEnd();
      const categoryIDFormatted = catName
        .replace(/[`~!@#$%^&*()|+=?;:'",.<>\{\}\[\]\\\/]/gi, '') // Remove most special characters (not hyphens/underscores)
        .replace(/ /g, '') // Remove spaces
        .toLowerCase();
      categoryID += categoryIDFormatted;
      const matchingCategoryID = categoryIDMap.get(categoryID);
      if (processedCategoryIDs.has(matchingCategoryID)) {
        parentCategoryID = matchingCategoryID;
        continue;
      } else {
        processedCategoryIDs.add(matchingCategoryID);
        await postCategory(matchingCategoryID, categoryNameFormatted, parentCategoryID, catalogID);
        parentCategoryID = matchingCategoryID;
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
    return await OrderCloudSDK.Categories.Save(catalogID, categoryRequest.ID, categoryRequest);
  } catch (ex) {
    results.categories.errors++;
    handleError(`Error creating category ${categoryName}`, ex);
  }
}

async function postCategoryAssignments(
  categoryIDSet: Set<string>,
  catalogID: string,
  buyerID: string
) {
  const categoryIDs = Array.from(categoryIDSet);
  results.categoryAssignments.total = categoryIDs.length;
  console.log(chalk.greenBright(`Found ${categoryIDs.length} categories to assign`));
  await helpers.batchOperations(
    categoryIDs,
    async function singleOperation(categoryID: string): Promise<any> {
      results.categoryAssignments.processed++;
      if (results.categoryAssignments.processed % 100 === 0) {
        console.log(
          chalk.magentaBright(
            `Assigned ${results.categoryAssignments.processed} categories of ${results.categoryAssignments.total}`
          )
        );
      }
      // Post category assignment
      const categoryAssignmentRequest = {
        CategoryID: categoryID,
        BuyerID: buyerID,
        Visible: true,
        ViewAllProducts: true,
      };

      try {
        await OrderCloudSDK.Categories.SaveAssignment(catalogID, categoryAssignmentRequest);
      } catch (ex) {
        results.categoryAssignments.errors++;
        handleError(`Error assigning categoryID: ${categoryID}`, ex);
      }
    }
  );
}

async function postProducts(
  productFeed: any[],
  categoryIDMap: Map<string, string>,
  catalogID: string,
  imageUrlPrefix = ''
) {
  console.log(chalk.greenBright(`Found ${productFeed.length} products to import`));
  results.products.total = productFeed.length;

  await helpers.batchOperations(
    productFeed,
    async function singleOperation(row: any): Promise<any> {
      results.products.processed++;
      if (results.products.processed % 100 === 0) {
        console.log(
          chalk.magentaBright(
            `Processed ${results.products.processed} products of ${results.products.total}`
          )
        );
      }

      // Post price schedule
      const priceScheduleRequest = {
        ID: row.Id,
        Name: row.Name,
        PriceBreaks: [
          {
            Quantity: 1,
            Price: row.SpecialPrice,
          },
        ],
      };

      try {
        await OrderCloudSDK.PriceSchedules.Save(priceScheduleRequest.ID, priceScheduleRequest);
      } catch (ex) {
        results.products.errors++;
        handleError(`Error creating priceschedule for product ${row.ID}`, ex);
        return;
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
        await OrderCloudSDK.Products.Save(productRequest.ID, productRequest);
      } catch (ex) {
        results.products.errors++;
        handleError(`Error creating product ${row.ID}`, ex);
        return;
      }

      // Post category-product assignment
      const categoriesSplitByPipe = row.Categories.split('|');
      for (let pipeSpiltCategory of categoriesSplitByPipe) {
        const categoryIDs = pipeSpiltCategory.split('>');
        let categoryID = '';
        for (let catID of categoryIDs) {
          const categoryIDFormatted = catID
            .replace(/[`~!@#$%^&*()|+=?;:'",.<>\{\}\[\]\\\/]/gi, '') // Remove most special characters (not hyphens/underscores)
            .replace(/ /g, '') // Remove spaces
            .toLowerCase();
          categoryID += categoryIDFormatted;
        }
        try {
          const categoryProductAssignmentRequest = {
            CategoryID: categoryIDMap.get(categoryID),
            ProductID: row.Id,
          };
          await OrderCloudSDK.Categories.SaveProductAssignment(
            catalogID,
            categoryProductAssignmentRequest
          );
        } catch (ex) {
          results.products.errors++;
          handleError(`Error assigning product ${row.ID} to category ${categoryID}`, ex);
          return;
        }
      }
    }
  );
  console.log('done');
}

function handleError(message, err: any): void {
  console.error(chalk.red(message));
  if (err.isOrderCloudError) {
    console.error(
      chalk.redBright(
        `${err.request.method} ${err.request.protocol + err.request.host + err.request.path}`
      )
    );
    console.error(chalk.redBright(JSON.stringify(err.errors, null, 4)));
  } else {
    console.error(chalk.redBright(err?.message));
  }
}

export default {
  run,
};
