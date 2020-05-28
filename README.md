# BrighterScript

A superset of Roku's BrightScript language. Compiles to standard BrightScript. 

[![build](https://img.shields.io/github/workflow/status/rokucommunity/BrighterScript/build.svg?logo=github)](https://github.com/rokucommunity/BrighterScript/actions?query=workflow%3Abuild)
[![Coverage Status](https://coveralls.io/repos/github/rokucommunity/BrighterScript/badge.svg?branch=master)](https://coveralls.io/github/rokucommunity/BrighterScript?branch=master)
[![NPM Version](https://badge.fury.io/js/BrighterScript.svg?style=flat)](https://npmjs.org/package/BrighterScript)


## Overview

The BrighterScript language provides new features and syntax enhancements to Roku's BrightScript language. Because the language is a superset of BrightScript, the parser and associated tools (IDE-integration, intellisense, etc), work with standard BrightScript (.brs) files. This means you will get benefits (as described in the following section) from using the BrighterScript compiler, whether your project contains BrighterScript (.bs) files or not. The BrighterScript language transpiles to standard BrightScript, so your code is fully compatible with all roku devices.

## Why use the compiler?

 - BrighterScript provides a simple-to-use command-line utility that will check the entire project for syntax and program errors
 - Catch syntax and program errors from a command line without needing to run on an actual Roku device.
 - Many errors are reported at compile time which would not otherwise appear until runtime, saving effort.
 - The compiler can be used as part of your tool-chains, such as continuous integration.
 - Get real-time syntax validation by using the cli in `--watch` mode.

## Why use brighterscript?

 - Brighterscript is in good hands:
    - The project is open source.
    - Brighterscript is designed by roku-developers, for roku-developers.
    - The project is owned by roku community and the syntax and features are thoroughly thought out, discussed, and planned.
    - Actively developed.
 - Reduce boilerplate code and time debugging, with these language features:
    - Imports statements:
      - Import statements in scripts, which resolve cascading imports, and automatically add script tags to node.
      - Missing imports are flagged at compile time.
    - Class specification:
      - Classes can be defined using common syntax, and visibility (i.e. public, private and protected).
      - Classes can be extended.
      - Overriding, and super method calls are supported.
      - Field initialization.
      - Class methods are automatically scoped to the class.
      - All manner of syntax errors relating to class creation are reported at compile time (or in the IDE, while typing)
      - Class and method navigation is supported in vscode IDE.
    - Namespacing:
      - Automatically add a name prefix to all methods inside a namespace block.
      - This prevents method naming collisions and improves code readability and maintainability.
      - Missing method invocations, and other namespace related syntax errors are reported at compile time.
      - IDE support
  - Additional Language features (wip):
    - Ternary operator: `username = m.user <> invalid ? m.user.name : "not logged in"`
    - Template strings: ``Hello ${"wor" + "ld"}!`.
    - Null coalesence: `account = m.user ?? getDefaultAccount()`
    - Null conditional: `accountSettings = m.user?.account?.profile?.settings`
    - and [more](https://github.com/rokucommunity/BrighterScript/blob/master/docs/index.md))
  - Rich Type support TBD

## Who uses Brighterscript?

Brighterscript is used by [applicaster](https://www.applicaster.com/), [The miracle channel](https://miraclechannel.ca/corco/), and in open source projects such as [rooibos](https://github.com/georgejecook/rooibos/blob/master/docs/index.md), and the [maestro framework](https://github.com/georgejecook/maestro/blob/master/docs/index.md). The language has been in use for almost a year, and there are at least 2,000+ BrighterScript transpiled files on published channels.

The Parser is used to power the popular [Brightscript Language](https://marketplace.visualstudio.com/items?itemName=celsoaf.brightscript) vscode language extension, and other tools.

More projects are adopting some of the language features, or even just using the compiler, all the time. Watch this space!

## What's with the name?
The name BrighterScript is a compliment to everything that is great about Roku's awesome BrightScript language. Naming things are hard, and discoverability and recognizability is important. Here are the reasons we chose this name:
 - the `er` in BrighterScript represents the additional features we have added on top of BrightScript
 - It looks so similar to BrightScript, which is fitting because this language is 95% BrightScript, 5% extra stuff (the `er` bits).
 - The config file and extension look very similar between BrightScript and BrighterScript. Take `bsconfig.json` for example. While `brsconfig.json` might be more fitting for a pure BrightScript project, `bsconfig.json` is so very close that you probably wouldn't think twice about it. Same with the fact that `.bs` (BrighterScript) and `.brs` are very similar.

We want to honor BrightScript, the language that BrighterScript is based off of, and could think of no better way than to use _most_ of its name in our name. 

## Features
BrighterScript adds several new features to the BrightScript language such as Namespaces, classes, import statements, and more. Take a look at the language specification docs for more information. 

[BrighterScript Language Specification](https://github.com/rokucommunity/BrighterScript/blob/master/docs/index.md)


## Installation

### npm

```bash
npm install BrighterScript -g
```

## Usage

### Basic Usage

If your project structure exactly matches Roku's, and you run the command from the root of your project, then you can do the following: 

```bash
bsc 
```

That's it! It will find all files in your BrightScript project, check for syntax and static analysis errors, and if there were no errors, it will produce a zip at `./out/project.zip`

### Advanced Usage

If you need to configure `bsc`, you can do so in two ways: 

1. Using command line arguments. 
    This tool can be fully configured using command line arguments. To see a full list, run `bsc --help` in your terminal.
2. Using a `bsconfig.json` file. See [the available options](#bsconfigjson-options) below. 
    By default, `bsc` looks for a `bsconfig.json` file at the same directory that `bsc` is executed. If you want to store your `bsconfig.json` file somewhere else, then you should provide the `--project` argument and specify the path to your `bsconfig.json` file. 

### Examples

1. Your project resides in a subdirectory of your workspace folder. 

    ```bash
    bsc --root-dir ./rokuSourceFiles
    ```
2. Run the compiler in watch mode

    ```bash
    bsc --watch
    ```

3. Run the compiler in watch mode, and redeploy to the roku on every change
    ```bash
    bsc --watch --deploy --host 192.168.1.10 --password secret_password
    ```
4. Use a bsconfig.json file not located at cwd
    ```bash
    bsc --project ./some_folder/bsconfig.json
    ```
## bsconfig.json

### Overview
The presence of a `bsconfig.json` file in a directory indicates that the directory is the root of a BrightScript project. The `bsconfig.json` file specifies the root files and the compiler options required to compile the project.

### Configuration inheritance with `extends`

A `bsconfig.json` file can inherit configurations from another file using the `extends` property.

The extends is a top-level property in `bsconfig.json`. `extends`’ value is a string containing a path to another configuration file to inherit from.

The configuration from the base file are loaded first, then overridden by those in the inheriting config file. If a circularity is encountered, we report an error.

The `files` property from the inheriting config file overwrite those from the base config file.

All relative paths found in the configuration file will be resolved relative to the configuration file they originated in.


### bsconfig.json options

These are the options available in the `bsconfig.json` file. 

 - **project**: `string` - A path to a project file. This is really only passed in from the command line, and should not be present in `bsconfig.json` files

 - **extends**: `string` - Relative or absolute path to another `bsconfig.json` file that this `bsconfig.json` file should import and then override

 - **cwd**: `string` - Override the current working directory

 - **rootDir**: `string` - The root directory of your roku project. Defaults to current directory

 - **files**: ` (string | string[] | { src: string | string[]; dest?: string })[]` - The list file globs used to find all files for the project. If using the {src;dest;} format, you can specify a different destination directory for the matched files in src. 

 - **outFile**: `string` -  The path (including filename) where the output file should be placed (defaults to `"./out/[WORKSPACE_FOLDER_NAME].zip"`).
 
 - **createPackage**: `boolean` - Creates a zip package. Defaults to true. This setting is ignored when `deploy` is enabled.

 - **watch**: `boolean` -  If true, the server will keep running and will watch and recompile on every file change.

 - **deploy**: `boolean` -  If true, after a successful build, the project will be deployed to the Roku specified in host.

 - **host**: `string` -  The host of the Roku that this project will deploy to.

 - **username**: `string` - the username to use when deploying to a Roku device.

 - **password**: `string` - The password to use when deploying to a roku device.

 - **emitFullPaths**: `boolean` -  Emit full paths to files when printing diagnostics to the console. Defaults to false

 - **diagnosticFilters**: `Array<string | number | {src: string; codes: number[]}` - A list of filters used to hide diagnostics. 
   - A `string` value should be a relative-to-root-dir or absolute file path or glob pattern of the files that should be excluded. Any file matching this pattern will have all diagnostics supressed.
   - A `number` value should be a diagnostic code. This will supress all diagnostics with that code for the whole project.
   - An object can also be provided to filter specific diagnostic codes for a file pattern. For example, 
        ```jsonc
        "diagnosticFilters": [{
            "src": "vendor/**/*",
            "codes": [1000, 1011] //ignore these specific codes from vendor libraries 
        }]
        ```
 - **autoImportComponentScript**: `bool` - BrighterScript only: will automatically import a script at transpile-time for a component with the same name if it exists.


## Ignore errors and warnings on a per-line basis
In addition to disabling an entire class of errors in `bsconfig.json` by using `ignoreErrorCodes`, you may also disable errors for a subset of the complier rules within a file with the following comment flags:
 - `bs:disable-next-line`
 - `bs:disable-next-line: code1 code2 code3`
 - `bs:disable-line`
 - `bs:disable-line: code1 code2 code3`

Here are some examples:

```BrightScript
sub Main()
    'disable errors about invalid syntax here
    'bs:disable-next-line
    DoSomething(

    DoSomething( 'bs:disable-line
    
    'disable errors about wrong parameter count
    DoSomething(1,2,3) 'bs:disable-next-line

    DoSomething(1,2,3) 'bs:disable-next-line:1002
end sub

sub DoSomething()
end sub
```

The primary motivation for this feature was to provide a stopgap measure to hide incorrectly-thrown errors on legitimate BrightScript code due to parser bugs. This is still a new project and it is likely to be missing support for certain BrightScript syntaxes. It is recommended that you only use these comments when absolutely necessary.

## Language Server Protocol

This project also contributes a class that aligns with Microsoft's [Language Server Protocol](https://microsoft.github.io/language-server-protocol/), which makes it easy to integrate `BrightScript` and `BrighterScript` with any IDE that supports the protocol. We won't go into more detail here, but you can use the `LanguageServer` class from this project to integrate into your IDE. The [vscode-BrightScript-language](https://github.com/rokucommunity/vscode-BrightScript-language) extension uses this LanguageServer class to bring `BrightScript` and `BrighterScript` language support to Visual Studio Code.

## Changelog
[Click here](CHANGELOG.md) to view the changelog.

## Special Thanks
Special thanks to the [brs](https://github.com/sjbarag/brs) project for its fantastic work on its blazing fast BrightScript parser. It was used as the foundation for the BrighterScript parser. 
