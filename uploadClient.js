const {S3} = require('aws-sdk');
const fs = require('fs');

const s3 = new S3({region: 'eu-west-3'});

const upload = async (key, contentType, body) => s3.upload({
  Bucket: 'elections-client',
  Key: key,
  ACL: 'public-read',
  ContentType: contentType,
  ContentEncoding: 'utf-8',
  Body: body,
}).promise();
const main = async () => {
  upload('index.html', 'text/html', fs.readFileSync('./elections-client/index.html'));
  upload('index.js', 'application/javascript', fs.readFileSync('./elections-client/index.js'));
  upload('index.css', 'text/css', fs.readFileSync('./elections-client/index.css'));
};

main().then(console.log).catch(console.error);
