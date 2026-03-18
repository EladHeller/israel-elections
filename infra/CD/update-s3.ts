import fs from 'fs/promises';
import { FileData, getAllDirsFiles, upload } from '../s3';

const bucketCodeName = process.env.CODE_BUCKET;
const clientCodeName = process.env.CLIENT_CODE_BUCKET;

async function main() {
  if (!bucketCodeName || !clientCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  const updatedFiles: string[] = [];

  const updatedZip = await upload(bucketCodeName, 'dist.zip', './dist.zip');
  if (updatedZip) {
    updatedFiles.push('/dist.zip');
  }

  const basePath = './elections-client/dist';
  const files = await getAllDirsFiles([basePath]);
  await Promise.all(files.map(async ({ file }: FileData) => {
    const key = file.replace(`${basePath}/`, '');
    const updated = await upload(
      clientCodeName,
      key,
      file,
    );
    if (updated) {
      updatedFiles.push(`/${key}`);
    }
  }));

  const updatedClientZip = await upload(clientCodeName, 'client.zip', './client.zip');
  if (updatedClientZip) {
    updatedFiles.push('/client.zip');
  }

  await fs.writeFile('updated-files.json', JSON.stringify(updatedFiles));
  console.log('finish');
}

main();
