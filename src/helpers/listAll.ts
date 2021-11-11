import { batchOperations } from './batchOperations';
import { Meta } from 'ordercloud-javascript-sdk';
import { flatten } from 'lodash';

export interface ListPage<T> {
  Items?: T[];
  Meta?: Meta;
}

/**
 * @description returns all items from all pages for an ordercloud list function
 *
 * @param listFn the ordercloud function that will be called repeatedly
 * until all items have been retrieved (not invoked)
 * @param listArgs any arguments to the function should be passed in
 * as separate parameters
 *
 * @example
 * listAll(OrderCloudSDk.Products.List, {filters: {'xp.Color': 'Red'}});
 */
export async function listAll<T = any>(
  listFn: (...args: any) => Promise<ListPage<T>>,
  ...listArgs
): Promise<T[]> {
  // get or create filters obj if it doesnt exist
  const hasFiltersObj = typeof listArgs[listArgs.length - 1] === 'object';
  const filtersObj = hasFiltersObj ? listArgs.pop() : {};

  // set page and pageSize
  filtersObj.page = 1;
  filtersObj.pageSize = 100;

  const result1 = await listFn.apply(this, [...listArgs, filtersObj]);
  const additionalPages = getAdditionalPages(result1.Meta!);

  const results = await batchOperations<number, ListPage<T>>(
    additionalPages,
    async (page: number) => {
      return await listFn.apply(this, [...listArgs, { ...filtersObj, page: page }]);
    }
  );

  // combine and flatten items for all list calls
  return flatten([result1, ...results].map(r => r.Items!)) as T[];

  function getAdditionalPages(meta: Meta) {
    let page = meta!.Page! + 1;
    let additionalPages: number[] = [];
    while (page <= meta.TotalPages!) {
      additionalPages = [...additionalPages, page];
      page++;
    }
    return additionalPages;
  }
}
