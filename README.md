## Overview

This command line interface allows you to take a reflektion product & category feed and use it to generate a set of associated products and categories in an OrderCloud marketplace.

The main goal is to give Sitecore partners the ability to quickly play with both set of APIs. Reflektion does not currently support self-service creation of new instances. To work around that limitation, our plan is to grant partners access to a *shared* reflektion instance which they can then use to seed their own OrderCloud instance. Long term, we want to be able to allow any developer to be able to create their own reflektion instance.

## Known limitations
This tool is only meant to generate B2C scenarios. Reflektion does have some support for B2B use cases but we have not fleshed out what that would look like yet (that is next on our roadmap).

## Requirements
- [Node](https://nodejs.org/en/) >= 12

## ⚙️ Installation
`npm install --global rfk-oc-feed-importer`

## Usage

```shell
Usage: cli [options]

A tool to import a Reflektion feed into OrderCloud

Options:
  -v, --version                              output the version number
  -u, --username <string>                    username for portal credentials https://ordercloud.io/
  -p, --password <string>                    password for portal credentials https://ordercloud.io/
  -m --marketplaceID <string>                ID for the OrderCloud marketplace where products should be loaded into
  -t, --template <type>                      an existing template feed (choices: "riggsandporter", default: "riggsandporter")
  -f, --productFilePath <path>               filepath to a reflektion product feed, should adhere to reflektion standard     
  -c, --categoryFilePath <path>              filepath to a reflektion category feed, should adhere to reflektion standard    
  -b, --buyerID <string>                     (Optional) ID of an EXISTING buyer
  -x, --catalogID <string>                   (Optional) ID of an EXISTING catalog
  -e, --environment <ordercloudenvironment>   (choices: "sandbox", "staging", "production", default: "sandbox")
  -h, --help                                 display help for command
```

#### Examples
The shortest possible syntax

```shell
importfeed -u myusername -p mypassword -m mymarketplaceid
```

This will import products and categories from the riggsandporter template into your ordercloud marketplace

Using an existing catalog and buyer

```shell
importfeed -u myusername -p mypassword -m mymarketplaceid -b mybuyerid -x mycatalogid
```

This will load products and categories into the provided catalog and make those products & categories visible to the provided buyer

Using your own reflektion feed files

```shell
importfeed -u myusername -p mypassword -m mymarketplaceid -f path/to/my/product-feed.csv -c path/to/mycategory-feed.csv
```

Instead of using the templates stored in our application, you can provide your own reflektion feeds but they should match the format of the existing feeds used in the template. Check out /templates folder 