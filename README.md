# npm-readonly-mirror

Mozilla's readonly mirror of [NPM](https://npmjs.org)

## Usage

To use our mirror simply change your local npm config to point at our registry:

* `npm config set registry https://dccmzgc64kzf2.cloudfront.net/`
* `npm config set ca ""`

Our mirror only supports a subset of what the real NPM can do. Specifically you can:

* `npm info <package-name>`
* `npm install <package-name>`

To revert back to the original NPM registry, you can delete your local npm config changes:

* `npm config delete registry`
* `npm config delete ca`

If you run into any issues with our mirror, please [file a bug](https://github.com/jbuck/npm-readonly-mirror/issues). Thanks!
