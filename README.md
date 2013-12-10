# npm-readonly-mirror

Mirror [NPM](https://npmjs.org) to [Amazon S3](http://aws.amazon.com/s3/)

## Using mozilla's npm read-only mirror

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

## Running your own read-only mirror

To run your own mirror, you'll need to [sign up](https://portal.aws.amazon.com/gp/aws/developer/registration/index.html) for an AWS account.

Once you've done that fetch this repository and its dependencies:

* `git clone https://github.com/jbuck/npm-readonly-mirror.git`
* `cd npm-readonly-mirror`
* `npm install`

### Amazon S3 setup

1. Create a new S3 bucket. If you're not sure how, Amazon has some [documentation](http://docs.aws.amazon.com/AmazonS3/latest/gsg/CreatingABucket.html). Remember the bucket name and region you created it in.
2. View your bucket properties by clicking its name in the bucket list, and then clicking the properties button on the top right of the console.
3. Change the default permissions for your bucket to allow for anonymous GET Object requests. Click the Permissions tab, then the Add bucket policy button. Add the following policy, with the Resource name changed to match yours:

```
{
  "Version": "2008-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::<your-bucket-name>/*"
    }
  ]
}
```

4. Make your S3 bucket available as a static website. Click the Static Website Hosting tab then the Enable website hosting radio button. Change the Index Document to be "_index" and the Error Document to be "_error".
5. Upload a file named `_index` with the content: `{"update_seq":0}`
6. Upload a file named `_error` with the content: `{"error":"not_found","reason":"missing"}`

### Amazon CloudFront setup

1. Create a new CloudFront distribution with the following settings
  * `Origin Domain Name` should be your S3 static website URL
  * `Viewer Protocol Policy` should be `HTTPS Only`
2. You should change the Cache settings so that the tarballs are cached for a long time (a whole year?) and the package metadata files are updated more frequently.

### Client setup

1. `cp dist.json local.json`
2. Edit `local.json`:
  * Modify the sink registry to match your AWS S3 static website URL
  * Modify the sink package_host to match your AWS CloudFront URL
  * Modify the s3 bucket, key and secret to match your AWS information

## Known Issues

* You can't install the `soap` package. This is an Amazon S3 bug with their SOAP API and me not working around it by using path-style operations.
