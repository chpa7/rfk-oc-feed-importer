## Open API Specification

The [OpenAPI Specification](https://swagger.io/docs/specification/about/) formerly known as the Swagger Specification is a standard for describing, consuming and visualizing RESTful APIs. The OrderCloud API publishes a new definition every time a new version is released. This enables OrderCloud developers to generate SDKs, API documentation, and even the [Devcenter](https://ordercloud.io).

This tool takes in an OrderCloud OpenAPI spec along with a set of templates and generates an output. In our case, that output is a set of javascript SDKs but it really could be anything that needs data about the OrderCloud API. Our hope is that outside developers might find some use for it as well, perhaps for an SDK in another language not familiar to us.

## ⚙️ Installation

```shell
npm install @ordercloud/oc-codegen
```

or

```shell
yarn add @ordercloud/oc-codegen
```

## Usage

### With the command-line interface

```shell
oc-codegen --help

Usage: oc-codegen [options]

A codegen tool for the OrderCloud API

Options:
  -v, --version                           output the version number
  -t, --templates <folder>                (required) where to locate handlebars templates
  -i, --input-spec <path>                 path to valid openapi spec v3.0.0+ (defaults to https://api.ordercloud.io/v1/openapi/v3)
  -o, --output <folder>                   where to write the generated files (defaults to current directory)
  -k, --hooks <filepath>                  path to your hooks file
  -b, --handlebars-extensions <filepath>  path to your handlebars extensions file
  -d, --debug                             prints the template data that is passed to handlebars
  -c, --clean                             cleans output directory before writing files to it (default: false)
  -h, --help                              output usage information
```

#### Examples

The shortest possible syntax

```shell
oc-codegen -t './path/to/templates-folder';
```

This will feed the formatted swagger spec to your handlebars templates and output the content to the current directory

### As a module in your project

#### Using imports

```javascript
import path from 'path';
import codegen from '@ordercloud/oc-codegen';

codegen
  .generate({
    templates: 'path/to/templates-folder',
    inputSpec: null, // default: https://api.ordercloud.io/v1/openapi/v3
    output: null, // default: current directory
    hooks: null,
    handlebarsExtensions: null,
    clean: null, // default: false
    debug: null, // default: false
  })
  .then(function() {
    console.log('Done!');
  })
  .catch(function(err) {
    console.error('Something went wrong: ' + err.message);
  });
```

#### Using requires

```javascript
const codegen = require('@ordercloud/oc-codegen');
const path = require('path');

codegen.default
  .generate({
    inputSpec: '/path/to/oc-spec.json',
    templates: '/path/to/templates-folder',
    output: null, // default: current directory
    hooks: null,
    handlebarsExtensions: null,
    clean: false,
    debug: false,
  })
  .then(function() {
    console.log('Done!');
  })
  .catch(function(err) {
    console.error('Something went wrong: ' + err.message);
  });
```

## 🔧 Creating your own templates

Templates define the skeleton for how your code will be generated. We use [handlebars](https://handlebarsjs.com/) for the templating engine. There are three different types of files that can exist in your templates directory:

1. Static - copied over as-is with no dynamic content
2. Static Template - copied over once and processed by handlebars
3. Contextual Template - generates multiple files with one handlebars template where each file is a different context (resource, model, or operation)

### Template Data

Each template has access to the [formatted ordercloud spec](https://ordercloud-api.github.io/oc-codegen/interfaces/templatedata.html). Additionally, contextual templates get injected with data for each context (operation, resource, or model).

The debug option will print the templatedata to stdout which you can then pipe into a file. For example:

```shell
oc-codegen -d > templateData.json
```

### Example Templates Directory

Consider the following directory

```shell
templates
│   README.md.hbs
│
└───models
    │   _MODEL_.js.hbs
    │   ExtraModel.js
```

`README.md.hbs` is a static template and as such will generate one `README.md` file but will have context from the api spec to add dynamic data. For example we might want to set API version in the readme.

`_MODEL_.js.hbs` is a contextual template. The `_MODEL_` piece will be replaced by the current model being generated and have context injected for that model. To generate a contextual resource template include `_RESOURCE_` in the file name and similarly for contextual operation templates include `_OPERATION_` in the file name.

`ExtraModel.js` is a static file that will simply get copied over as-is during code generation

### Hooks 🎣

Hook into oc-codegen's processing pipeline with hooks!

Implement hooks by exporting them from a javascript file. If your hook performs async work you'll need to make sure it returns a promise, otherwise you can just return directly.

There are three types of hooks for each data type (operation, model, resource)

- filter{dataType} - filter the result set
- format{dataType} - replace oc-codegens formatting with your own
- postFormat{dataType} - run custom formatting after oc-codegen has done initial formatting

There is also one hook at the end of all data type hooks called `postFormatTemplateData`

```javascript
module.exports.postProcess = function(templateData, rawSpec) {
  // return your modified template data
  return templateData;
};
```

<!-- link to generated docs once we know what the url will be -->

### 💁 Custom Handlebars Helpers

In addition to the standard handlebars helpers you can define your own [custom helpers](https://developers.suitecommerce.com/add-and-use-custom-handlebars-helpers).

First create a javascript file in your project

```javascript
function handlebarsExt(Handlebars) {
  /**
   * Function to append 'bar' to the end of a word
   */
  Handlebars.registerHelper('appendBar', word => {
    return word + 'bar';
  });
}
module.exports = handlebarsExt;
```

Now simply use the helper in your handlebars template and then when you call the cli pass it the path to the extensions file so that the cli can register the helpers prior to compilation.

```shell
oc-codegen -t './path/to/templates-folder' -b './path/to/handlebars-extensions';
```

<!-- TODO: ADD LINKS once SDKs are done
### Real Examples

- Javascript SDK
- AngularJS SDK
- Angular SDK
 -->

## 📄 License

OrderCloud's oc-codegen is an open-sourced software licensed under the [MIT license](./LICENSE).

## 🤝 Contributing

Check out our [Contributing](./CONTRIBUTING.md) guide.
