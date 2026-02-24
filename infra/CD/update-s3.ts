import { FileData, getAllDirsFiles, upload } from '../s3';

const bucketCodeName = process.env.CODE_BUCKET;
const clientCodeName = process.env.CLIENT_CODE_BUCKET;

async function main() {
  if (!bucketCodeName || !clientCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  await upload(bucketCodeName, 'dist.zip', './dist.zip');

  const basePath = './elections-client/dist';
  const files = await getAllDirsFiles([basePath]);
  await Promise.all(files.map(async ({ file }: FileData) => {
    console.log(file);
    await upload(
      clientCodeName,
      file.replace(`${basePath}/`, ''),
      file,
      'public-read',
    );
  }));
  console.log('finish');

  await upload(clientCodeName, 'client.zip', './client.zip', 'public-read');
}

main();
