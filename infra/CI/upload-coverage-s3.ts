import { FileData, getAllDirsFiles, upload } from '../s3';

const bucketCodeName = process.env.CODE_BUCKET;

const COVERAGE_DIR = './coverage';

const COMMIT_HASH = process.env.GITHUB_SHA;

async function main() {
  if (!bucketCodeName) {
    throw new Error('Bucket code variable is empty!');
  }
  const files = await getAllDirsFiles([COVERAGE_DIR]);
  await Promise.all(files.map(async ({ file }: FileData) => {
    await upload(
      bucketCodeName,
      `${COMMIT_HASH}/${file.replace(`${COVERAGE_DIR}/`, '')}`,
      file,
      'public-read',
    );
  }));
}

main().catch((err) => {
  console.error(err, err.toString());
  process.exit(1);
});
